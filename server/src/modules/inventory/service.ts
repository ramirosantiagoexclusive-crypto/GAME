import { prisma, withSerializableTransaction } from '../../services/prisma.js';
import { z } from 'zod';

// ============ Validation Schemas ============

const pickupLootSchema = z.object({
  lootId: z.string().uuid(),
});

const equipSchema = z.object({
  slotIndex: z.number().int().min(0),
  equipmentSlot: z.enum(['weapon', 'armor', 'helmet', 'boots']),
});

const unequipSchema = z.object({
  equipmentSlot: z.enum(['weapon', 'armor', 'helmet', 'boots']),
});

const moveSchema = z.object({
  fromIndex: z.number().int().min(0),
  toIndex: z.number().int().min(0),
});

const dropSchema = z.object({
  slotIndex: z.number().int().min(0),
  quantity: z.number().int().min(1),
});

// ============ Inventory Service ============

export interface InventorySlotData {
  slotIndex: number;
  itemInstanceId: string;
  templateId: string;
  templateName: string;
  templateType: string;
  quantity: number;
  durability?: number;
  maxDurability?: number;
}

export interface EquipmentSlotData {
  slotType: string;
  itemInstanceId: string;
  templateId: string;
  templateName: string;
  quantity: number;
  durability?: number;
  maxDurability?: number;
}

/**
 * Get character inventory and equipment
 */
export async function getInventory(characterId: string): Promise<{
  inventory: InventorySlotData[];
  equipment: EquipmentSlotData[];
  maxSlots: number;
}> {
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
      equipment: {
        include: {
          itemInstance: {
            include: {
              template: true,
            },
          },
        },
      },
      bag: true,
    },
  });

  if (!character) {
    throw new Error('Character not found');
  }

  const inventory: InventorySlotData[] = character.inventory.map((slot) => ({
    slotIndex: slot.slotIndex,
    itemInstanceId: slot.itemInstanceId,
    templateId: slot.itemInstance.templateId,
    templateName: slot.itemInstance.template.name,
    templateType: slot.itemInstance.template.type,
    quantity: slot.quantity,
    durability: slot.itemInstance.currentDurability ?? undefined,
    maxDurability: slot.itemInstance.template.maxDurability ?? undefined,
  }));

  const equipment: EquipmentSlotData[] = character.equipment.map((slot) => ({
    slotType: slot.slotType,
    itemInstanceId: slot.itemInstanceId,
    templateId: slot.itemInstance.templateId,
    templateName: slot.itemInstance.template.name,
    quantity: slot.quantity,
    durability: slot.itemInstance.currentDurability ?? undefined,
    maxDurability: slot.itemInstance.template.maxDurability ?? undefined,
  }));

  return {
    inventory,
    equipment,
    maxSlots: character.bag?.inventorySlots ?? 10,
  };
}

/**
 * Pickup loot from ground
 * CRITICAL: Uses Serializable transaction to prevent race conditions
 */
export async function pickupLoot(
  characterId: string,
  payload: unknown
): Promise<{ success: boolean; error?: string }> {
  const parsed = pickupLootSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { lootId } = parsed.data;

  try {
    return await withSerializableTransaction(async (tx) => {
      // 1. Lock and fetch the loot
      const loot = await tx.droppedLoot.findUnique({
        where: { id: lootId },
        include: {
          itemInstance: {
            include: {
              template: true,
            },
          },
        },
      });

      if (!loot) {
        return { success: false, error: 'Loot not found' };
      }

      // 2. Check if loot expired
      if (new Date() > loot.expiresAt) {
        return { success: false, error: 'Loot has expired' };
      }

      // 3. Get character with inventory
      const character = await tx.character.findUnique({
        where: { id: characterId },
        include: {
          inventory: {
            orderBy: { slotIndex: 'asc' },
          },
          bag: true,
        },
      });

      if (!character) {
        return { success: false, error: 'Character not found' };
      }

      const maxSlots = character.bag?.inventorySlots ?? 10;

      // 4. Find free slot
      const usedSlots = new Set(character.inventory.map((s) => s.slotIndex));
      let freeSlotIndex = -1;
      for (let i = 0; i < maxSlots; i++) {
        if (!usedSlots.has(i)) {
          freeSlotIndex = i;
          break;
        }
      }

      if (freeSlotIndex === -1) {
        return { success: false, error: 'Inventory is full' };
      }

      // 5. Create inventory slot
      await tx.inventorySlot.create({
         {
          characterId,
          itemInstanceId: loot.itemInstanceId,
          quantity: loot.quantity,
          slotIndex: freeSlotIndex,
        },
      });

      // 6. Delete loot
      await tx.droppedLoot.delete({ where: { id: lootId } });

      return { success: true };
    });
  } catch (error) {
    console.error('[Inventory] Pickup error:', error);
    return { success: false, error: 'Failed to pickup loot' };
  }
}

/**
 * Equip item from inventory
 */
export async function equipItem(
  characterId: string,
  payload: unknown
): Promise<{ success: boolean; error?: string }> {
  const parsed = equipSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { slotIndex, equipmentSlot } = parsed.data;

  try {
    return await withSerializableTransaction(async (tx) => {
      // 1. Find inventory slot
      const invSlot = await tx.inventorySlot.findUnique({
        where: {
          characterId,
          slotIndex,
        },
        include: {
          itemInstance: {
            include: {
              template: true,
            },
          },
        },
      });

      if (!invSlot) {
        return { success: false, error: 'Item not found in inventory' };
      }

      // 2. Validate item type matches equipment slot
      const templateType = invSlot.itemInstance.template.type;
      if (templateType !== equipmentSlot) {
        return { success: false, error: 'Item cannot be equipped in this slot' };
      }

      // 3. Check if equipment slot is occupied
      const existingEquip = await tx.equipmentSlot.findUnique({
        where: {
          characterId,
          slotType: equipmentSlot,
        },
      });

      if (existingEquip) {
        return { success: false, error: 'Equipment slot is already occupied' };
      }

      // 4. Create equipment slot
      await tx.equipmentSlot.create({
         {
          characterId,
          itemInstanceId: invSlot.itemInstanceId,
          slotType: equipmentSlot,
        },
      });

      // 5. Delete from inventory
      await tx.inventorySlot.delete({ where: { id: invSlot.id } });

      return { success: true };
    });
  } catch (error) {
    console.error('[Inventory] Equip error:', error);
    return { success: false, error: 'Failed to equip item' };
  }
}

