import { prisma } from '../../services/prisma.js';
import { z } from 'zod';
import { setLiveConfig, getLiveConfig } from '../../services/redis.js';

const spawnSchema = z.object({
  type: z.enum(['item', 'npc']),
  templateId: z.string().uuid(),
  x: z.number(),
  y: z.number(),
  zone: z.string(),
  quantity: z.number().int().min(1).optional(),
});

const configSchema = z.object({
  key: z.string(),
  value: z.unknown(),
});

const eventSchema = z.object({
  eventType: z.string(),
  duration: z.number().int().min(1),
});

/**
 * God Mode: Spawn items or NPCs
 */
export async function godSpawn(
  userId: string,
  payload: unknown
): Promise<{ success: boolean; error?: string }> {
  const parsed = spawnSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { type, templateId, x, y, zone, quantity = 1 } = parsed.data;

  try {
    if (type === 'item') {
      // Spawn item as dropped loot
      for (let i = 0; i < quantity; i++) {
        const instance = await prisma.itemInstance.create({
           {
            templateId,
            currentDurability: null,
          },
        });

        await prisma.droppedLoot.create({
           {
            itemInstanceId: instance.id,
            quantity: 1,
            x: x + (i * 0.5), // Spread items slightly
            y,
            zone,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
          },
        });
      }
    } else if (type === 'npc') {
      // Spawn NPC
      await prisma.npc.create({
         {
          templateId,
          zone,
          x,
          y,
          hp: 100,
          maxHp: 100,
          state: 'idle',
        },
      });
    }

    // Log god action
    await prisma.godAction.create({
       {
        userId,
        actionType: 'spawn',
        parameters: { type, templateId, x, y, zone, quantity },
      },
    });

    return { success: true };
  } catch (error) {
    console.error('[God] Spawn error:', error);
    return { success: false, error: 'Spawn failed' };
  }
}

/**
 * God Mode: Update live config
 */
export async function godConfig(
  userId: string,
  payload: unknown
): Promise<{ success: boolean; error?: string; config?: unknown }> {
  const parsed = configSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { key, value } = parsed.data;

  try {
    const current = await getLiveConfig();
    const updated = await setLiveConfig({ [key]: value });

    // Log god action
    await prisma.godAction.create({
       {
        userId,
        actionType: 'config',
        parameters: { key, value },
      },
    });

    return { success: true, config: updated };
  } catch (error) {
    console.error('[God] Config error:', error);
    return { success: false, error: 'Config update failed' };
  }
}

/**
 * God Mode: Trigger world event
 */
export async function godEvent(
  userId: string,
  payload: unknown
): Promise<{ success: boolean; error?: string }> {
  const parsed = eventSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { eventType, duration } = parsed.data;

  try {
    // Update live config with event
    await setLiveConfig({
      eventActive: true,
      eventType,
    });

    // Log god action
    await prisma.godAction.create({
       {
        userId,
        actionType: 'event',
        parameters: { eventType, duration },
      },
    });

    // Schedule event end (in production, use a proper job queue)
    setTimeout(async () => {
      await setLiveConfig({
        eventActive: false,
        eventType: undefined,
      });
    }, duration * 1000);

    return { success: true };
  } catch (error) {
    console.error('[God] Event error:', error);
    return { success: false, error: 'Event failed' };
  }
}

/**
 * Get all god actions (for audit log)
 */
export async function getGodActions(limit = 50) {
  const actions = await prisma.godAction.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: {
        select: { email: true },
      },
    },
  });

  return actions.map((a) => ({
    id: a.id,
    userEmail: a.user.email,
    actionType: a.actionType,
    parameters: a.parameters,
    createdAt: a.createdAt.toISOString(),
  }));
}
