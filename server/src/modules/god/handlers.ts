import { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketAuthData } from '../../types/socket.js';
import { godSpawn, godConfig, godEvent } from '../god/service.js';

export function registerGodHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>
): void {
  const getAuthData = (): SocketAuthData | null => {
    const authData = socket.data as SocketAuthData;
    if (!authData?.characterId) {
      socket.emit('system:error', { code: 'UNAUTHORIZED', message: 'Not authenticated' });
      return null;
    }
    return authData;
  };

  const requireGodMode = (): boolean => {
    const authData = socket.data as SocketAuthData;
    if (!authData || authData.role !== 'god') {
      socket.emit('system:error', { code: 'GOD_MODE_REQUIRED', message: 'God mode required' });
      return false;
    }
    return true;
  };

  /**
   * God Mode: Spawn items or NPCs
   */
  socket.on('god:spawn', async (payload) => {
    const authData = getAuthData();
    if (!authData) return;
    if (!requireGodMode()) return;

    const result = await godSpawn(authData.userId, payload);

    if (result.success) {
      socket.emit('god:ack', { action: 'spawn', success: true });
      
      // Broadcast to zone
      const { zone } = payload as { zone: string };
      io.to(zone).emit('system:notice', {
        message: 'God spawned items/NPCs',
      });
    } else {
      socket.emit('god:ack', {
        action: 'spawn',
        success: false,
        message: result.error,
      });
    }
  });

  /**
   * God Mode: Update live config
   */
  socket.on('god:config', async (payload) => {
    const authData = getAuthData();
    if (!authData) return;
    if (!requireGodMode()) return;

    const result = await godConfig(authData.userId, payload);

    if (result.success) {
      socket.emit('god:ack', { action: 'config', success: true });
      socket.emit('god:config_updated', { config: result.config });
      
      // Broadcast to all players
      io.emit('system:notice', {
        message: 'Live config updated by God',
      });
    } else {
      socket.emit('god:ack', {
        action: 'config',
        success: false,
        message: result.error,
      });
    }
  });

  /**
   * God Mode: Trigger world event
   */
  socket.on('god:event', async (payload) => {
    const authData = getAuthData();
    if (!authData) return;
    if (!requireGodMode()) return;

    const result = await godEvent(authData.userId, payload);

    if (result.success) {
      socket.emit('god:ack', { action: 'event', success: true });
      
      const { eventType, duration } = payload as { eventType: string; duration: number };
      
      // Broadcast to all players
      io.emit('system:notice', {
        message: `World event started: ${eventType} (${duration}s)`,
      });
    } else {
      socket.emit('god:ack', {
        action: 'event',
        success: false,
        message: result.error,
      });
    }
  });
}
