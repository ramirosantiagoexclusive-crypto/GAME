import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { config } from '../config/index.js';

// ============ Validation Schemas ============

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  characterName: z.string().min(3, 'Name must be at least 3 characters').max(20, 'Name must be at most 20 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// ============ Auth Service ============

export interface AuthResult {
  success: boolean;
  token?: string;
  character?: {
    id: string;
    name: string;
    x: number;
    y: number;
    zone: string;
    status: string;
    hp: number;
    maxHp: number;
    maxStashSlots: number;
  };
  error?: string;
}

export async function register(payload: unknown): Promise<AuthResult> {
  const parsed = registerSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' };
  }

  const { email, password, characterName } = parsed.data;

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return { success: false, error: 'Email already registered' };
  }

  // Check if character name already exists
  const existingCharacter = await prisma.character.findUnique({ where: { name: characterName } });
  if (existingCharacter) {
    return { success: false, error: 'Character name already taken' };
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user and character in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        characters: {
          create: {
            name: characterName,
            x: 0,
            y: 0,
            zone: 'hub',
            status: 'alive',
            hp: 100,
            maxHp: 100,
            maxStashSlots: 2,
          },
        },
      },
      include: {
        characters: true,
      },
    });

    return user;
  });

  const character = result.characters[0]!;

  // Generate JWT
  const token = jwt.sign(
    {
      userId: result.id,
      characterId: character.id,
      role: result.role,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  return {
    success: true,
    token,
    character: {
      id: character.id,
      name: character.name,
      x: character.x,
      y: character.y,
      zone: character.zone,
      status: character.status,
      hp: character.hp,
      maxHp: character.maxHp,
      maxStashSlots: character.maxStashSlots,
    },
  };
}

export async function login(payload: unknown): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' };
  }

  const { email, password } = parsed.data;

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    include: { characters: true },
  });

  if (!user) {
    return { success: false, error: 'Invalid credentials' };
  }

  // Verify password
  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    return { success: false, error: 'Invalid credentials' };
  }

  // Use first character (for now, multi-character support later)
  const character = user.characters[0];
  if (!character) {
    return { success: false, error: 'No character found' };
  }

  if (character.status === 'dead') {
    return { success: false, error: 'Character is dead. Please resurrect at hub.' };
  }

  // Generate JWT
  const token = jwt.sign(
    {
      userId: user.id,
      characterId: character.id,
      role: user.role,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  return {
    success: true,
    token,
    character: {
      id: character.id,
      name: character.name,
      x: character.x,
      y: character.y,
      zone: character.zone,
      status: character.status,
      hp: character.hp,
      maxHp: character.maxHp,
      maxStashSlots: character.maxStashSlots,
    },
  };
}
