import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { craftItem, salvageItem } from '../src/modules/crafting/service.js';
import {
  createTestUser,
  createTestTemplate,
  createTestItemInstance,
  addToInventory,
  cleanupTestData,
} from './helpers.js';
import { prisma } from './setup.js';

describe('Crafting Service', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('craftItem', () => {
    it('should craft item successfully', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');

      // Create templates
      const woodTemplate = await createTestTemplate('Wood', 'resource');
      const stoneTemplate = await createTestTemplate('Stone', 'resource');
      const swordTemplate = await createTestTemplate('Sword', 'weapon', {
        maxDurability: 100,
        defaultStats: { damage: 25 },
      });

      // Create recipe
      const recipe = await prisma.recipe.create({
         {
          name: 'Wooden Sword',
          requiredResources: {
            [woodTemplate.id]: 5,
            [stoneTemplate.id]: 2,
          },
          resultTemplateId: swordTemplate.id,
          resultQuantity: 1,
        },
      });

      // Unlock recipe for character
      await prisma.playerKnowledge.create({
         {
          characterId: character.id,
          recipeId: recipe.id,
        },
      });

      // Add resources to inventory
      const woodInstance = await createTestItemInstance(woodTemplate.id);
      await addToInventory(character.id, woodInstance.id, 0, 10);

      const stoneInstance = await createTestItemInstance(stoneTemplate.id);
      await addToInventory(character.id, stoneInstance.id, 1, 5);

      const result = await craftItem(character.id, { recipeId: recipe.id });

      expect(result.success).toBe(true);

      // Check result item was created
      const inventory = await prisma.inventorySlot.findMany({
        where: { characterId: character.id },
        include: { itemInstance: { include: { template: true } } },
      });

      const sword = inventory.find((s) => s.itemInstance.template.type === 'weapon');
      expect(sword).toBeDefined();
      expect(sword!.itemInstance.template.name).toBe('Sword');
    });

    it('should fail if recipe not learned', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');

      const woodTemplate = await createTestTemplate('Wood', 'resource');
      const swordTemplate = await createTestTemplate('Sword', 'weapon');

      const recipe = await prisma.recipe.create({
         {
          name: 'Sword',
          requiredResources: { [woodTemplate.id]: 5 },
          resultTemplateId: swordTemplate.id,
          resultQuantity: 1,
        },
      });

      const result = await craftItem(character.id, { recipeId: recipe.id });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Recipe not learned');
    });

    it('should fail if missing resources', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');

      const woodTemplate = await createTestTemplate('Wood', 'resource');
      const stoneTemplate = await createTestTemplate('Stone', 'resource');
      const swordTemplate = await createTestTemplate('Sword', 'weapon');

      const recipe = await prisma.recipe.create({
         {
          name: 'Sword',
          requiredResources: {
            [woodTemplate.id]: 5,
            [stoneTemplate.id]: 10, // Need 10 stones
          },
          resultTemplateId: swordTemplate.id,
          resultQuantity: 1,
        },
      });

      await prisma.playerKnowledge.create({
         {
          characterId: character.id,
          recipeId: recipe.id,
        },
      });

      // Add only 3 stones (not enough)
      const woodInstance = await createTestItemInstance(woodTemplate.id);
      await addToInventory(character.id, woodInstance.id, 0, 10);

      const stoneInstance = await createTestItemInstance(stoneTemplate.id);
      await addToInventory(character.id, stoneInstance.id, 1, 3);

      const result = await craftItem(character.id, { recipeId: recipe.id });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing resource');
    });

    it('should fail if inventory is full', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');

      const woodTemplate = await createTestTemplate('Wood', 'resource');
      const swordTemplate = await createTestTemplate('Sword', 'weapon');

      const recipe = await prisma.recipe.create({
         {
          name: 'Sword',
          requiredResources: { [woodTemplate.id]: 1 },
          resultTemplateId: swordTemplate.id,
          resultQuantity: 1,
        },
      });

      await prisma.playerKnowledge.create({
         {
          characterId: character.id,
          recipeId: recipe.id,
        },
      });

      // Fill inventory (default 10 slots)
      for (let i = 0; i < 10; i++) {
        const template = await createTestTemplate(`Item${i}`, 'resource');
        const instance = await createTestItemInstance(template.id);
        await addToInventory(character.id, instance.id, i);
      }

      // Add wood in slot 10 (outside normal range, but let's test)
      const woodInstance = await createTestItemInstance(woodTemplate.id);
      await prisma.inventorySlot.create({
         {
          characterId: character.id,
          itemInstanceId: woodInstance.id,
          slotIndex: 10,
          quantity: 5,
        },
      });

      const result = await craftItem(character.id, { recipeId: recipe.id });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Inventory is full');
    });

    it('should consume resources correctly', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');

      const woodTemplate = await createTestTemplate('Wood', 'resource');
      const swordTemplate = await createTestTemplate('Sword', 'weapon');

      const recipe = await prisma.recipe.create({
         {
          name: 'Sword',
          requiredResources: { [woodTemplate.id]: 3 },
          resultTemplateId: swordTemplate.id,
          resultQuantity: 1,
        },
      });

      await prisma.playerKnowledge.create({
         {
          characterId: character.id,
          recipeId: recipe.id,
        },
      });

      const woodInstance = await createTestItemInstance(woodTemplate.id);
      await addToInventory(character.id, woodInstance.id, 0, 5);

      await craftItem(character.id, { recipeId: recipe.id });

      // Check wood was consumed
      const inventory = await prisma.inventorySlot.findMany({
        where: { characterId: character.id },
        include: { itemInstance: { include: { template: true } } },
      });

      const woodSlot = inventory.find((s) => s.itemInstance.template.name === 'Wood');
      expect(woodSlot).toBeDefined();
      expect(woodSlot!.quantity).toBe(2); // 5 - 3 = 2
    });
  });

  describe('salvageItem', () => {
    it('should salvage item successfully', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');

      const swordTemplate = await createTestTemplate('Sword', 'weapon', {
        salvageYield: { Wood: 3, Stone: 2 },
      });
      const swordInstance = await createTestItemInstance(swordTemplate.id);
      await addToInventory(character.id, swordInstance.id, 0);

      const result = await salvageItem(character.id, { slotIndex: 0 });

      expect(result.success).toBe(true);

      // Check sword was removed
      const inventory = await prisma.inventorySlot.findMany({
        where: { characterId: character.id },
        include: { itemInstance: { include: { template: true } } },
      });

      const sword = inventory.find((s) => s.itemInstance.template.name === 'Sword');
      expect(sword).toBeUndefined();

      // Check salvage results were added
      const wood = inventory.find((s) => s.itemInstance.template.name === 'Wood');
      const stone = inventory.find((s) => s.itemInstance.template.name === 'Stone');
      expect(wood).toBeDefined();
      expect(wood!.quantity).toBe(3);
      expect(stone).toBeDefined();
      expect(stone!.quantity).toBe(2);
    });

    it('should fail if item is equipped', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');

      const swordTemplate = await createTestTemplate('Sword', 'weapon', {
        salvageYield: { Wood: 3 },
      });
      const swordInstance = await createTestItemInstance(swordTemplate.id);

      // Equip the sword
      await prisma.equipmentSlot.create({
         {
          characterId: character.id,
          itemInstanceId: swordInstance.id,
          slotType: 'weapon',
        },
      });

      const result = await salvageItem(character.id, { slotIndex: 0 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot salvage equipped items');
    });

    it('should fail if item has no salvage yield', async () => {
      const { character } = await createTestUser('test@test.com', 'TestHero');

      const template = await createTestTemplate('Wood', 'resource'); // No salvage yield
      const instance = await createTestItemInstance(template.id);
      await addToInventory(character.id, instance.id, 0);

      const result = await salvageItem(character.id, { slotIndex: 0 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Item cannot be salvaged');
    });

    it('should fail if not enough inventory space for results', async () => {
      const bag = await import('./helpers.js').then((h) =>
        h.createTestBag('Small Bag', 2, 0)
      );
      const { character } = await createTestUser('test@test.com', 'TestHero', {
        bagId: bag.id,
      });

      const swordTemplate = await createTestTemplate('Sword', 'weapon', {
        salvageYield: { Wood: 3, Stone: 2, Iron: 1 }, // 3 results
      });
      const swordInstance = await createTestItemInstance(swordTemplate.id);
      await addToInventory(character.id, swordInstance.id, 0);

      // Fill remaining slot
      const otherTemplate = await createTestTemplate('Other', 'resource');
      const otherInstance = await createTestItemInstance(otherTemplate.id);
      await addToInventory(character.id, otherInstance.id, 1);

      const result = await salvageItem(character.id, { slotIndex: 0 });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not enough inventory space for salvage results');
    });
  });
});
