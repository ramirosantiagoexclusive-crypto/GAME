import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config/index.js';
import { prisma } from './services/prisma.js';
import { redis } from './services/redis.js';
import { initCronJobs } from './services/cron.js';
import { authMiddleware } from './middleware/auth.js';
import {
  registerAuthHandlers,
  registerCharacterHandlers,
  handleDisconnect,
} from './socket/handlers.js';
import type { ClientToServerEvents, ServerToClientEvents } from './types/socket.js';

async function bootstrap(): Promise<void> {
  console.log('═══════════════════════════════════════════');
  console.log('  MMO Survival Server — Starting...');
  console.log('═══════════════════════════════════════════');

  // ============ Connect to services ============

  // Prisma
  await prisma.$connect();
  console.log('[Prisma] Connected to PostgreSQL');

  // Redis
  await redis.connect();
  console.log('[Redis] Connected');

  // ============ Initialize Express ============

  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // ============ Initialize Socket.io ============

  const httpServer = createServer(app);

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware for sockets
  io.use((socket, next) => {
    // Allow unauthenticated connections for register/login
    const token = socket.handshake.auth['token'];
    if (!token) {
      return next();
    }
    return authMiddleware(socket, next);
  });

  // Socket connection handler
  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    const authData = socket.data as { characterId?: string };

    // Join zone room if authenticated
    if (authData?.characterId) {
      prisma.character.findUnique({
        where: { id: authData.characterId },
        select: { zone: true },
      }).then((character) => {
        if (character) {
          socket.join(character.zone);
          console.log(`[Socket] ${authData.characterId} joined zone: ${character.zone}`);
        }
      }).catch(console.error);
    }

    // Register handlers
    registerAuthHandlers(io, socket);
    registerCharacterHandlers(io, socket);

    // Disconnect handler
    socket.on('disconnect', () => {
      handleDisconnect(io, socket);
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });

  // ============ Initialize Cron Jobs ============

  initCronJobs();

  // ============ Start Server ============

  httpServer.listen(config.port, () => {
    console.log('═══════════════════════════════════════════');
    console.log(`  Server running on port ${config.port}`);
    console.log(`  Environment: ${config.nodeEnv}`);
    console.log(`  CORS origin: ${config.corsOrigin}`);
    console.log('═══════════════════════════════════════════');
  });

  // ============ Graceful Shutdown ============

  const shutdown = async (signal: string) => {
    console.log(`\n[Server] ${signal} received. Shutting down gracefully...`);

    httpServer.close(() => {
      console.log('[Server] HTTP server closed');
    });

    io.close(() => {
      console.log('[Socket.io] All connections closed');
    });

    await prisma.$disconnect();
    console.log('[Prisma] Disconnected');

    await redis.quit();
    console.log('[Redis] Disconnected');

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  console.error('[Server] Fatal error during bootstrap:', error);
  process.exit(1);
});
