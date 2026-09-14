import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { pickupLoot, equipItem, unequipItem, moveItem, dropItem, getInventory } from '../src/modules/inventory/service.js';
import {
  createTestUser,
  createTestTemplate,
  createTestItemInstance,
  createTestBag,
  addToInventory,
  createTestLoot,
  cleanupTestData,
} from './helpers.js';

describe('Inventory Service', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('getInventory', () => {
    it('should return empty inventory for new character', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');
      const result = await getInventory(character.id);

      expect(result.inventory).toHaveLength(0);
      expect(result.equipment).toHaveLength(0);
      expect(result.maxSlots).toBe(10); // default bag
    });

    it('should return inventory with items', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');
      const template = await createTestTemplate('Wood', 'resource');
      const instance = await createTestItemInstance(template.id);
      await addToInventory(character.id, instance.id, 0, 5);

      const result = await getInventory(character.id);

      expect(result.inventory).toHaveLength(1);
      expect(result.inventory[0]!.slotIndex).toBe(0);
      expect(result.inventory[0]!.quantity).toBe(5);
      expect(result.inventory[0]!.templateName).toBe('Wood');
    });

    it('should return equipment slots', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');
      const template = await createTestTemplate('Sword', 'weapon', {
        maxDurability: 100,
        defaultStats: { damage: 25 },
      });
      const instance = await createTestItemInstance(template.id, { currentDurability: 100 });

      // Add to equipment directly
      const { prisma } = await import('./setup.js');
      await prisma.equipmentSlot.create({
         {
          characterId: character.id,
          itemInstanceId: instance.id,
          slotType: 'weapon',
        },
      });

      const result = await getInventory(character.id);

      expect(result.equipment).toHaveLength(1);
      expect(result.equipment[0]!.slotType).toBe('weapon');
      expect(result.equipment[0]!.templateName).toBe('Sword');
      expect(result.equipment[0]!.durability).toBe(100);
    });
  });

  describe('pickupLoot', () => {
    it('should pickup loot successfully', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');
      const template = await createTestTemplate('Stone', 'resource');
      const instance = await createTestItemInstance(template.id);
      const loot = await createTestLoot(instance.id, 10, 20, 'hub');

      const result = await pickupLoot(character.id, { lootId: loot.id });

      expect(result.success).toBe(true);

      const inventory = await getInventory(character.id);
      expect(inventory.inventory).toHaveLength(1);
      expect(inventory.inventory[0]!.templateName).toBe('Stone');
    });

    it('should fail if loot does not exist', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');

      const result = await pickupLoot(character.id, {
        lootId: '00000000-0000-0000-0000-000000000000',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Loot not found');
    });

    it('should fail if inventory is full', async () => {
      const bag = await createTestBag('Small Bag', 2, 0);
      const { character } = await createTestUser('test@test.com', 'TestHero', { bagId: bag.id });

      // Fill inventory
      const template1 = await createTestTemplate('Item1', 'resource');
      const instance1 = await createTestItemInstance(template1.id);
      await addToInventory(character.id, instance1.id, 0);

      const template2 = await createTestTemplate('Item2', 'resource');
      const instance2 = await createTestItemInstance(template2.id);
      await addToInventory(character.id, instance2.id, 1);

      // Try to pickup more
      const template3 = await createTestTemplate('Item3', 'resource');
      const instance3 = await createTestItemInstance(template3.id);
      const loot = await createTestLoot(instance3.id, 10, 20, 'hub');

      const result = await pickupLoot(character.id, { lootId: loot.id });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Inventory is full');
    });

    it('should fail if loot is expired', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');
      const template = await createTestTemplate('Stone', 'resource');
      const instance = await createTestItemInstance(template.id);
      const loot = await createTestLoot(
        instance.id,
        10,
        20,
        'hub',
        1,
        new Date(Date.now() - 1000) // expired
      );

      const result = await pickupLoot(character.id, { lootId: loot.id });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Loot has expired');
    });
  });

  describe('equipItem', () => {
    it('should equip weapon successfully', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');
      const template = await createTestTemplate('Sword', 'weapon', {
        maxDurability: 100,
        defaultStats: { damage: 25 },
      });
      const instance = await createTestItemInstance(template.id, { currentDurability: 100 });
      await addToInventory(character.id, instance.id, 0);

      const result = await equipItem(character.id, {
        slotIndex: 0,
        equipmentSlot: 'weapon',
      });

      expect(result.success).toBe(true);

      const inventory = await getInventory(character.id);
      expect(inventory.inventory).toHaveLength(0);
      expect(inventory.equipment).toHaveLength(1);
      expect(inventory.equipment[0]!.slotType).toBe('weapon');
    });

    it('should fail if item type does not match slot', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');
      const template = await createTestTemplate('Wood', 'resource');
      const instance = await createTestItemInstance(template.id);
      await addToInventory(character.id, instance.id, 0);

      const result = await equipItem(character.id, {
        slotIndex: 0,
        equipmentSlot: 'weapon',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Item cannot be equipped in this slot');
    });

    it('should fail if equipment slot is occupied', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');
      const template1 = await createTestTemplate('Sword1', 'weapon');
      const instance1 = await createTestItemInstance(template1.id);
      await addToInventory(character.id, instance1.id, 0);

      const template2 = await createTestTemplate('Sword2', 'weapon');
      const instance2 = await createTestItemInstance(template2.id);
      await addToInventory(character.id, instance2.id, 1);

      // Equip first sword
      await equipItem(character.id, { slotIndex: 0, equipmentSlot: 'weapon' });

      // Try to equip second sword
      const result = await equipItem(character.id, {
        slotIndex: 1,
        equipmentSlot: 'weapon',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Equipment slot is already occupied');
    });
  });

  describe('unequipItem', () => {
    it('should unequip item to inventory', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');
      const template = await createTestTemplate('Sword', 'weapon');
      const instance = await createTestItemInstance(template.id);

      const { prisma } = await import('./setup.js');
      await prisma.equipmentSlot.create({
         {
          characterId: character.id,
          itemInstanceId: instance.id,
          slotType: 'weapon',
        },
      });

      const result = await unequipItem(character.id, { equipmentSlot: 'weapon' });

      expect(result.success).toBe(true);

      const inventory = await getInventory(character.id);
      expect(inventory.equipment).toHaveLength(0);
      expect(inventory.inventory).toHaveLength(1);
    });

    it('should fail if equipment slot is empty', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');

      const result = await unequipItem(character.id, { equipmentSlot: 'weapon' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('No item in this equipment slot');
    });

    it('should fail if inventory is full', async () => {
      const bag = await createTestBag('Small Bag', 1, 0);
      const { character } = await createTestUser('test@test.com', 'TestHero', { bagId: bag.id });

      // Fill inventory
      const template1 = await createTestTemplate('Item1', 'resource');
      const instance1 = await createTestItemInstance(template1.id);
      await addToInventory(character.id, instance1.id, 0);

      // Add weapon to equipment
      const template2 = await createTestTemplate('Sword', 'weapon');
      const instance2 = await createTestItemInstance(template2.id);
      const { prisma } = await import('./setup.js');
      await prisma.equipmentSlot.create({
         {
          characterId: character.id,
          itemInstanceId: instance2.id,
          slotType: 'weapon',
        },
      });

      const result = await unequipItem(character.id, { equipmentSlot: 'weapon' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Inventory is full');
    });
  });

  describe('moveItem', () => {
    it('should move item to empty slot', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');
      const template = await createTestTemplate('Wood', 'resource');
      const instance = await createTestItemInstance(template.id);
      await addToInventory(character.id, instance.id, 0);

      const result = await moveItem(character.id, { fromIndex: 0, toIndex: 5 });

      expect(result.success).toBe(true);

      const inventory = await getInventory(character.id);
      expect(inventory.inventory[0]!.slotIndex).toBe(5);
    });

    it('should swap items between slots', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');
      const template1 = await createTestTemplate('Wood', 'resource');
      const instance1 = await createTestItemInstance(template1.id);
      await addToInventory(character.id, instance1.id, 0);

      const template2 = await createTestTemplate('Stone', 'resource');
      const instance2 = await createTestItemInstance(template2.id);
      await addToInventory(character.id, instance2.id, 5);

      const result = await moveItem(character.id, { fromIndex: 0, toIndex: 5 });

      expect(result.success).toBe(true);

      const inventory = await getInventory(character.id);
      expect(inventory.inventory).toHaveLength(2);
      const slot0 = inventory.inventory.find((s) => s.slotIndex === 0);
      const slot5 = inventory.inventory.find((s) => s.slotIndex === 5);
      expect(slot0!.templateName).toBe('Stone');
      expect(slot5!.templateName).toBe('Wood');
    });

    it('should succeed if moving to same slot', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');
      const template = await createTestTemplate('Wood', 'resource');
      const instance = await createTestItemInstance(template.id);
      await addToInventory(character.id, instance.id, 0);

      const result = await moveItem(character.id, { fromIndex: 0, toIndex: 0 });

      expect(result.success).toBe(true);
    });

    it('should fail if source slot is empty', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');

      const result = await moveItem(character.id, { fromIndex: 0, toIndex: 5 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Source slot is empty');
    });
  });

  describe('dropItem', () => {
    it('should drop item successfully', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero', { x: 10, y: 20 });
      const template = await createTestTemplate('Wood', 'resource');
      const instance = await createTestItemInstance(template.id);
      await addToInventory(character.id, instance.id, 0, 5);

      const result = await dropItem(character.id, { slotIndex: 0, quantity: 3 });

      expect(result.success).toBe(true);
      expect(result.lootId).toBeDefined();

      const inventory = await getInventory(character.id);
      expect(inventory.inventory[0]!.quantity).toBe(2);

      const { prisma } = await import('./setup.js');
      const loot = await prisma.droppedLoot.findUnique({ where: { id: result.lootId! } });
      expect(loot).not.toBeNull();
      expect(loot!.quantity).toBe(3);
      expect(loot!.x).toBe(10);
      expect(loot!.y).toBe(20);
    });

    it('should delete slot if dropping all quantity', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');
      const template = await createTestTemplate('Wood', 'resource');
      const instance = await createTestItemInstance(template.id);
      await addToInventory(character.id, instance.id, 0, 5);

      const result = await dropItem(character.id, { slotIndex: 0, quantity: 5 });

      expect(result.success).toBe(true);

      const inventory = await getInventory(character.id);
      expect(inventory.inventory).toHaveLength(0);
    });

    it('should fail if quantity exceeds stack', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');
      const template = await createTestTemplate('Wood', 'resource');
      const instance = await createTestItemInstance(template.id);
      await addToInventory(character.id, instance.id, 0, 5);

      const result = await dropItem(character.id, { slotIndex: 0, quantity: 10 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Quantity exceeds item stack');
    });
  });
});
