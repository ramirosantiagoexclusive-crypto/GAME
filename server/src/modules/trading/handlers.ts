import { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketAuthData } from '../../types/socket.js';
import { initiateTrade, offerTradeItems, acceptTrade, cancelTrade, getTradeInfo } from '../trading/service.js';

export function registerTradingHandlers(
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
   * Initiate trade with another player
   */
  socket.on('trade:initiate', async (payload) => {
    const authData = getAuthData();
    if (!authData) return;

    const result = await initiateTrade(authData.characterId, payload);

    if (result.success && result.tradeId) {
      socket.emit('trade:initiated', {
        tradeId: result.tradeId,
        status: 'pending',
      });

      // Notify target player
      const targetId = (payload as { targetCharacterId: string }).targetCharacterId;
      io.to(`user:${targetId}`).emit('trade:invitation', {
        tradeId: result.tradeId,
        fromCharacterId: authData.characterId,
      });

      console.log(`[Trade] Trade ${result.tradeId} initiated between ${authData.characterId} and ${targetId}`);
    } else {
      socket.emit('system:error', {
        code: 'TRADE_INITIATE_FAILED',
        message: result.error ?? 'Failed to initiate trade',
      });
    }
  });

  /**
   * Offer items in trade
   */
  socket.on('trade:offer', async (payload) => {
    const authData = getAuthData();
    if (!authData) return;

    const result = await offerTradeItems(authData.characterId, payload);

    if (result.success) {
      const tradeId = (payload as { tradeId: string }).tradeId;
      const trade = getTradeInfo(tradeId);
      
      if (trade) {
        // Send updated trade info to both players
        const tradeInfo = {
          tradeId: trade.id,
          initiatorItems: Array.from(trade.initiatorItems.entries()).map(([id, data]) => ({
            itemInstanceId: id,
            ...data,
          })),
          targetItems: Array.from(trade.targetItems.entries()).map(([id, data]) => ({
            itemInstanceId: id,
            ...data,
          })),
          initiatorAccepted: trade.initiatorAccepted,
          targetAccepted: trade.targetAccepted,
        };

        socket.emit('trade:updated', tradeInfo);
        io.to(`user:${trade.initiatorId === authData.characterId ? trade.targetId : trade.initiatorId}`).emit('trade:updated', tradeInfo);
      }
    } else {
      socket.emit('system:error', {
        code: 'TRADE_OFFER_FAILED',
        message: result.error ?? 'Failed to offer items',
      });
    }
  });

  /**
   * Accept trade
   */
  socket.on('trade:accept', async (payload) => {
    const authData = getAuthData();
    if (!authData) return;

    const result = await acceptTrade(authData.characterId, payload);

    if (result.success) {
      const tradeId = (payload as { tradeId: string }).tradeId;
      
      if (result.completed) {
        // Trade completed
        socket.emit('trade:completed', { tradeId });
        
        // Notify other player
        const trade = getTradeInfo(tradeId);
        if (trade) {
          const otherPlayerId = trade.initiatorId === authData.characterId ? trade.targetId : trade.initiatorId;
          io.to(`user:${otherPlayerId}`).emit('trade:completed', { tradeId });
          
          // Update inventories for both players
          await sendInventoryUpdate(trade.initiatorId);
          await sendInventoryUpdate(trade.targetId);
        }

        console.log(`[Trade] Trade ${tradeId} completed`);
      } else {
        // Just accepted, waiting for other player
        socket.emit('trade:accepted', { tradeId });
        
        // Notify other player
        const trade = getTradeInfo(tradeId);
        if (trade) {
          const otherPlayerId = trade.initiatorId === authData.characterId ? trade.targetId : trade.initiatorId;
          io.to(`user:${otherPlayerId}`).emit('trade:partner_accepted', { tradeId });
        }
      }
    } else {
      socket.emit('system:error', {
        code: 'TRADE_ACCEPT_FAILED',
        message: result.error ?? 'Failed to accept trade',
      });
    }
  });

  /**
   * Cancel trade
   */
  socket.on('trade:cancel', async (payload) => {
    const authData = getAuthData();
    if (!authData) return;

    const tradeId = (payload as { tradeId: string }).tradeId;
    const success = cancelTrade(tradeId, authData.characterId);

    if (success) {
      socket.emit('trade:cancelled', { tradeId });
      
      // Notify other player
      const trade = getTradeInfo(tradeId);
      if (trade) {
        const otherPlayerId = trade.initiatorId === authData.characterId ? trade.targetId : trade.initiatorId;
        io.to(`user:${otherPlayerId}`).emit('trade:cancelled', { tradeId });
      }

      console.log(`[Trade] Trade ${tradeId} cancelled by ${authData.characterId}`);
    } else {
      socket.emit('system:error', {
        code: 'TRADE_CANCEL_FAILED',
        message: 'Failed to cancel trade',
      });
    }
  });
}
