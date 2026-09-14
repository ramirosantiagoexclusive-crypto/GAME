import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { attackTarget } from '../src/modules/combat/service.js';
import {
  createTestUser,
  createTestTemplate,
  createTestItemInstance,
  addToInventory,
  cleanupTestData,
} from './helpers.js';
import { prisma } from './setup.js';

describe('Combat Service', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('attackTarget - Player vs Player', () => {
    it('should attack player successfully in raid zone', async () => {
      const { character: attacker } = await createTestUser(
        'attacker@test.com',
        'Attacker',
        { zone: 'raid_zone_1', x: 10, y: 10 }
      );
      const { character: target } = await createTestUser(
        'target@test.com',
        'Target',
        { zone: 'raid_zone_1', x: 15, y: 15, hp: 100 }
      );

      const result = await attackTarget(attacker.id, { targetId: target.id });

      expect(result.success).toBe(true);
      expect(result.hit).toBeDefined();
      expect(result.hit!.damage).toBeGreaterThan(0);
      expect(result.hit!.targetHp).toBeLessThan(100);
      expect(result.hit!.killed).toBe(false);
    });

    it('should block PvP in hub zone', async () => {
      const { character: attacker } = await createTestUser(
        'attacker@test.com',
        'Attacker',
        { zone: 'hub', x: 0, y: 0 }
      );
      const { character: target } = await createTestUser(
        'target@test.com',
        'Target',
        { zone: 'hub', x: 5, y: 5 }
      );

      const result = await attackTarget(attacker.id, { targetId: target.id });

      expect(result.success).toBe(false);
      expect(result.error).toBe('PvP is disabled in hub');
    });

    it('should block attacking players in hub', async () => {
      const { character: attacker } = await createTestUser(
        'attacker@test.com',
        'Attacker',
        { zone: 'raid_zone_1', x: 10, y: 10 }
      );
      const { character: target } = await createTestUser(
        'target@test.com',
        'Target',
        { zone: 'hub', x: 0, y: 0 }
      );

      const result = await attackTarget(attacker.id, { targetId: target.id });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot attack players in hub');
    });

    it('should kill player and drop all loot', async () => {
      const { character: attacker } = await createTestUser(
        'attacker@test.com',
        'Attacker',
        { zone: 'raid_zone_1', x: 10, y: 10 }
      );
      const { character: target } = await createTestUser(
        'target@test.com',
        'Target',
        { zone: 'raid_zone_1', x: 15, y: 15, hp: 5 } // Low HP
      );

      // Add items to target inventory
      const template = await createTestTemplate('Sword', 'weapon');
      const instance = await createTestItemInstance(template.id);
      await addToInventory(target.id, instance.id, 0);

      // Add weapon to attacker for more damage
      const weaponTemplate = await createTestTemplate('Axe', 'weapon', {
        defaultStats: { damage: 100 },
      });
      const weaponInstance = await createTestItemInstance(weaponTemplate.id);
      await prisma.equipmentSlot.create({
         {
          characterId: attacker.id,
          itemInstanceId: weaponInstance.id,
          slotType: 'weapon',
        },
      });

      const result = await attackTarget(attacker.id, { targetId: target.id });

      expect(result.success).toBe(true);
      expect(result.hit!.killed).toBe(true);
      expect(result.hit!.targetHp).toBe(0);

      // Check target is dead
      const deadTarget = await prisma.character.findUnique({
        where: { id: target.id },
      });
      expect(deadTarget!.status).toBe('dead');
      expect(deadTarget!.hp).toBe(0);

      // Check loot was dropped
      const loot = await prisma.droppedLoot.findMany({
        where: { zone: 'raid_zone_1' },
      });
      expect(loot.length).toBeGreaterThan(0);

      // Check target inventory is empty
      const inventory = await prisma.inventorySlot.findMany({
        where: { characterId: target.id },
      });
      expect(inventory).toHaveLength(0);
    });

    it('should calculate damage with weapon stats', async () => {
      const { character: attacker } = await createTestUser(
        'attacker@test.com',
        'Attacker',
        { zone: 'raid_zone_1' }
      );
      const { character: target } = await createTestUser(
        'target@test.com',
        'Target',
        { zone: 'raid_zone_1', hp: 100 }
      );

      // Add powerful weapon to attacker
      const weaponTemplate = await createTestTemplate('Axe', 'weapon', {
        defaultStats: { damage: 50 },
      });
      const weaponInstance = await createTestItemInstance(weaponTemplate.id);
      await prisma.equipmentSlot.create({
         {
          characterId: attacker.id,
          itemInstanceId: weaponInstance.id,
          slotType: 'weapon',
        },
      });

      const result = await attackTarget(attacker.id, { targetId: target.id });

      expect(result.success).toBe(true);
      expect(result.hit!.damage).toBe(50);
    });

    it('should reduce damage with armor defense', async () => {
      const { character: attacker } = await createTestUser(
        'attacker@test.com',
        'Attacker',
        { zone: 'raid_zone_1' }
      );
      const { character: target } = await createTestUser(
        'target@test.com',
        'Target',
        { zone: 'raid_zone_1', hp: 100 }
      );

      // Add weapon to attacker
      const weaponTemplate = await createTestTemplate('Axe', 'weapon', {
        defaultStats: { damage: 50 },
      });
      const weaponInstance = await createTestItemInstance(weaponTemplate.id);
      await prisma.equipmentSlot.create({
         {
          characterId: attacker.id,
          itemInstanceId: weaponInstance.id,
          slotType: 'weapon',
        },
      });

      // Add armor to target
      const armorTemplate = await createTestTemplate('Armor', 'armor', {
        defaultStats: { defense: 20 },
      });
      const armorInstance = await createTestItemInstance(armorTemplate.id);
      await prisma.equipmentSlot.create({
         {
          characterId: target.id,
          itemInstanceId: armorInstance.id,
          slotType: 'armor',
        },
      });

      const result = await attackTarget(attacker.id, { targetId: target.id });

      expect(result.success).toBe(true);
      // Damage should be reduced: 50 - (20 * 0.5) = 40
      expect(result.hit!.damage).toBe(40);
    });
  });

  describe('attackTarget - Player vs NPC', () => {
    it('should attack NPC successfully', async () => {
      const { character: attacker } = await createTestUser(
        'attacker@test.com',
        'Attacker',
        { zone: 'raid_zone_1' }
      );

      // Create NPC
      const npc = await prisma.npc.create({
         {
          templateId: 'npc_template_1',
          zone: 'raid_zone_1',
          x: 20,
          y: 20,
          hp: 100,
          maxHp: 100,
          state: 'idle',
        },
      });

      const result = await attackTarget(attacker.id, { targetId: npc.id });

      expect(result.success).toBe(true);
      expect(result.hit!.damage).toBeGreaterThan(0);
      expect(result.hit!.targetHp).toBeLessThan(100);
    });

    it('should kill NPC and drop loot', async () => {
      const { character: attacker } = await createTestUser(
        'attacker@test.com',
        'Attacker',
        { zone: 'raid_zone_1' }
      );

      // Create NPC with low HP
      const npc = await prisma.npc.create({
         {
          templateId: 'npc_template_1',
          zone: 'raid_zone_1',
          x: 20,
          y: 20,
          hp: 5,
          maxHp: 100,
          state: 'idle',
        },
      });

      // Add item to NPC inventory
      const template = await createTestTemplate('Gold', 'resource');
      const instance = await createTestItemInstance(template.id);
      await prisma.npcInventorySlot.create({
         {
          npcId: npc.id,
          itemInstanceId: instance.id,
          quantity: 10,
        },
      });

      // Add powerful weapon to attacker
      const weaponTemplate = await createTestTemplate('Axe', 'weapon', {
        defaultStats: { damage: 100 },
      });
      const weaponInstance = await createTestItemInstance(weaponTemplate.id);
      await prisma.equipmentSlot.create({
         {
          characterId: attacker.id,
          itemInstanceId: weaponInstance.id,
          slotType: 'weapon',
        },
      });

      const result = await attackTarget(attacker.id, { targetId: npc.id });

      expect(result.success).toBe(true);
      expect(result.hit!.killed).toBe(true);

      // Check NPC is deleted
      const deletedNpc = await prisma.npc.findUnique({ where: { id: npc.id } });
      expect(deletedNpc).toBeNull();

      // Check loot was dropped
      const loot = await prisma.droppedLoot.findMany({
        where: { zone: 'raid_zone_1' },
      });
      expect(loot.length).toBeGreaterThan(0);
    });
  });

  describe('attackTarget - Edge Cases', () => {
    it('should fail if target does not exist', async () => {
      const { character: attacker } = await createTestUser(
        'attacker@test.com',
        'Attacker',
        { zone: 'raid_zone_1' }
      );

      const result = await attackTarget(attacker.id, {
        targetId: '00000000-0000-0000-0000-000000000000',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Target not found');
    });

    it('should use base damage if no weapon equipped', async () => {
      const { character: attacker } = await createTestUser(
        'attacker@test.com',
        'Attacker',
        { zone: 'raid_zone_1' }
      );
      const { character: target } = await createTestUser(
        'target@test.com',
        'Target',
        { zone: 'raid_zone_1', hp: 100 }
      );

      const result = await attackTarget(attacker.id, { targetId: target.id });

      expect(result.success).toBe(true);
      expect(result.hit!.damage).toBe(5); // base unarmed damage
    });

    it('should not allow attacking dead players', async () => {
      const { character: attacker } = await createTestUser(
        'attacker@test.com',
        'Attacker',
        { zone: 'raid_zone_1' }
      );
      const { character: target } = await createTestUser(
        'target@test.com',
        'Target',
        { zone: 'raid_zone_1', hp: 0 }
      );

      // Mark target as dead
      await prisma.character.update({
        where: { id: target.id },
         { status: 'dead' },
      });

      const result = await attackTarget(attacker.id, { targetId: target.id });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Target is not alive');
    });
  });
});
