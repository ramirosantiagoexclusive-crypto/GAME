import { prisma, withSerializableTransaction } from '../../services/prisma.js';
import { z } from 'zod';

const harvestSchema = z.object({
  nodeId: z.string().uuid(),
});

/**
 * Harvest a resource node
 * CRITICAL: Validates node is not depleted, creates item in inventory
 */
export async function harvestResource(
  characterId: string,
  payload: unknown
): Promise<{ success: boolean; error?: string }> {
  const parsed = harvestSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { nodeId } = parsed.data;

  try {
    return await withSerializableTransaction(async (tx) => {
      // 1. Lock and fetch the resource node
      const node = await tx.resourceNode.findUnique({
        where: { id: nodeId },
        include: {
          resourceTemplate: true,
        },
      });

      if (!node) {
        return { success: false, error: 'Resource node not found' };
      }

      // 2. Check if node is depleted
      if (node.isDepleted) {
        return { success: false, error: 'Resource node is depleted' };
      }

      // 3. Check respawn time
      if (new Date() < node.respawnAt) {
        return { success: false, error: 'Resource node is not ready' };
      }

      // 4. Get character with inventory
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

      // 5. Check if we can stack with existing resource
      const existingSlot = character.inventory.find(
        (slot) => slot.itemInstance.templateId === node.resourceTemplateId
      );

      if (existingSlot) {
        // Stack with existing
        await tx.inventorySlot.update({
          where: { id: existingSlot.id },
           { quantity: existingSlot.quantity + 1 },
        });
      } else {
        // Need new slot
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

        // Create new item instance
        const newInstance = await tx.itemInstance.create({
           {
            templateId: node.resourceTemplateId,
            currentDurability: node.resourceTemplate.maxDurability,
          },
        });

        await tx.inventorySlot.create({
           {
            characterId,
            itemInstanceId: newInstance.id,
            quantity: 1,
            slotIndex: freeSlotIndex,
          },
        });
      }

      // 6. Deplete the node and set respawn time
      const respawnTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      await tx.resourceNode.update({
        where: { id: nodeId },
         {
          isDepleted: true,
          respawnAt: respawnTime,
        },
      });

      return { success: true };
    });
  } catch (error) {
    console.error('[World] Harvest error:', error);
    return { success: false, error: 'Harvest failed' };
  }
}

/**
 * Get all resource nodes in a zone
 */
export async function getResourceNodes(zone: string) {
  const nodes = await prisma.resourceNode.findMany({
    where: { zone },
    include: {
      resourceTemplate: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });

  return nodes.map((node) => ({
    id: node.id,
    x: node.x,
    y: node.y,
    templateId: node.resourceTemplateId,
    templateName: node.resourceTemplate.name,
    isDepleted: node.isDepleted,
    respawnAt: node.respawnAt.toISOString(),
  }));
}

/**
 * Get all dropped loot in a zone
 */
export async function getDroppedLoot(zone: string) {
  const loot = await prisma.droppedLoot.findMany({
    where: {
      zone,
      expiresAt: { gt: new Date() },
    },
    include: {
      itemInstance: {
        include: {
          template: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      },
    },
  });

  return loot.map((l) => ({
    id: l.id,
    x: l.x,
    y: l.y,
    itemTemplateId: l.itemInstance.templateId,
    itemName: l.itemInstance.template.name,
    quantity: l.quantity,
    expiresAt: l.expiresAt.toISOString(),
  }));
}
