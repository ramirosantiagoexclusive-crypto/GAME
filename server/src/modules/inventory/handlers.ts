import { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketAuthData } from '../../types/socket.js';
import {
  getInventory,
  pickupLoot,
  equipItem,
  unequipItem,
  moveItem,
  dropItem,
} from '../inventory/service.js';

export function registerInventoryHandlers(
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
    const inv = await getInventory(characterId);
    socket.emit('inventory:update', {
      slots: inv.inventory,
      equipment: inv.equipment,
    });
  };

  /**
   * Pickup loot from ground
   */
  socket.on('inventory:pickup', async (payload) => {
    const authData = getAuthData();
    if (!authData) return;

    const result = await pickupLoot(authData.characterId, payload);

    if (result.success) {
      await sendInventoryUpdate(authData.characterId);
      // Broadcast loot picked to zone
      const character = await (await import('../../services/prisma.js')).prisma.character.findUnique({
        where: { id: authData.characterId },
        select: { zone: true },
      });
      if (character) {
        socket.to(character.zone).emit('loot:picked', {
          lootId: (payload as { lootId: string }).lootId,
        });
      }
    } else {
      socket.emit('inventory:error', { message: result.error ?? 'Pickup failed' });
    }
  });

  /**
   * Equip item from inventory
   */
  socket.on('inventory:equip', async (payload) => {
    const authData = getAuthData();
    if (!authData) return;

    const result = await equipItem(authData.characterId, payload);

    if (result.success) {
      await sendInventoryUpdate(authData.characterId);
    } else {
      socket.emit('inventory:error', { message: result.error ?? 'Equip failed' });
    }
  });

  /**
   * Unequip item to inventory
   */
  socket.on('inventory:unequip', async (payload) => {
    const authData = getAuthData();
    if (!authData) return;

    const result = await unequipItem(authData.characterId, payload);

    if (result.success) {
      await sendInventoryUpdate(authData.characterId);
    } else {
      socket.emit('inventory:error', { message: result.error ?? 'Unequip failed' });
    }
  });

  /**
   * Move item within inventory
   */
  socket.on('inventory:move', async (payload) => {
    const authData = getAuthData();
    if (!authData) return;

    const result = await moveItem(authData.characterId, payload);

    if (result.success) {
      await sendInventoryUpdate(authData.characterId);
    } else {
      socket.emit('inventory:error', { message: result.error ?? 'Move failed' });
    }
  });

  /**
   * Drop item from inventory to ground
   */
  socket.on('inventory:drop', async (payload) => {
    const authData = getAuthData();
    if (!authData) return;

    const result = await dropItem(authData.characterId, payload);

    if (result.success) {
      await sendInventoryUpdate(authData.characterId);
      // Broadcast loot dropped to zone
      const character = await (await import('../../services/prisma.js')).prisma.character.findUnique({
        where: { id: authData.characterId },
        select: { zone: true, x: true, y: true },
      });
      if (character && result.lootId) {
        const { getDroppedLoot } = await import('../world/service.js');
        const lootList = await getDroppedLoot(character.zone);
        const dropped = lootList.find((l) => l.id === result.lootId);
        if (dropped) {
          socket.to(character.zone).emit('loot:dropped', {
            id: dropped.id,
            itemTemplateId: dropped.itemTemplateId,
            itemName: dropped.itemName,
            quantity: dropped.quantity,
            x: dropped.x,
            y: dropped.y,
            expiresAt: dropped.expiresAt,
          });
        }
      }
    } else {
      socket.emit('inventory:error', { message: result.error ?? 'Drop failed' });
    }
  });
}
