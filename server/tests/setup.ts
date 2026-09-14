import { beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Создаем тестовую базу данных
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  } catch (error) {
    console.error('Failed to run migrations:', error);
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Очищаем базу перед каждым тестом
  await prisma.droppedLoot.deleteMany();
  await prisma.inventorySlot.deleteMany();
  await prisma.equipmentSlot.deleteMany();
  await prisma.stashSlot.deleteMany();
  await prisma.itemInstance.deleteMany();
  await prisma.character.deleteMany();
  await prisma.user.deleteMany();
  await prisma.itemTemplate.deleteMany();
  await prisma.bag.deleteMany();
});

export { prisma };
