import { redis } from './redis.js';
import { prisma } from './prisma.js';

/**
 * Cache service for frequently accessed data
 * Reduces database load and improves response times
 */

// ============ Character Cache ============

const CHARACTER_CACHE_TTL = 60; // 1 minute

export async function getCachedCharacter(characterId: string) {
  const cacheKey = `character:${characterId}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }

  const character = await prisma.character.findUnique({
    where: { id: characterId },
    include: {
      bag: true,
    },
  });

  if (character) {
    await redis.set(
      cacheKey,
      JSON.stringify(character),
      'EX',
      CHARACTER_CACHE_TTL
    );
  }

  return character;
}

export async function invalidateCharacterCache(characterId: string) {
  await redis.del(`character:${characterId}`);
}

// ============ Item Template Cache ============

const TEMPLATE_CACHE_TTL = 3600; // 1 hour (templates rarely change)

export async function getCachedTemplate(templateId: string) {
  const cacheKey = `template:${templateId}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }

  const template = await prisma.itemTemplate.findUnique({
    where: { id: templateId },
  });

  if (template) {
    await redis.set(
      cacheKey,
      JSON.stringify(template),
      'EX',
      TEMPLATE_CACHE_TTL
    );
  }

  return template;
}

export async function getAllTemplatesByType(type: string) {
  const cacheKey = `templates:type:${type}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }

  const templates = await prisma.itemTemplate.findMany({
    where: { type },
  });

  await redis.set(
    cacheKey,
    JSON.stringify(templates),
    'EX',
    TEMPLATE_CACHE_TTL
  );

  return templates;
}

// ============ Recipe Cache ============

const RECIPE_CACHE_TTL = 3600; // 1 hour

export async function getCachedRecipe(recipeId: string) {
  const cacheKey = `recipe:${recipeId}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: {
      resultTemplate: true,
    },
  });

  if (recipe) {
    await redis.set(
      cacheKey,
      JSON.stringify(recipe),
      'EX',
      RECIPE_CACHE_TTL
    );
  }

  return recipe;
}

// ============ Zone Data Cache ============

const ZONE_DATA_CACHE_TTL = 30; // 30 seconds

export async function getCachedZoneData(zone: string) {
  const cacheKey = `zone:${zone}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }

  const [players, npcs, loot, resourceNodes] = await Promise.all([
    prisma.character.findMany({
      where: { zone, status: 'alive' },
      select: {
        id: true,
        name: true,
        x: true,
        y: true,
        hp: true,
        maxHp: true,
      },
    }),
    prisma.npc.findMany({
      where: { zone },
      select: {
        id: true,
        templateId: true,
        x: true,
        y: true,
        hp: true,
        maxHp: true,
        state: true,
      },
    }),
    prisma.droppedLoot.findMany({
      where: {
        zone,
        expiresAt: { gt: new Date() },
      },
      include: {
        itemInstance: {
          include: {
            template: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
      },
    }),
    prisma.resourceNode.findMany({
      where: { zone },
      include: {
        resourceTemplate: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    }),
  ]);

  const zoneData = {
    players: players.map((p) => ({
      characterId: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      hp: p.hp,
      maxHp: p.maxHp,
    })),
    npcs: npcs.map((n) => ({
      id: n.id,
      templateId: n.templateId,
      x: n.x,
      y: n.y,
      hp: n.hp,
      maxHp: n.maxHp,
      state: n.state,
    })),
    loot: loot.map((l) => ({
      id: l.id,
      x: l.x,
      y: l.y,
      itemTemplateId: l.itemInstance.templateId,
      itemName: l.itemInstance.template.name,
      quantity: l.quantity,
      expiresAt: l.expiresAt.toISOString(),
    })),
    resourceNodes: resourceNodes.map((n) => ({
      id: n.id,
      x: n.x,
      y: n.y,
      templateId: n.resourceTemplateId,
      templateName: n.resourceTemplate.name,
      isDepleted: n.isDepleted,
      respawnAt: n.respawnAt.toISOString(),
    })),
  };

  await redis.set(
    cacheKey,
    JSON.stringify(zoneData),
    'EX',
    ZONE_DATA_CACHE_TTL
  );

  return zoneData;
}

export async function invalidateZoneCache(zone: string) {
  await redis.del(`zone:${zone}`);
}

// ============ Online Players Cache ============

export async function getOnlinePlayersCount(): Promise<number> {
  const cacheKey = 'online_count';
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return parseInt(cached, 10);
  }

  const { getOnlineCount } = await import('./redis.js');
  const count = await getOnlineCount();

  await redis.set(cacheKey, count.toString(), 'EX', 10);

  return count;
}

// ============ Cache Invalidation ============

/**
 * Invalidate all caches related to a character
 */
export async function invalidateCharacterRelatedCaches(characterId: string) {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    select: { zone: true },
  });

  await invalidateCharacterCache(characterId);
  
  if (character) {
    await invalidateZoneCache(character.zone);
  }
}

/**
 * Clear all caches (for maintenance)
 */
export async function clearAllCaches() {
  const keys = await redis.keys('*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
