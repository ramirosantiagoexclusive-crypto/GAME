import { prisma, withSerializableTransaction } from '../../services/prisma.js';
import { z } from 'zod';

// ============ Validation Schemas ============

const stashDepositSchema = z.object({
  slotIndex: z.number().int().min(0),
  quantity: z.number().int().min(1).optional(),
});

const stashWithdrawSchema = z.object({
  stashIndex: z.number().int().min(0),
  quantity: z.number().int().min(1).optional(),
});

const stashMoveSchema = z.object({
  fromIndex: z.number().int().min(0),
  toIndex: z.number().int().min(0),
});

// ============ Stash Service ============

export interface StashSlotData {
  slotIndex: number;
  itemInstanceId: string;
  templateId: string;
  templateName: string;
  templateType: string;
  quantity: number;
  durability?: number;
  maxDurability?: number;
}

/**
 * Get character stash
 */
export async function getStash(characterId: string): Promise<{
  stash: StashSlotData[];
  maxSlots: number;
}> {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: {
      stash: {
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
    throw new Error('Character not found');
  }

  const stash: StashSlotData[] = character.stash.map((slot) => ({
    slotIndex: slot.slotIndex,
    itemInstanceId: slot.itemInstanceId,
    templateId: slot.itemInstance.templateId,
    templateName: slot.itemInstance.template.name,
    templateType: slot.itemInstance.template.type,
    quantity: slot.quantity,
    durability: slot.itemInstance.currentDurability ?? undefined,
    maxDurability: slot.itemInstance.template.maxDurability ?? undefined,
  }));

  return {
    stash,
    maxSlots: character.maxStashSlots,
  };
}

/**
 * Deposit item from inventory to stash
 * NEW: Works in any zone (hub or raid)
 * Items in stash are preserved on death
 */
export async function depositToStash(
  characterId: string,
  payload: unknown
): Promise<{ success: boolean; error?: string }> {
  const parsed = stashDepositSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { slotIndex, quantity } = parsed.data;

  try {
    return await withSerializableTransaction(async (tx) => {
      // 1. Get character (no zone restriction anymore)
      const character = await tx.character.findUnique({
        where: { id: characterId },
        include: {
          inventory: true,
          stash: true,
        },
      });

      if (!character) {
        return { success: false, error: 'Character not found' };
      }

      // Zone check removed - stash accessible anywhere

      // 2. Find inventory slot
      const invSlot = await tx.inventorySlot.findUnique({
        where: {
          characterId,
          slotIndex,
        },
      });

      if (!invSlot) {
        return { success: false, error: 'Item not found in inventory' };
      }

      const depositQuantity = quantity ?? invSlot.quantity;

      if (depositQuantity > invSlot.quantity) {
        return { success: false, error: 'Quantity exceeds item stack' };
      }

      // 3. Find free stash slot
      const maxStashSlots = character.maxStashSlots;
      const usedStashSlots = new Set(character.stash.map((s) => s.slotIndex));
      
      let freeStashIndex = -1;
      for (let i = 0; i < maxStashSlots; i++) {
        if (!usedStashSlots.has(i)) {
          freeStashIndex = i;
          break;
        }
      }

      if (freeStashIndex === -1) {
        return { success: false, error: 'Stash is full' };
      }

      // 4. Create stash slot
      await tx.stashSlot.create({
         {
          characterId,
          itemInstanceId: invSlot.itemInstanceId,
          quantity: depositQuantity,
          slotIndex: freeStashIndex,
        },
      });

      // 5. Update or delete inventory slot
      if (depositQuantity === invSlot.quantity) {
        await tx.inventorySlot.delete({ where: { id: invSlot.id } });
      } else {
        await tx.inventorySlot.update({
          where: { id: invSlot.id },
           { quantity: invSlot.quantity - depositQuantity },
        });
      }

      return { success: true };
    });
  } catch (error) {
    console.error('[Stash] Deposit error:', error);
    return { success: false, error: 'Failed to deposit to stash' };
  }
}

/**
 * Withdraw item from stash to inventory
 * NEW: Works in any zone (hub or raid)
 */
export async function withdrawFromStash(
  characterId: string,
  payload: unknown
): Promise<{ success: boolean; error?: string }> {
  const parsed = stashWithdrawSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { stashIndex, quantity } = parsed.data;

  try {
    return await withSerializableTransaction(async (tx) => {
      // 1. Get character (no zone restriction)
      const character = await tx.character.findUnique({
        where: { id: characterId },
        include: {
          stash: true,
          inventory: true,
          bag: true,
        },
      });

      if (!character) {
        return { success: false, error: 'Character not found' };
      }

      // Zone check removed - stash accessible anywhere

      // 2. Find stash slot
      const stashSlot = await tx.stashSlot.findUnique({
        where: {
          characterId,
          slotIndex: stashIndex,
        },
      });

      if (!stashSlot) {
        return { success: false, error: 'Item not found in stash' };
      }

      const withdrawQuantity = quantity ?? stashSlot.quantity;

      if (withdrawQuantity > stashSlot.quantity) {
        return { success: false, error: 'Quantity exceeds item stack' };
      }

      // 3. Find free inventory slot
      const maxInventorySlots = character.bag?.inventorySlots ?? 10;
      const usedInventorySlots = new Set(character.inventory.map((s) => s.slotIndex));
      
      let freeInventoryIndex = -1;
      for (let i = 0; i < maxInventorySlots; i++) {
        if (!usedInventorySlots.has(i)) {
          freeInventoryIndex = i;
          break;
        }
      }

      if (freeInventoryIndex === -1) {
        return { success: false, error: 'Inventory is full' };
      }

      // 4. Create inventory slot
      await tx.inventorySlot.create({
         {
          characterId,
          itemInstanceId: stashSlot.itemInstanceId,
          quantity: withdrawQuantity,
          slotIndex: freeInventoryIndex,
        },
      });

      // 5. Update or delete stash slot
      if (withdrawQuantity === stashSlot.quantity) {
        await tx.stashSlot.delete({ where: { id: stashSlot.id } });
      } else {
        await tx.stashSlot.update({
          where: { id: stashSlot.id },
           { quantity: stashSlot.quantity - withdrawQuantity },
        });
      }

      return { success: true };
    });
  } catch (error) {
    console.error('[Stash] Withdraw error:', error);
    return { success: false, error: 'Failed to withdraw from stash' };
  }
}

/**
 * Move item within stash
 */
export async function moveInStash(
  characterId: string,
  payload: unknown
): Promise<{ success: boolean; error?: string }> {
  const parsed = stashMoveSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { fromIndex, toIndex } = parsed.data;

  if (fromIndex === toIndex) {
    return { success: true };
  }

  try {
    return await withSerializableTransaction(async (tx) => {
      // 1. Check if character is in hub
      const character = await tx.character.findUnique({
        where: { id: characterId },
      });

      if (!character) {
        return { success: false, error: 'Character not found' };
      }

      if (character.zone !== 'hub') {
        return { success: false, error: 'Can only access stash in hub' };
      }

      // 2. Find both slots
      const fromSlot = await tx.stashSlot.findUnique({
        where: {
          characterId,
          slotIndex: fromIndex,
        },
      });

      const toSlot = await tx.stashSlot.findUnique({
        where: {
          characterId,
          slotIndex: toIndex,
        },
      });

      if (!fromSlot) {
        return { success: false, error: 'Source slot is empty' };
      }

      // 3. Swap or move
      if (toSlot) {
        // Swap
        await tx.stashSlot.update({
          where: { id: fromSlot.id },
           { slotIndex: toIndex },
        });
        await tx.stashSlot.update({
          where: { id: toSlot.id },
           { slotIndex: fromIndex },
        });
      } else {
        // Move to empty slot
        await tx.stashSlot.update({
          where: { id: fromSlot.id },
           { slotIndex: toIndex },
        });
      }

      return { success: true };
    });
  } catch (error) {
    console.error('[Stash] Move error:', error);
    return { success: false, error: 'Failed to move in stash' };
  }
}
