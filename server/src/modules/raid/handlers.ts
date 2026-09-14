import { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketAuthData } from '../../types/socket.js';
import { enterRaid, extractFromRaid, getCurrentRaid } from '../raid/service.js';

export function registerRaidHandlers(
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

  /**
   * Enter a raid zone
   */
  socket.on('raid:enter', async (payload) => {
    const authData = getAuthData();
    if (!authData) return;

    const result = await enterRaid(authData.characterId, payload);

    if (result.success && result.raidId && result.endTime) {
      // Leave old zone room, join new zone room
      const oldZone = await (await import('../../services/prisma.js')).prisma.character.findUnique({
        where: { id: authData.characterId },
        select: { zone: true },
      });
      
      // Note: zone is already updated in DB, so we need to use the new zone
      const newZone = (payload as { zoneId: string }).zoneId;
      
      if (oldZone) {
        socket.leave(oldZone.zone);
      }
      socket.join(newZone);

      socket.emit('raid:started', {
        raidId: result.raidId,
        zoneId: newZone,
        endTime: result.endTime,
      });

      // Broadcast to new zone
      io.to(newZone).emit('world:player_joined', {
        characterId: authData.characterId,
        name: 'Player', // TODO: get actual name
        x: 0,
        y: 0,
        hp: 100,
        maxHp: 100,
      });
    } else {
      socket.emit('system:error', {
        code: 'RAID_ENTER_FAILED',
        message: result.error ?? 'Failed to enter raid',
      });
    }
  });

  /**
   * Extract from raid using portal stone
   */
  socket.on('raid:extract', async () => {
    const authData = getAuthData();
    if (!authData) return;

    // Get current zone before extraction
    const character = await (await import('../../services/prisma.js')).prisma.character.findUnique({
      where: { id: authData.characterId },
      select: { zone: true },
    });

    const result = await extractFromRaid(authData.characterId);

    if (result.success) {
      // Leave raid zone, join hub
      if (character) {
        socket.leave(character.zone);
      }
      socket.join('hub');

      socket.emit('character:extracted', {
        characterId: authData.characterId,
      });

      // Broadcast to hub
      io.to('hub').emit('world:player_joined', {
        characterId: authData.characterId,
        name: 'Player', // TODO: get actual name
        x: 0,
        y: 0,
        hp: 100,
        maxHp: 100,
      });

      // Send inventory update (portal stone consumed)
      const { getInventory } = await import('../inventory/service.js');
      const inv = await getInventory(authData.characterId);
      socket.emit('inventory:update', {
        slots: inv.inventory,
        equipment: inv.equipment,
      });
    } else {
      socket.emit('system:error', {
        code: 'EXTRACT_FAILED',
        message: result.error ?? 'Extraction failed',
      });
    }
  });
}
