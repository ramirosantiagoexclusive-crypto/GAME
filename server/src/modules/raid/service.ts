import { prisma, withSerializableTransaction } from '../../services/prisma.js';
import { z } from 'zod';
import { config } from '../../config/index.js';

const enterRaidSchema = z.object({
  zoneId: z.string(),
});

/**
 * Enter a raid zone
 * CRITICAL: Creates raid instance, teleports player, starts timer
 */
export async function enterRaid(
  characterId: string,
  payload: unknown
): Promise<{ success: boolean; error?: string; raidId?: string; endTime?: string }> {
  const parsed = enterRaidSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { zoneId } = parsed.data;

  try {
    return await withSerializableTransaction(async (tx) => {
      // 1. Get character
      const character = await tx.character.findUnique({
        where: { id: characterId },
      });

      if (!character) {
        return { success: false, error: 'Character not found' };
      }

      // 2. Check if already in a raid
      if (character.currentRaidId) {
        return { success: false, error: 'Already in a raid' };
      }

      // 3. Check if character is in hub (must start from hub)
      if (character.zone !== 'hub') {
        return { success: false, error: 'Must be in hub to enter raid' };
      }

      // 4. Check if character is alive
      if (character.status !== 'alive') {
        return { success: false, error: 'Character must be alive' };
      }

      // 5. Create or find active raid for this zone
      let raid = await tx.raidInstance.findFirst({
        where: {
          zoneId,
          status: 'active',
        },
      });

      if (!raid) {
        // Create new raid
        const endTime = new Date(Date.now() + config.timers.raidDuration * 1000);
        raid = await tx.raidInstance.create({
           {
            zoneId,
            startTime: new Date(),
            endTime,
            status: 'active',
          },
        });
      }

      // 6. Teleport character to raid zone
      await tx.character.update({
        where: { id: characterId },
         {
          zone: zoneId,
          x: 0,
          y: 0,
          currentRaidId: raid.id,
        },
      });

      return {
        success: true,
        raidId: raid.id,
        endTime: raid.endTime.toISOString(),
      };
    });
  } catch (error) {
    console.error('[Raid] Enter error:', error);
    return { success: false, error: 'Failed to enter raid' };
  }
}

/**
 * Extract from raid using portal stone
 * CRITICAL: Consumes portal stone, teleports to hub, keeps loot
 */
export async function extractFromRaid(
  characterId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    return await withSerializableTransaction(async (tx) => {
      // 1. Get character
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
        },
      });

      if (!character) {
        return { success: false, error: 'Character not found' };
      }

      // 2. Check if in raid
      if (!character.currentRaidId) {
        return { success: false, error: 'Not in a raid' };
      }

      // 3. CRITICAL: Check if in hub (portal stone only works in raid zones)
      if (character.zone === 'hub') {
        return { success: false, error: 'Portal stone only works in raid zones' };
      }

      // 4. Find portal stone in inventory
      const portalSlot = character.inventory.find(
        (slot) => slot.itemInstance.template.type === 'portal_stone'
      );

      if (!portalSlot) {
        return { success: false, error: 'No portal stone in inventory' };
      }

      // 5. CRITICAL: Consume portal stone (delete item instance)
      await tx.inventorySlot.delete({ where: { id: portalSlot.id } });
      await tx.itemInstance.delete({ where: { id: portalSlot.itemInstanceId } });

      // 6. Teleport to hub (keep all loot!)
      await tx.character.update({
        where: { id: characterId },
         {
          zone: 'hub',
          x: 0,
          y: 0,
          currentRaidId: null,
        },
      });

      return { success: true };
    });
  } catch (error) {
    console.error('[Raid] Extract error:', error);
    return { success: false, error: 'Extraction failed' };
  }
}

/**
 * Get current raid info for character
 */
export async function getCurrentRaid(characterId: string) {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: {
      currentRaid: true,
    },
  });

  if (!character?.currentRaid) {
    return null;
  }

  const raid = character.currentRaid;
  const now = new Date();
  const secondsRemaining = Math.max(0, Math.floor((raid.endTime.getTime() - now.getTime()) / 1000));

  return {
    raidId: raid.id,
    zoneId: raid.zoneId,
    status: raid.status,
    secondsRemaining,
    endTime: raid.endTime.toISOString(),
  };
}
