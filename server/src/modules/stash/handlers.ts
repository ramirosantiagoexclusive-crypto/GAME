import { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketAuthData } from '../../types/socket.js';
import { depositToStash, withdrawFromStash, moveInStash, getStash } from '../stash/service.js';

export function registerStashHandlers(
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

  const sendStashUpdate = async (characterId: string) => {
    const stash = await getStash(characterId);
    socket.emit('stash:update', {
      slots: stash.stash,
      maxSlots: stash.maxSlots,
    });
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
   * Deposit item to stash
   */
  socket.on('stash:deposit', async (payload) => {
    const authData = getAuthData();
    if (!authData) return;

    const result = await depositToStash(authData.characterId, payload);

    if (result.success) {
      await sendStashUpdate(authData.characterId);
      await sendInventoryUpdate(authData.characterId);
    } else {
      socket.emit('inventory:error', { message: result.error ?? 'Deposit failed' });
    }
  });

  /**
   * Withdraw item from stash
   */
  socket.on('stash:withdraw', async (payload) => {
    const authData = getAuthData();
    if (!authData) return;

    const result = await withdrawFromStash(authData.characterId, payload);

    if (result.success) {
      await sendStashUpdate(authData.characterId);
      await sendInventoryUpdate(authData.characterId);
    } else {
      socket.emit('inventory:error', { message: result.error ?? 'Withdraw failed' });
    }
  });

  /**
   * Move item within stash
   */
  socket.on('stash:move', async (payload) => {
    const authData = getAuthData();
    if (!authData) return;

    const result = await moveInStash(authData.characterId, payload);

    if (result.success) {
      await sendStashUpdate(authData.characterId);
    } else {
      socket.emit('inventory:error', { message: result.error ?? 'Move failed' });
    }
  });
}
