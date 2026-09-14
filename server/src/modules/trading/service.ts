import { prisma, withSerializableTransaction } from '../../services/prisma.js';
import { z } from 'zod';

// ============ Validation Schemas ============

const tradeInitiateSchema = z.object({
  targetCharacterId: z.string().uuid(),
});

const tradeOfferSchema = z.object({
  tradeId: z.string().uuid(),
  items: z.array(z.object({
    slotIndex: z.number().int().min(0),
    quantity: z.number().int().min(1),
  })),
});

const tradeAcceptSchema = z.object({
  tradeId: z.string().uuid(),
});

// ============ Trade Service ============

interface TradeSession {
  id: string;
  initiatorId: string;
  targetId: string;
  initiatorItems: Map<string, { slotIndex: number; quantity: number }>;
  targetItems: Map<string, { slotIndex: number; quantity: number }>;
  initiatorAccepted: boolean;
  targetAccepted: boolean;
  createdAt: Date;
  expiresAt: Date;
}

const activeTrades = new Map<string, TradeSession>();

/**
 * Initiate a trade with another player
 */
export async function initiateTrade(
  characterId: string,
  payload: unknown
): Promise<{ success: boolean; error?: string; tradeId?: string }> {
  const parsed = tradeInitiateSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { targetCharacterId } = parsed.data;

  try {
    // 1. Validate both characters exist and are in hub
    const [initiator, target] = await Promise.all([
      prisma.character.findUnique({
        where: { id: characterId },
        select: { id: true, zone: true, status: true, name: true },
      }),
      prisma.character.findUnique({
        where: { id: targetCharacterId },
        select: { id: true, zone: true, status: true, name: true },
      }),
    ]);

    if (!initiator || !target) {
      return { success: false, error: 'Character not found' };
    }

    if (initiator.zone !== 'hub' || target.zone !== 'hub') {
      return { success: false, error: 'Trading only available in hub' };
    }

    if (initiator.status !== 'alive' || target.status !== 'alive') {
      return { success: false, error: 'Both players must be alive' };
    }

    if (initiator.id === target.id) {
      return { success: false, error: 'Cannot trade with yourself' };
    }

    // 2. Create trade session
    const tradeId = crypto.randomUUID();
    const trade: TradeSession = {
      id: tradeId,
      initiatorId: initiator.id,
      targetId: target.id,
      initiatorItems: new Map(),
      targetItems: new Map(),
      initiatorAccepted: false,
      targetAccepted: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    };

    activeTrades.set(tradeId, trade);

    // 3. Clean up expired trades periodically
    cleanupExpiredTrades();

    return { success: true, tradeId };
  } catch (error) {
    console.error('[Trade] Initiate error:', error);
    return { success: false, error: 'Failed to initiate trade' };
  }
}

/**
 * Add items to trade offer
 */
export async function offerTradeItems(
  characterId: string,
  payload: unknown
): Promise<{ success: boolean; error?: string }> {
  const parsed = tradeOfferSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { tradeId, items } = parsed.data;

  try {
    const trade = activeTrades.get(tradeId);
    if (!trade) {
      return { success: false, error: 'Trade not found or expired' };
    }

    // Determine which player is offering
    const isInitiator = trade.initiatorId === characterId;
    const isTarget = trade.targetId === characterId;

    if (!isInitiator && !isTarget) {
      return { success: false, error: 'Not part of this trade' };
    }

    // 3. Validate items exist in inventory
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      include: {
        inventory: {
          include: {
            itemInstance: {
              include: {
                template: true,
              },
            },
          },
        },
      },
    });

    if (!character) {
      return { success: false, error: 'Character not found' };
    }

    // 4. Validate and add items to offer
    const itemMap = isInitiator ? trade.initiatorItems : trade.targetItems;
    itemMap.clear();

    for (const item of items) {
      const invSlot = character.inventory.find((s) => s.slotIndex === item.slotIndex);
      if (!invSlot) {
        return { success: false, error: `Item not found at slot ${item.slotIndex}` };
      }

      if (item.quantity > invSlot.quantity) {
        return { success: false, error: `Quantity exceeds stack at slot ${item.slotIndex}` };
      }

      itemMap.set(invSlot.itemInstanceId, {
        slotIndex: item.slotIndex,
        quantity: item.quantity,
      });
    }

    // 5. Reset acceptance
    trade.initiatorAccepted = false;
    trade.targetAccepted = false;

    return { success: true };
  } catch (error) {
    console.error('[Trade] Offer error:', error);
    return { success: false, error: 'Failed to offer items' };
  }
}

/**
 * Accept trade
 */
export async function acceptTrade(
  characterId: string,
  payload: unknown
): Promise<{ success: boolean; error?: string; completed?: boolean }> {
  const parsed = tradeAcceptSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { tradeId } = parsed.data;

  try {
    const trade = activeTrades.get(tradeId);
    if (!trade) {
      return { success: false, error: 'Trade not found or expired' };
    }

    // Mark as accepted
    if (trade.initiatorId === characterId) {
      trade.initiatorAccepted = true;
    } else if (trade.targetId === characterId) {
      trade.targetAccepted = true;
    } else {
      return { success: false, error: 'Not part of this trade' };
    }

    // Check if both accepted
    if (trade.initiatorAccepted && trade.targetAccepted) {
      // Execute trade
      const result = await executeTrade(trade);
      if (result.success) {
        activeTrades.delete(tradeId);
        return { success: true, completed: true };
      } else {
        return { success: false, error: result.error };
      }
    }

    return { success: true, completed: false };
  } catch (error) {
    console.error('[Trade] Accept error:', error);
    return { success: false, error: 'Failed to accept trade' };
  }
}

