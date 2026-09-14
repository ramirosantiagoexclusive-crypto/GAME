import { prisma, withSerializableTransaction } from '../../services/prisma.js';
import { z } from 'zod';
import { config } from '../../config/index.js';

const attackSchema = z.object({
  targetId: z.string().uuid(),
});

/**
 * Attack a target (player or NPC)
 * CRITICAL: Validates zone (no PvP in hub), calculates damage
 */
export async function attackTarget(
  characterId: string,
  payload: unknown
): Promise<{
  success: boolean;
  error?: string;
  hit?: { damage: number; targetHp: number; killed: boolean };
}> {
  const parsed = attackSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  const { targetId } = parsed.data;

  try {
    return await withSerializableTransaction(async (tx) => {
      // 1. Get attacker
      const attacker = await tx.character.findUnique({
        where: { id: characterId },
        include: {
          equipment: {
            where: { slotType: 'weapon' },
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

      if (!attacker) {
        return { success: false, error: 'Attacker not found' };
      }

      // 2. CRITICAL: Check if attacker is in hub (no PvP allowed)
      if (attacker.zone === 'hub') {
        return { success: false, error: 'PvP is disabled in hub' };
      }

      // 3. Calculate base damage
      let baseDamage = 5; // unarmed
      const weapon = attacker.equipment[0];
      if (weapon) {
        const stats = weapon.itemInstance.template.defaultStats as { damage?: number } | null;
        baseDamage = stats?.damage ?? 10;
      }

      // Try to attack as player first
      const targetPlayer = await tx.character.findUnique({
        where: { id: targetId },
      });

      if (targetPlayer) {
        // Target is a player

        // 4. CRITICAL: Check if target is in hub (cannot be attacked)
        if (targetPlayer.zone === 'hub') {
          return { success: false, error: 'Cannot attack players in hub' };
        }

        // 5. Check target status
        if (targetPlayer.status !== 'alive') {
          return { success: false, error: 'Target is not alive' };
        }

        // 6. Get target equipment for defense
        const targetEquipment = await tx.equipmentSlot.findMany({
          where: {
            characterId: targetId,
            slotType: { in: ['armor', 'helmet'] },
          },
          include: {
            itemInstance: {
              include: {
                template: true,
              },
            },
          },
        });

        let totalDefense = 0;
        for (const eq of targetEquipment) {
          const stats = eq.itemInstance.template.defaultStats as { defense?: number } | null;
          totalDefense += stats?.defense ?? 0;
        }

        // 7. Calculate final damage
        const damage = Math.max(1, baseDamage - Math.floor(totalDefense * 0.5));

        // 8. Apply damage
        const newHp = Math.max(0, targetPlayer.hp - damage);
        const killed = newHp <= 0;

        await tx.character.update({
          where: { id: targetId },
           { hp: newHp },
        });

        // 9. If killed, handle death
        if (killed) {
          await handlePlayerDeath(tx, targetId, characterId);
        }

        return {
          success: true,
          hit: { damage, targetHp: newHp, killed },
        };
      }

      // Try to attack as NPC
      const targetNpc = await tx.npc.findUnique({
        where: { id: targetId },
      });

      if (targetNpc) {
        // Target is an NPC

        // 10. Calculate damage to NPC (no defense for simplicity)
        const damage = baseDamage;
        const newHp = Math.max(0, targetNpc.hp - damage);
        const killed = newHp <= 0;

        await tx.npc.update({
          where: { id: targetId },
           { hp: newHp },
        });

        // 11. If killed, drop loot
        if (killed) {
          await handleNpcDeath(tx, targetId, targetNpc.x, targetNpc.y, targetNpc.zone);
        }

        return {
          success: true,
          hit: { damage, targetHp: newHp, killed },
        };
      }

      return { success: false, error: 'Target not found' };
    });
  } catch (error) {
    console.error('[Combat] Attack error:', error);
    return { success: false, error: 'Attack failed' };
  }
}

/**
 * Handle player death - drop all inventory and equipment as loot
 */
async function handlePlayerDeath(
  tx: any,
  characterId: string,
  killerId: string
): Promise<void> {
  const character = await tx.character.findUnique({
    where: { id: characterId },
    include: {
      inventory: true,
      equipment: true,
    },
  });

  if (!character) return;

  // Drop all inventory as loot
  for (const slot of character.inventory) {
    await tx.droppedLoot.create({
       {
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

  // Drop all equipment as loot
  for (const slot of character.equipment) {
    await tx.droppedLoot.create({
       {
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

  // Mark character as dead
  await tx.character.update({
    where: { id: characterId },
     {
      status: 'dead',
      hp: 0,
    },
  });

  console.log(`[Combat] Player ${character.name} killed by ${killerId}`);
}

/**
 * Handle NPC death - drop inventory as loot
 */
async function handleNpcDeath(
  tx: any,
  npcId: string,
  x: number,
  y: number,
  zone: string
): Promise<void> {
  const npc = await tx.npc.findUnique({
    where: { id: npcId },
    include: {
      inventory: true,
    },
  });

  if (!npc) return;

  // Drop all NPC inventory as loot
  for (const slot of npc.inventory) {
    await tx.droppedLoot.create({
       {
        itemInstanceId: slot.itemInstanceId,
        quantity: slot.quantity,
        x,
        y,
        zone,
        expiresAt: new Date(Date.now() + config.timers.lootTtl * 1000),
      },
    });
    await tx.npcInventorySlot.delete({ where: { id: slot.id } });
  }

  // Delete NPC
  await tx.npc.delete({ where: { id: npcId } });

  console.log(`[Combat] NPC ${npcId} killed at ${x},${y} in ${zone}`);
}
