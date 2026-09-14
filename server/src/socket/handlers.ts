import { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketAuthData } from '../../types/socket.js';
import { register, login } from '../auth/service.js';
import { setPlayerOnline, setPlayerOffline } from '../../services/redis.js';
import { prisma } from '../../services/prisma.js';

export function registerAuthHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>
): void {
  /**
   * Register new account + first character
   */
  socket.on('auth:register', async (payload) => {
    try {
      const result = await register(payload);

      if (!result.success || !result.token || !result.character) {
        socket.emit('auth:error', { message: result.error ?? 'Registration failed' });
        return;
      }

      // Update socket auth data
      const decoded = (await import('jsonwebtoken')).default.verify(
        result.token,
        (await import('../../config/index.js')).config.jwt.secret
      ) as { userId: string; characterId: string; role: string };

      socket.data = {
        userId: decoded.userId,
        characterId: decoded.characterId,
        role: decoded.role,
      } as SocketAuthData;

      // Mark player online
      await setPlayerOnline(result.character.id, socket.id);

      socket.emit('auth:success', { token: result.token, character: result.character });
      console.log(`[Auth] New player registered: ${result.character.name}`);
    } catch (error) {
      console.error('[Auth] Register error:', error);
      socket.emit('auth:error', { message: 'Internal server error' });
    }
  });

  /**
   * Login existing account
   */
  socket.on('auth:login', async (payload) => {
    try {
      const result = await login(payload);

      if (!result.success || !result.token || !result.character) {
        socket.emit('auth:error', { message: result.error ?? 'Login failed' });
        return;
      }

      // Update socket auth data
      const decoded = (await import('jsonwebtoken')).default.verify(
        result.token,
        (await import('../../config/index.js')).config.jwt.secret
      ) as { userId: string; characterId: string; role: string };

      socket.data = {
        userId: decoded.userId,
        characterId: decoded.characterId,
        role: decoded.role,
      } as SocketAuthData;

      // Mark player online
      await setPlayerOnline(result.character.id, socket.id);

      socket.emit('auth:success', { token: result.token, character: result.character });
      console.log(`[Auth] Player logged in: ${result.character.name}`);
    } catch (error) {
      console.error('[Auth] Login error:', error);
      socket.emit('auth:error', { message: 'Internal server error' });
    }
  });
}

export function registerCharacterHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>
): void {
  /**
   * Character movement
   * Server validates and broadcasts to zone
   */
  socket.on('character:move', async (payload) => {
    const authData = socket.data as SocketAuthData;
    if (!authData?.characterId) {
      socket.emit('system:error', { code: 'UNAUTHORIZED', message: 'Not authenticated' });
      return;
    }

    try {
      const { x, y } = payload;

      // Basic validation
      if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
        socket.emit('system:error', { code: 'INVALID_INPUT', message: 'Invalid coordinates' });
        return;
      }

      // Clamp to reasonable bounds (prevent teleport hacks)
      const clampedX = Math.max(-10000, Math.min(10000, x));
      const clampedY = Math.max(-10000, Math.min(10000, y));

      // Update position in DB
      await prisma.character.update({
        where: { id: authData.characterId },
        data: { x: clampedX, y: clampedY },
      });

      // Broadcast to zone
      const character = await prisma.character.findUnique({
        where: { id: authData.characterId },
        select: { name: true, zone: true },
      });

      if (character) {
        socket.to(character.zone).emit('world:player_moved', {
          characterId: authData.characterId,
          x: clampedX,
          y: clampedY,
        });
      }
    } catch (error) {
      console.error('[Character] Move error:', error);
      socket.emit('system:error', { code: 'MOVE_FAILED', message: 'Movement failed' });
    }
  });
}

/**
 * Handle socket disconnection
 */
export function handleDisconnect(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>
): void {
  const authData = socket.data as SocketAuthData;
  if (authData?.characterId) {
    setPlayerOffline(authData.characterId).catch(console.error);
    console.log(`[Socket] Player disconnected: ${authData.characterId}`);
  }
}
