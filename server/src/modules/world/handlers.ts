import { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketAuthData } from '../../types/socket.js';
import { harvestResource } from '../world/service.js';

export function registerWorldHandlers(
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

  const sendInventoryUpdate = async (characterId: string) => {
    const { getInventory } = await import('../inventory/service.js');
    const inv = await getInventory(characterId);
    socket.emit('inventory:update', {
      slots: inv.inventory,
      equipment: inv.equipment,
    });
  };

  /**
   * Harvest a resource node
   */
  socket.on('resource:harvest', async (payload) => {
    const authData = getAuthData();
    if (!authData) return;

    const result = await harvestResource(authData.characterId, payload);

    if (result.success) {
      await sendInventoryUpdate(authData.characterId);
      // Broadcast node depleted to zone
      const character = await (await import('../../services/prisma.js')).prisma.character.findUnique({
        where: { id: authData.characterId },
        select: { zone: true },
      });
      if (character) {
        socket.to(character.zone).emit('system:notice', {
          message: `Resource node depleted`,
        });
      }
    } else {
      socket.emit('inventory:error', { message: result.error ?? 'Harvest failed' });
    }
  });
}
