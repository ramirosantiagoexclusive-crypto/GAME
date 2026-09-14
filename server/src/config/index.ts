import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  corsOrigin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',

  jwt: {
    secret: process.env['JWT_SECRET'] ?? 'dev-secret-change-me',
    expiresIn: process.env['JWT_EXPIRES_IN'] ?? '7d',
  },

  redis: {
    url: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
  },

  timers: {
    afkRaidTimeout: parseInt(process.env['AFK_RAID_TIMEOUT'] ?? '120', 10),
    afkHubTimeout: parseInt(process.env['AFK_HUB_TIMEOUT'] ?? '300', 10),
    lootTtl: parseInt(process.env['LOOT_TTL'] ?? '600', 10),
    raidDuration: parseInt(process.env['RAID_DURATION'] ?? '900', 10),
  },
} as const;

export type Config = typeof config;
