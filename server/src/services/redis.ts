import Redis from 'ioredis';
import { config } from '../config/index.js';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    lazyConnect: true,
  });

if (config.nodeEnv !== 'production') {
  globalForRedis.redis = redis;
}

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

redis.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

// ============ Live Config (God Mode) ============

const LIVE_CONFIG_KEY = 'live_config';

export interface LiveConfig {
  globalBuffs: Record<string, number>;
  spawnRates: Record<string, number>;
  eventActive: boolean;
  eventType?: string;
  lastUpdated: string;
}

const DEFAULT_LIVE_CONFIG: LiveConfig = {
  globalBuffs: {},
  spawnRates: {},
  eventActive: false,
  lastUpdated: new Date().toISOString(),
};

export async function getLiveConfig(): Promise<LiveConfig> {
  const cached = await redis.get(LIVE_CONFIG_KEY);
  if (cached) {
    return JSON.parse(cached) as LiveConfig;
  }
  return DEFAULT_LIVE_CONFIG;
}

export async function setLiveConfig(config: Partial<LiveConfig>): Promise<LiveConfig> {
  const current = await getLiveConfig();
  const updated: LiveConfig = {
    ...current,
    ...config,
    lastUpdated: new Date().toISOString(),
  };
  await redis.set(LIVE_CONFIG_KEY, JSON.stringify(updated));
  return updated;
}

// ============ Online Players Cache ============

const ONLINE_PLAYERS_KEY = 'online_players';

export async function setPlayerOnline(characterId: string, socketId: string): Promise<void> {
  await redis.hset(ONLINE_PLAYERS_KEY, characterId, socketId);
}

export async function setPlayerOffline(characterId: string): Promise<void> {
  await redis.hdel(ONLINE_PLAYERS_KEY, characterId);
}

export async function getOnlinePlayers(): Promise<Record<string, string>> {
  return redis.hgetall(ONLINE_PLAYERS_KEY);
}

export async function getOnlineCount(): Promise<number> {
  return redis.hlen(ONLINE_PLAYERS_KEY);
}

// ============ AFK Timer Cache ============

export async function setAfkTimer(characterId: string, timeoutSeconds: number): Promise<void> {
  await redis.set(`afk:${characterId}`, '1', 'EX', timeoutSeconds);
}

export async function clearAfkTimer(characterId: string): Promise<void> {
  await redis.del(`afk:${characterId}`);
}

export async function isPlayerAfk(characterId: string): Promise<boolean> {
  const result = await redis.get(`afk:${characterId}`);
  return result !== null;
}

// ============ Rate Limiting ============

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const redisKey = `ratelimit:${key}`;
  const current = await redis.get(redisKey);
  
  if (current === null) {
    await redis.set(redisKey, '1', 'EX', windowSeconds);
    return { allowed: true, remaining: maxRequests - 1 };
  }
  
  const count = parseInt(current, 10);
  if (count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }
  
  const newCount = await redis.incr(redisKey);
  return { allowed: true, remaining: maxRequests - newCount };
}