/**
 * Unequip item to inventory
 */
export async function unequipItem(
  characterId: string,
  payload: unknown
): Promise<{ success: boolean; error?: string }> {
  const parsed = unequipSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { equipmentSlot } = parsed.data;

  try {
    return await withSerializableTransaction(async (tx) => {
      // 1. Find equipment slot
      const equipSlot = await tx.equipmentSlot.findUnique({
        where: {
          characterId,
          slotType: equipmentSlot,
        },
      });

      if (!equipSlot) {
        return { success: false, error: 'No item in this equipment slot' };
      }

      // 2. Get character with inventory
      const character = await tx.character.findUnique({
        where: { id: characterId },
        include: {
          inventory: {
            orderBy: { slotIndex: 'asc' },
          },
          bag: true,
        },
      });

      if (!character) {
        return { success: false, error: 'Character not found' };
      }

      const maxSlots = character.bag?.inventorySlots ?? 10;

      // 3. Find free slot
      const usedSlots = new Set(character.inventory.map((s) => s.slotIndex));
      let freeSlotIndex = -1;
      for (let i = 0; i < maxSlots; i++) {
        if (!usedSlots.has(i)) {
          freeSlotIndex = i;
          break;
        }
      }

      if (freeSlotIndex === -1) {
        return { success: false, error: 'Inventory is full' };
      }

      // 4. Create inventory slot
      await tx.inventorySlot.create({
         {
          characterId,
          itemInstanceId: equipSlot.itemInstanceId,
          quantity: equipSlot.quantity,
          slotIndex: freeSlotIndex,
        },
      });

      // 5. Delete from equipment
      await tx.equipmentSlot.delete({ where: { id: equipSlot.id } });

      return { success: true };
    });
  } catch (error) {
    console.error('[Inventory] Unequip error:', error);
    return { success: false, error: 'Failed to unequip item' };
  }
}

/**
 * Move item within inventory
 */
export async function moveItem(
  characterId: string,
  payload: unknown
): Promise<{ success: boolean; error?: string }> {
  const parsed = moveSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { fromIndex, toIndex } = parsed.data;

  if (fromIndex === toIndex) {
    return { success: true };
  }

  try {
    return await withSerializableTransaction(async (tx) => {
      // 1. Find both slots
      const fromSlot = await tx.inventorySlot.findUnique({
        where: {
          characterId,
          slotIndex: fromIndex,
        },
      });

      const toSlot = await tx.inventorySlot.findUnique({
        where: {
          characterId,
          slotIndex: toIndex,
        },
      });

      if (!fromSlot) {
        return { success: false, error: 'Source slot is empty' };
      }

      // 2. Swap or move
      if (toSlot) {
        // Swap
        await tx.inventorySlot.update({
          where: { id: fromSlot.id },
           { slotIndex: toIndex },
        });
        await tx.inventorySlot.update({
          where: { id: toSlot.id },
           { slotIndex: fromIndex },
        });
      } else {
        // Move to empty slot
        await tx.inventorySlot.update({
          where: { id: fromSlot.id },
           { slotIndex: toIndex },
        });
      }

      return { success: true };
    });
  } catch (error) {
    console.error('[Inventory] Move error:', error);
    return { success: false, error: 'Failed to move item' };
  }
}

/**
 * Drop item from inventory to ground
 */
export async function dropItem(
  characterId: string,
  payload: unknown
): Promise<{ success: boolean; error?: string; lootId?: string }> {
  const parsed = dropSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { slotIndex, quantity } = parsed.data;

  try {
    return await withSerializableTransaction(async (tx) => {
      // 1. Find inventory slot
      const invSlot = await tx.inventorySlot.findUnique({
        where: {
          characterId,
          slotIndex,
        },
        include: {
          itemInstance: true,
        },
      });

      if (!invSlot) {
        return { success: false, error: 'Item not found in inventory' };
      }

      if (quantity > invSlot.quantity) {
        return { success: false, error: 'Quantity exceeds item stack' };
      }

      // 2. Get character position
      const character = await tx.character.findUnique({
        where: { id: characterId },
        select: { x: true, y: true, zone: true },
      });

      if (!character) {
        return { success: false, error: 'Character not found' };
      }

      // 3. Create dropped loot
      const loot = await tx.droppedLoot.create({
         {
          itemInstanceId: invSlot.itemInstanceId,
          quantity,
          x: character.x,
          y: character.y,
          zone: character.zone,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        },
      });

      // 4. Update or delete inventory slot
      if (quantity === invSlot.quantity) {
        await tx.inventorySlot.delete({ where: { id: invSlot.id } });
      } else {
        await tx.inventorySlot.update({
          where: { id: invSlot.id },
           { quantity: invSlot.quantity - quantity },
        });
      }

      return { success: true, lootId: loot.id };
    });
  } catch (error) {
    console.error('[Inventory] Drop error:', error);
    return { success: false, error: 'Failed to drop item' };
  }
}
