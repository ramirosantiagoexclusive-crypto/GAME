import cron from 'node-cron';
import { prisma } from './prisma.js';
import { config } from '../config/index.js';
import { isPlayerAfk } from './redis.js';

/**
 * Initialize all cron jobs.
 */
export function initCronJobs(): void {
  console.log('[Cron] Initializing scheduled jobs...');

  // Every minute: Check AFK players in raid
  cron.schedule('* * * * *', async () => {
    await checkRaidAfk();
  });

  // Every minute: Check AFK players in hub
  cron.schedule('* * * * *', async () => {
    await checkHubAfk();
  });

  // Every 2 minutes: Clean expired loot
  cron.schedule('*/2 * * * *', async () => {
    await cleanExpiredLoot();
  });

  // Every minute: Respawn resource nodes
  cron.schedule('* * * * *', async () => {
    await respawnResourceNodes();
  });

  // Every minute: Check ended raids
  cron.schedule('* * * * *', async () => {
    await checkEndedRaids();
  });

  console.log('[Cron] All jobs scheduled successfully');
}

/**
 * Check AFK players in raid zones.
 * If AFK for more than AFK_RAID_TIMEOUT seconds:
 * - Teleport to hub
 * - Drop all inventory and equipment as DroppedLoot
 */
async function checkRaidAfk(): Promise<void> {
  try {
    const afkThreshold = new Date(Date.now() - config.timers.afkRaidTimeout * 1000);

    const afkCharacters = await prisma.character.findMany({
      where: {
        status: 'afk',
        zone: { not: 'hub' },
        afkSince: { not: null, lt: afkThreshold },
      },
      include: {
        inventory: { include: { itemInstance: true } },
        equipment: { include: { itemInstance: true } },
      },
    });

    for (const character of afkCharacters) {
      console.log(`[Cron] AFK raid timeout for: ${character.name}`);

      await prisma.$transaction(async (tx) => {
        // Drop inventory as loot
        for (const slot of character.inventory) {
          await tx.droppedLoot.create({
            data: {
              itemInstanceId: slot.itemInstanceId,
              quantity: slot.quantity,
              x: character.x,
              y: character.y,
              zone: character.zone,
              expiresAt: new Date(Date.now() + config.timers.lootTtl * 1000),
            },
          });
          await tx.inventorySlot.delete({ where: { id: slot.id } });
        }

        // Drop equipment as loot
        for (const slot of character.equipment) {
          await tx.droppedLoot.create({
            data: {
              itemInstanceId: slot.itemInstanceId,
              quantity: slot.quantity,
              x: character.x,
              y: character.y,
              zone: character.zone,
              expiresAt: new Date(Date.now() + config.timers.lootTtl * 1000),
            },
          });
          await tx.equipmentSlot.delete({ where: { id: slot.id } });
        }

        // Teleport to hub
        await tx.character.update({
          where: { id: character.id },
          data: {
            x: 0,
            y: 0,
            zone: 'hub',
            status: 'alive',
            afkSince: null,
            currentRaidId: null,
          },
        });
      });
    }
  } catch (error) {
    console.error('[Cron] checkRaidAfk error:', error);
  }
}

/**
 * Check AFK players in hub.
 * If AFK for more than AFK_HUB_TIMEOUT seconds:
 * - Safe logout (save coordinates)
 */
async function checkHubAfk(): Promise<void> {
  try {
    const afkThreshold = new Date(Date.now() - config.timers.afkHubTimeout * 1000);

    const afkCharacters = await prisma.character.findMany({
      where: {
        status: 'afk',
        zone: 'hub',
        afkSince: { not: null, lt: afkThreshold },
      },
    });

    for (const character of afkCharacters) {
      console.log(`[Cron] AFK hub timeout for: ${character.name} — safe logout`);

      await prisma.character.update({
        where: { id: character.id },
        data: {
          status: 'alive',
          afkSince: null,
        },
      });
    }
  } catch (error) {
    console.error('[Cron] checkHubAfk error:', error);
  }
}

/**
 * Clean expired loot from database.
 */
async function cleanExpiredLoot(): Promise<void> {
  try {
    const now = new Date();

    const expiredLoot = await prisma.droppedLoot.findMany({
      where: { expiresAt: { lt: now } },
      select: { id: true, itemInstanceId: true },
    });

    if (expiredLoot.length === 0) return;

    await prisma.$transaction(async (tx) => {
      // Delete item instances
      for (const loot of expiredLoot) {
        await tx.itemInstance.delete({ where: { id: loot.itemInstanceId } });
      }
      // Delete loot entries
      await tx.droppedLoot.deleteMany({
        where: { id: { in: expiredLoot.map((l) => l.id) } },
      });
    });

    console.log(`[Cron] Cleaned ${expiredLoot.length} expired loot items`);
  } catch (error) {
    console.error('[Cron] cleanExpiredLoot error:', error);
  }
}

/**
 * Respawn depleted resource nodes.
 */
async function respawnResourceNodes(): Promise<void> {
  try {
    const now = new Date();

    const result = await prisma.resourceNode.updateMany({
      where: {
        isDepleted: true,
        respawnAt: { lte: now },
      },
      data: {
        isDepleted: false,
      },
    });

    if (result.count > 0) {
      console.log(`[Cron] Respawned ${result.count} resource nodes`);
    }
  } catch (error) {
    console.error('[Cron] respawnResourceNodes error:', error);
  }
}

/**
 * Check and end expired raids.
 */
async function checkEndedRaids(): Promise<void> {
  try {
    const now = new Date();

    const expiredRaids = await prisma.raidInstance.findMany({
      where: {
        status: 'active',
        endTime: { lte: now },
      },
    });

    for (const raid of expiredRaids) {
      console.log(`[Cron] Raid ended: ${raid.id}`);

      await prisma.raidInstance.update({
        where: { id: raid.id },
        data: { status: 'ended' },
      });

      // Force-extract remaining characters to hub
      await prisma.character.updateMany({
        where: { currentRaidId: raid.id },
        data: {
          x: 0,
          y: 0,
          zone: 'hub',
          currentRaidId: null,
        },
      });
    }
  } catch (error) {
    console.error('[Cron] checkEndedRaids error:', error);
  }
}
