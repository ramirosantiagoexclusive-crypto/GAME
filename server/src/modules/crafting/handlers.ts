import { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketAuthData } from '../../types/socket.js';
import { craftItem, salvageItem, getKnownRecipes } from '../crafting/service.js';

export function registerCraftingHandlers(
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
   * Start crafting an item
   */
  socket.on('craft:start', async (payload) => {
    const authData = getAuthData();
    if (!authData) return;

    const result = await craftItem(authData.characterId, payload);

    if (result.success) {
      await sendInventoryUpdate(authData.characterId);
      socket.emit('system:notice', { message: 'Crafting successful!' });
    } else {
      socket.emit('inventory:error', { message: result.error ?? 'Crafting failed' });
    }
  });

  /**
   * Salvage (break down) an item
   */
  socket.on('craft:salvage', async (payload) => {
    const authData = getAuthData();
    if (!authData) return;

    const result = await salvageItem(authData.characterId, payload);

    if (result.success) {
      await sendInventoryUpdate(authData.characterId);
      socket.emit('system:notice', { message: 'Salvage successful!' });
    } else {
      socket.emit('inventory:error', { message: result.error ?? 'Salvage failed' });
    }
  });
}
