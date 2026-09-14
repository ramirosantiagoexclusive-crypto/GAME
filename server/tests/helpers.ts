import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Создать тестового пользователя с персонажем
 */
export async function createTestUser(
  email: string,
  characterName: string,
  options: {
    zone?: string;
    x?: number;
    y?: number;
    hp?: number;
    maxStashSlots?: number;
    bagId?: string;
  } = {}
) {
  const passwordHash = await bcrypt.hash('test12345', 10);

  const user = await prisma.user.create({
     {
      email,
      passwordHash,
      characters: {
        create: {
          name: characterName,
          zone: options.zone ?? 'hub',
          x: options.x ?? 0,
          y: options.y ?? 0,
          hp: options.hp ?? 100,
          maxHp: 100,
          maxStashSlots: options.maxStashSlots ?? 2,
          bagId: options.bagId,
        },
      },
    },
    include: {
      characters: true,
    },
  });

  return {
    user,
    character: user.characters[0]!,
  };
}

/**
 * Создать тестовый шаблон предмета
 */
export async function createTestTemplate(
  name: string,
  type: string,
  options: {
    maxDurability?: number;
    defaultStats?: Record<string, number>;
    salvageYield?: Record<string, number>;
  } = {}
) {
  return prisma.itemTemplate.create({
     {
      name,
      type,
      maxDurability: options.maxDurability,
      defaultStats: options.defaultStats ?? undefined,
      salvageYield: options.salvageYield ?? undefined,
    },
  });
}

/**
 * Создать тестовый экземпляр предмета
 */
export async function createTestItemInstance(
  templateId: string,
  options: {
    currentDurability?: number;
    customStats?: Record<string, number>;
  } = {}
) {
  return prisma.itemInstance.create({
     {
      templateId,
      currentDurability: options.currentDurability,
      customStats: options.customStats ?? undefined,
    },
  });
}

/**
 * Создать тестовую сумку
 */
export async function createTestBag(
  name: string,
  inventorySlots: number,
  stashUnlock: number,
  tier = 1
) {
  return prisma.bag.create({
     {
      name,
      tier,
      inventorySlots,
      stashUnlock,
    },
  });
}

/**
 * Добавить предмет в инвентарь персонажа
 */
export async function addToInventory(
  characterId: string,
  itemInstanceId: string,
  slotIndex: number,
  quantity = 1
) {
  return prisma.inventorySlot.create({
     {
      characterId,
      itemInstanceId,
      slotIndex,
      quantity,
    },
  });
}

/**
 * Создать тестовый лут на земле
 */
export async function createTestLoot(
  itemInstanceId: string,
  x: number,
  y: number,
  zone: string,
  quantity = 1,
  expiresAt?: Date
) {
  return prisma.droppedLoot.create({
     {
      itemInstanceId,
      quantity,
      x,
      y,
      zone,
      expiresAt: expiresAt ?? new Date(Date.now() + 10 * 60 * 1000),
    },
  });
}

/**
 * Очистить тестовые данные
 */
export async function cleanupTestData() {
  await prisma.droppedLoot.deleteMany();
  await prisma.inventorySlot.deleteMany();
  await prisma.equipmentSlot.deleteMany();
  await prisma.stashSlot.deleteMany();
  await prisma.itemInstance.deleteMany();
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
  await prisma.itemTemplate.deleteMany();
  await prisma.bag.deleteMany();
  await prisma.resourceNode.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.playerKnowledge.deleteMany();
}
