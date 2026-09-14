import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed(): Promise<void> {
  console.log('🌱 Seeding database...');

  // ============ Create God User ============
  const godPasswordHash = await bcrypt.hash('god12345', 12);
  const godUser = await prisma.user.upsert({
    where: { email: 'god@mmo.local' },
    update: {},
    create: {
      email: 'god@mmo.local',
      passwordHash: godPasswordHash,
      role: 'god',
    },
  });
  console.log(`✅ God user created: ${godUser.email}`);

  // ============ Create World State ============
  await prisma.worldState.upsert({
    where: { id: 'global' },
    update: {},
    create: {
      id: 'global',
      currentTick: 0,
      globalBuffs: {},
    },
  });
  console.log('✅ World state initialized');

  // ============ Create Bags ============
  const bags = await Promise.all([
    prisma.bag.create({ data: { name: 'Cloth Pouch', tier: 1, inventorySlots: 10, stashUnlock: 2 } }),
    prisma.bag.create({ data: { name: 'Leather Satchel', tier: 2, inventorySlots: 16, stashUnlock: 4 } }),
    prisma.bag.create({ data: { name: 'Explorer Backpack', tier: 3, inventorySlots: 24, stashUnlock: 8 } }),
    prisma.bag.create({ data: { name: 'Void Container', tier: 4, inventorySlots: 32, stashUnlock: 12 } }),
  ]);
  console.log(`✅ ${bags.length} bags created`);

  // ============ Create Item Templates ============
  const templates = await Promise.all([
    // Resources
    prisma.itemTemplate.create({
      data: {
        name: 'Wood',
        type: 'resource',
        salvageYield: null,
      },
    }),
    prisma.itemTemplate.create({
      data: {
        name: 'Stone',
        type: 'resource',
        salvageYield: null,
      },
    }),
    prisma.itemTemplate.create({
      data: {
        name: 'Iron Ore',
        type: 'resource',
        salvageYield: null,
      },
    }),
    prisma.itemTemplate.create({
      data: {
        name: 'Herb',
        type: 'resource',
        salvageYield: null,
      },
    }),

    // Weapons
    prisma.itemTemplate.create({
      data: {
        name: 'Wooden Sword',
        type: 'weapon',
        maxDurability: 50,
        defaultStats: { damage: 10, speed: 1.2 },
        salvageYield: { wood: 3 },
      },
    }),
    prisma.itemTemplate.create({
      data: {
        name: 'Iron Sword',
        type: 'weapon',
        maxDurability: 100,
        defaultStats: { damage: 25, speed: 1.0 },
        salvageYield: { iron: 5, wood: 1 },
      },
    }),

    // Armor
    prisma.itemTemplate.create({
      data: {
        name: 'Leather Armor',
        type: 'armor',
        maxDurability: 80,
        defaultStats: { defense: 15, weight: 5 },
        salvageYield: { leather: 4 },
      },
    }),
    prisma.itemTemplate.create({
      data: {
        name: 'Iron Helmet',
        type: 'helmet',
        maxDurability: 60,
        defaultStats: { defense: 10, weight: 3 },
        salvageYield: { iron: 3 },
      },
    }),

    // Consumables
    prisma.itemTemplate.create({
      data: {
        name: 'Health Potion',
        type: 'consumable',
        defaultStats: { healAmount: 30 },
        salvageYield: null,
      },
    }),

    // Portal Stone
    prisma.itemTemplate.create({
      data: {
        name: 'Portal Stone',
        type: 'portal_stone',
        salvageYield: null,
      },
    }),
  ]);
  console.log(`✅ ${templates.length} item templates created`);

  // ============ Create Recipes ============
  const woodTemplate = templates[0]!;
  const stoneTemplate = templates[1]!;
  const ironTemplate = templates[2]!;
  const herbTemplate = templates[3]!;
  const woodenSword = templates[4]!;
  const ironSword = templates[5]!;
  const leatherArmor = templates[6]!;
  const healthPotion = templates[8]!;
  const portalStone = templates[9]!;

  const recipes = await Promise.all([
    prisma.recipe.create({
      data: {
        name: 'Wooden Sword',
        requiredResources: { [woodTemplate.id]: 5, [stoneTemplate.id]: 2 },
        resultTemplateId: woodenSword.id,
        resultQuantity: 1,
      },
    }),
    prisma.recipe.create({
      data: {
        name: 'Iron Sword',
        requiredResources: { [ironTemplate.id]: 8, [woodTemplate.id]: 2 },
        resultTemplateId: ironSword.id,
        resultQuantity: 1,
      },
    }),
    prisma.recipe.create({
      data: {
        name: 'Health Potion',
        requiredResources: { [herbTemplate.id]: 3 },
        resultTemplateId: healthPotion.id,
        resultQuantity: 2,
      },
    }),
    prisma.recipe.create({
      data: {
        name: 'Portal Stone',
        requiredResources: { [stoneTemplate.id]: 10, [ironTemplate.id]: 5 },
        resultTemplateId: portalStone.id,
        resultQuantity: 1,
      },
    }),
  ]);
  console.log(`✅ ${recipes.length} recipes created`);

  // ============ Create Resource Nodes in Hub ============
  const hubNodes = [
    { x: 10, y: 10, template: woodTemplate },
    { x: 15, y: 5, template: woodTemplate },
    { x: -10, y: 10, template: stoneTemplate },
    { x: -15, y: -5, template: stoneTemplate },
    { x: 20, y: -10, template: ironTemplate },
    { x: -20, y: 15, template: herbTemplate },
    { x: 5, y: -20, template: herbTemplate },
  ];

  for (const node of hubNodes) {
    await prisma.resourceNode.create({
      data: {
        zone: 'hub',
        x: node.x,
        y: node.y,
        resourceTemplateId: node.template.id,
        respawnAt: new Date(),
        isDepleted: false,
      },
    });
  }
  console.log(`✅ ${hubNodes.length} resource nodes spawned in hub`);

  // ============ Create Test Player ============
  const playerPasswordHash = await bcrypt.hash('player12345', 12);
  const testPlayer = await prisma.user.upsert({
    where: { email: 'player@test.local' },
    update: {},
    create: {
      email: 'player@test.local',
      passwordHash: playerPasswordHash,
      role: 'player',
      characters: {
        create: {
          name: 'TestHero',
          x: 0,
          y: 0,
          zone: 'hub',
          status: 'alive',
          hp: 100,
          maxHp: 100,
          maxStashSlots: 2,
          bagId: bags[0]!.id,
        },
      },
    },
    include: { characters: true },
  });
  console.log(`✅ Test player created: ${testPlayer.email} (character: ${testPlayer.characters[0]?.name})`);

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Test credentials:');
  console.log('   Player: player@test.local / player12345');
  console.log('   God:    god@mmo.local / god12345');
}

seed()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
