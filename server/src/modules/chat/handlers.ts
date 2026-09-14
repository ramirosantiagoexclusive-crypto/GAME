import { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketAuthData } from '../../types/socket.js';
import { sendGlobalMessage, sendZoneMessage, sendPrivateMessage } from '../chat/service.js';
import { prisma } from '../../services/prisma.js';

export function registerChatHandlers(
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
   * Send chat message
   */
  socket.on('chat:send', async (payload) => {
    const authData = getAuthData();
    if (!authData) return;

    const { channel, message, targetId } = payload as {
      channel: 'global' | 'zone' | 'private';
      message: string;
      targetId?: string;
    };

    // Validate message
    if (!message || message.trim().length === 0) {
      socket.emit('system:error', {
        code: 'INVALID_MESSAGE',
        message: 'Message cannot be empty',
      });
      return;
    }

    if (message.length > 200) {
      socket.emit('system:error', {
        code: 'MESSAGE_TOO_LONG',
        message: 'Message cannot exceed 200 characters',
      });
      return;
    }

    try {
      // Get character info
      const character = await prisma.character.findUnique({
        where: { id: authData.characterId },
        select: { name: true, zone: true },
      });

      if (!character) {
        socket.emit('system:error', {
          code: 'CHARACTER_NOT_FOUND',
          message: 'Character not found',
        });
        return;
      }

      switch (channel) {
        case 'global':
          sendGlobalMessage(io, authData.characterId, character.name, message.trim());
          break;

        case 'zone':
          sendZoneMessage(io, authData.characterId, character.name, character.zone, message.trim());
          break;

        case 'private':
          if (!targetId) {
            socket.emit('system:error', {
              code: 'TARGET_REQUIRED',
              message: 'Target character ID required for private messages',
            });
            return;
          }

          const result = await sendPrivateMessage(
            io,
            authData.characterId,
            character.name,
            targetId,
            message.trim()
          );

          if (!result.success) {
            socket.emit('system:error', {
              code: 'PRIVATE_MESSAGE_FAILED',
              message: result.error ?? 'Failed to send private message',
            });
          }
          break;

        default:
          socket.emit('system:error', {
            code: 'INVALID_CHANNEL',
            message: 'Invalid chat channel',
          });
      }
    } catch (error) {
      console.error('[Chat] Send error:', error);
      socket.emit('system:error', {
        code: 'CHAT_ERROR',
        message: 'Failed to send message',
      });
    }
  });
}