/**
 * Execute trade - transfer items between players
 */
async function executeTrade(trade: TradeSession): Promise<{ success: boolean; error?: string }> {
  try {
    return await withSerializableTransaction(async (tx) => {
      // 1. Get both characters with inventory
      const [initiator, target] = await Promise.all([
        tx.character.findUnique({
          where: { id: trade.initiatorId },
          include: {
            inventory: true,
            bag: true,
          },
        }),
        tx.character.findUnique({
          where: { id: trade.targetId },
          include: {
            inventory: true,
            bag: true,
          },
        }),
      ]);

      if (!initiator || !target) {
        return { success: false, error: 'Character not found' };
      }

      // 2. Validate initiator has space for target's items
      const initiatorMaxSlots = initiator.bag?.inventorySlots ?? 10;
      const initiatorUsedSlots = initiator.inventory.length;
      const initiatorItemsToRemove = trade.initiatorItems.size;
      const initiatorItemsToAdd = trade.targetItems.size;
      
      if (initiatorUsedSlots - initiatorItemsToRemove + initiatorItemsToAdd > initiatorMaxSlots) {
        return { success: false, error: 'Initiator inventory full' };
      }

      // 3. Validate target has space for initiator's items
      const targetMaxSlots = target.bag?.inventorySlots ?? 10;
      const targetUsedSlots = target.inventory.length;
      const targetItemsToRemove = trade.targetItems.size;
      const targetItemsToAdd = trade.initiatorItems.size;
      
      if (targetUsedSlots - targetItemsToRemove + targetItemsToAdd > targetMaxSlots) {
        return { success: false, error: 'Target inventory full' };
      }

      // 4. Remove items from initiator
      for (const [itemInstanceId, offer] of trade.initiatorItems.entries()) {
        const invSlot = await tx.inventorySlot.findUnique({
          where: {
            characterId: trade.initiatorId,
            slotIndex: offer.slotIndex,
          },
        });

        if (!invSlot || invSlot.itemInstanceId !== itemInstanceId) {
          return { success: false, error: 'Initiator item not found' };
        }

        if (offer.quantity === invSlot.quantity) {
          await tx.inventorySlot.delete({ where: { id: invSlot.id } });
        } else {
          await tx.inventorySlot.update({
            where: { id: invSlot.id },
             { quantity: invSlot.quantity - offer.quantity },
          });
        }
      }

      // 5. Remove items from target
      for (const [itemInstanceId, offer] of trade.targetItems.entries()) {
        const invSlot = await tx.inventorySlot.findUnique({
          where: {
            characterId: trade.targetId,
            slotIndex: offer.slotIndex,
          },
        });

        if (!invSlot || invSlot.itemInstanceId !== itemInstanceId) {
          return { success: false, error: 'Target item not found' };
        }

        if (offer.quantity === invSlot.quantity) {
          await tx.inventorySlot.delete({ where: { id: invSlot.id } });
        } else {
          await tx.inventorySlot.update({
            where: { id: invSlot.id },
             { quantity: invSlot.quantity - offer.quantity },
          });
        }
      }

      // 6. Add target's items to initiator
      let initiatorSlotIndex = 0;
      const initiatorUsedIndices = new Set(initiator.inventory.map((s) => s.slotIndex));
      
      for (const [itemInstanceId, offer] of trade.targetItems.entries()) {
        // Find free slot
        while (initiatorUsedIndices.has(initiatorSlotIndex)) {
          initiatorSlotIndex++;
        }

        await tx.inventorySlot.create({
           {
            characterId: trade.initiatorId,
            itemInstanceId,
            quantity: offer.quantity,
            slotIndex: initiatorSlotIndex,
          },
        });

        initiatorUsedIndices.add(initiatorSlotIndex);
        initiatorSlotIndex++;
      }

      // 7. Add initiator's items to target
      let targetSlotIndex = 0;
      const targetUsedIndices = new Set(target.inventory.map((s) => s.slotIndex));
      
      for (const [itemInstanceId, offer] of trade.initiatorItems.entries()) {
        // Find free slot
        while (targetUsedIndices.has(targetSlotIndex)) {
          targetSlotIndex++;
        }

        await tx.inventorySlot.create({
           {
            characterId: trade.targetId,
            itemInstanceId,
            quantity: offer.quantity,
            slotIndex: targetSlotIndex,
          },
        });

        targetUsedIndices.add(targetSlotIndex);
        targetSlotIndex++;
      }

      return { success: true };
    });
  } catch (error) {
    console.error('[Trade] Execute error:', error);
    return { success: false, error: 'Trade execution failed' };
  }
}

/**
 * Cancel trade
 */
export function cancelTrade(tradeId: string, characterId: string): boolean {
  const trade = activeTrades.get(tradeId);
  if (!trade) return false;

  if (trade.initiatorId !== characterId && trade.targetId !== characterId) {
    return false;
  }

  activeTrades.delete(tradeId);
  return true;
}

/**
 * Get trade info
 */
export function getTradeInfo(tradeId: string): TradeSession | undefined {
  return activeTrades.get(tradeId);
}

/**
 * Clean up expired trades
 */
function cleanupExpiredTrades(): void {
  const now = new Date();
  for (const [tradeId, trade] of activeTrades.entries()) {
    if (now > trade.expiresAt) {
      activeTrades.delete(tradeId);
    }
  }
}
