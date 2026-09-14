import { prisma, withSerializableTransaction } from '../../services/prisma.js';
import { z } from 'zod';

const craftSchema = z.object({
  recipeId: z.string().uuid(),
});

const salvageSchema = z.object({
  slotIndex: z.number().int().min(0),
});

/**
 * Start crafting an item from recipe
 * CRITICAL: Validates slots, resources, knowledge
 */
export async function craftItem(
  characterId: string,
  payload: unknown
): Promise<{ success: boolean; error?: string }> {
  const parsed = craftSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { recipeId } = parsed.data;

  try {
    return await withSerializableTransaction(async (tx) => {
      // 1. Check player knows the recipe
      const knowledge = await tx.playerKnowledge.findUnique({
        where: {
          characterId,
          recipeId,
        },
      });

      if (!knowledge) {
        return { success: false, error: 'Recipe not learned' };
      }

      // 2. Get recipe with required resources
      const recipe = await tx.recipe.findUnique({
        where: { id: recipeId },
        include: {
          resultTemplate: true,
        },
      });

      if (!recipe) {
        return { success: false, error: 'Recipe not found' };
      }

      const requiredResources = recipe.requiredResources as Record<string, number>;

      // 3. Get character inventory
      const character = await tx.character.findUnique({
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
          bag: true,
        },
      });

      if (!character) {
        return { success: false, error: 'Character not found' };
      }

      const maxSlots = character.bag?.inventorySlots ?? 10;

      // 4. Check if player has all required resources
      const resourceMap = new Map<string, { slotId: string; quantity: number; remaining: number }>();
      
      for (const slot of character.inventory) {
        const templateId = slot.itemInstance.templateId;
        if (requiredResources[templateId]) {
          const existing = resourceMap.get(templateId);
          if (existing) {
            existing.quantity += slot.quantity;
          } else {
            resourceMap.set(templateId, {
              slotId: slot.id,
              quantity: slot.quantity,
              remaining: slot.quantity,
            });
          }
        }
      }

      // Verify all resources are present
      for (const [templateId, required] of Object.entries(requiredResources)) {
        const available = resourceMap.get(templateId);
        if (!available || available.quantity < required) {
          return { success: false, error: `Missing resource: ${templateId}` };
        }
      }

      // 5. Check free slots for result
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

      // 6. Consume resources
      for (const [templateId, required] of Object.entries(requiredResources)) {
        let remaining = required;
        
        for (const slot of character.inventory) {
          if (remaining <= 0) break;
          if (slot.itemInstance.templateId !== templateId) continue;

          if (slot.quantity <= remaining) {
            // Delete entire slot
            await tx.inventorySlot.delete({ where: { id: slot.id } });
            await tx.itemInstance.delete({ where: { id: slot.itemInstanceId } });
            remaining -= slot.quantity;
          } else {
            // Partial consume
            await tx.inventorySlot.update({
              where: { id: slot.id },
               { quantity: slot.quantity - remaining },
            });
            remaining = 0;
          }
        }
      }

      // 7. Create result item instance
      const resultInstance = await tx.itemInstance.create({
         {
          templateId: recipe.resultTemplateId,
          currentDurability: recipe.resultTemplate.maxDurability,
          customStats: recipe.resultTemplate.defaultStats,
        },
      });

      // 8. Add to inventory
      await tx.inventorySlot.create({
         {
          characterId,
          itemInstanceId: resultInstance.id,
          quantity: recipe.resultQuantity,
          slotIndex: freeSlotIndex,
        },
      });

      return { success: true };
    });
  } catch (error) {
    console.error('[Crafting] Craft error:', error);
    return { success: false, error: 'Crafting failed' };
  }
}

/**
 * Salvage (break down) an item into resources
 * CRITICAL: Cannot salvage equipped items
 */
export async function salvageItem(
  characterId: string,
  payload: unknown
): Promise<{ success: boolean; error?: string }> {
  const parsed = salvageSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { slotIndex } = parsed.data;

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

      // 2. CRITICAL: Check item is NOT in equipment
      const inEquipment = await tx.equipmentSlot.findFirst({
        where: {
          characterId,
          itemInstanceId: invSlot.itemInstanceId,
        },
      });

      if (inEquipment) {
        return { success: false, error: 'Cannot salvage equipped items' };
      }

      // 3. Get salvage yield
      const salvageYield = invSlot.itemInstance.template.salvageYield as Record<string, number> | null;
      
      if (!salvageYield || Object.keys(salvageYield).length === 0) {
        return { success: false, error: 'Item cannot be salvaged' };
      }

      // 4. Get character with inventory for slot checking
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
      const usedSlots = new Set(character.inventory.map((s) => s.slotIndex));
      
      // Remove current slot from used (it will be freed)
      usedSlots.delete(slotIndex);

      // 5. Check if we have enough free slots for all salvage results
      const resultCount = Object.keys(salvageYield).length;
      const freeSlots: number[] = [];
      
      for (let i = 0; i < maxSlots && freeSlots.length < resultCount; i++) {
        if (!usedSlots.has(i)) {
          freeSlots.push(i);
        }
      }

      if (freeSlots.length < resultCount) {
        return { success: false, error: 'Not enough inventory space for salvage results' };
      }

      // 6. Delete original item
      await tx.inventorySlot.delete({ where: { id: invSlot.id } });
      await tx.itemInstance.delete({ where: { id: invSlot.itemInstanceId } });

      // 7. Create salvage result items
      let slotIdx = 0;
      for (const [templateName, quantity] of Object.entries(salvageYield)) {
        // Find template by name
        const template = await tx.itemTemplate.findFirst({
          where: { name: templateName },
        });

        if (!template) continue;

        const newInstance = await tx.itemInstance.create({
           {
            templateId: template.id,
            currentDurability: template.maxDurability,
          },
        });

        await tx.inventorySlot.create({
           {
            characterId,
            itemInstanceId: newInstance.id,
            quantity,
            slotIndex: freeSlots[slotIdx]!,
          },
        });

        slotIdx++;
      }

      return { success: true };
    });
  } catch (error) {
    console.error('[Crafting] Salvage error:', error);
    return { success: false, error: 'Salvage failed' };
  }
}

/**
 * Get all recipes known by character
 */
export async function getKnownRecipes(characterId: string) {
  const knowledge = await prisma.playerKnowledge.findMany({
    where: { characterId },
    include: {
      recipe: {
        include: {
          resultTemplate: true,
        },
      },
    },
  });

  return knowledge.map((k) => ({
    id: k.recipe.id,
    name: k.recipe.name,
    requiredResources: k.recipe.requiredResources,
    resultTemplateId: k.recipe.resultTemplateId,
    resultTemplateName: k.recipe.resultTemplate.name,
    resultQuantity: k.recipe.resultQuantity,
  }));
}
