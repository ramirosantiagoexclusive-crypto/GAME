import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../types/socket.js';
import { prisma } from '../../services/prisma.js';

// ============ Chat Types ============

export type ChatChannel = 'global' | 'zone' | 'private' | 'system';

export interface ChatMessage {
  id: string;
  channel: ChatChannel;
  senderId?: string;
  senderName?: string;
  targetId?: string;
  targetName?: string;
  zone?: string;
  message: string;
  timestamp: Date;
}

// ============ Chat Service ============

/**
 * Send global chat message
 */
export function sendGlobalMessage(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  characterId: string,
  characterName: string,
  message: string
): ChatMessage {
  const chatMessage: ChatMessage = {
    id: crypto.randomUUID(),
    channel: 'global',
    senderId: characterId,
    senderName: characterName,
    message,
    timestamp: new Date(),
  };

  // Broadcast to all connected clients
  io.emit('chat:message', chatMessage);

  console.log(`[Chat] Global: ${characterName}: ${message}`);

  return chatMessage;
}

/**
 * Send zone chat message
 */
export function sendZoneMessage(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  characterId: string,
  characterName: string,
  zone: string,
  message: string
): ChatMessage {
  const chatMessage: ChatMessage = {
    id: crypto.randomUUID(),
    channel: 'zone',
    senderId: characterId,
    senderName: characterName,
    zone,
    message,
    timestamp: new Date(),
  };

  // Broadcast to zone room
  io.to(zone).emit('chat:message', chatMessage);

  console.log(`[Chat] Zone ${zone}: ${characterName}: ${message}`);

  return chatMessage;
}

/**
 * Send private message
 */
export async function sendPrivateMessage(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  senderId: string,
  senderName: string,
  targetCharacterId: string,
  message: string
): Promise<{ success: boolean; error?: string; message?: ChatMessage }> {
  // Validate inputs
  if (!targetCharacterId || !message || message.trim().length === 0) {
    return { success: false, error: 'Invalid input' };
  }

  try {
    // 1. Get target character
    const target = await prisma.character.findUnique({
      where: { id: targetCharacterId },
      select: { id: true, name: true },
    });

    if (!target) {
      return { success: false, error: 'Target character not found' };
    }

    if (target.id === senderId) {
      return { success: false, error: 'Cannot send message to yourself' };
    }

    const chatMessage: ChatMessage = {
      id: crypto.randomUUID(),
      channel: 'private',
      senderId,
      senderName,
      targetId: target.id,
      targetName: target.name,
      message,
      timestamp: new Date(),
    };

    // 2. Send to sender
    io.to(`user:${senderId}`).emit('chat:message', chatMessage);

    // 3. Send to target
    io.to(`user:${target.id}`).emit('chat:message', chatMessage);

    console.log(`[Chat] Private: ${senderName} -> ${target.name}: ${message}`);

    return { success: true, message: chatMessage };
  } catch (error) {
    console.error('[Chat] Private message error:', error);
    return { success: false, error: 'Failed to send private message' };
  }
}

/**
 * Send system message to all players
 */
export function sendSystemMessage(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  message: string
): ChatMessage {
  const chatMessage: ChatMessage = {
    id: crypto.randomUUID(),
    channel: 'system',
    message,
    timestamp: new Date(),
  };

  io.emit('chat:message', chatMessage);

  console.log(`[Chat] System: ${message}`);

  return chatMessage;
}

/**
 * Send system message to specific zone
 */
export function sendZoneSystemMessage(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  zone: string,
  message: string
): ChatMessage {
  const chatMessage: ChatMessage = {
    id: crypto.randomUUID(),
    channel: 'system',
    zone,
    message,
    timestamp: new Date(),
  };

  io.to(zone).emit('chat:message', chatMessage);

  console.log(`[Chat] System (${zone}): ${message}`);

  return chatMessage;
}


