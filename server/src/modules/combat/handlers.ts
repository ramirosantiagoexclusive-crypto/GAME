import { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketAuthData } from '../../types/socket.js';
import { attackTarget } from '../combat/service.js';

export function registerCombatHandlers(
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
   * Attack a target (player or NPC)
   */
  socket.on('combat:attack', async (payload) => {
    const authData = getAuthData();
    if (!authData) return;

    const result = await attackTarget(authData.characterId, payload);

    if (result.success && result.hit) {
      // Broadcast hit to zone
      const character = await (await import('../../services/prisma.js')).prisma.character.findUnique({
        where: { id: authData.characterId },
        select: { zone: true },
      });

      if (character) {
        io.to(character.zone).emit('combat:hit', {
          attackerId: authData.characterId,
          targetId: (payload as { targetId: string }).targetId,
          damage: result.hit.damage,
          targetHp: result.hit.targetHp,
        });

        if (result.hit.killed) {
          io.to(character.zone).emit('character:died', {
            characterId: (payload as { targetId: string }).targetId,
            killerId: authData.characterId,
          });
        }
      }
    } else {
      socket.emit('system:error', {
        code: 'ATTACK_FAILED',
        message: result.error ?? 'Attack failed',
      });
    }
  });
}
