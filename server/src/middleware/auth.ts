import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../services/prisma.js';
import type { SocketAuthData } from '../types/socket.js';

/**
 * Socket.io authentication middleware.
 * Validates JWT token and attaches user data to socket.
 */
export async function authMiddleware(socket: Socket, next: (err?: Error) => void): Promise<void> {
  try {
    const token = socket.handshake.auth['token'] as string | undefined;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, config.jwt.secret) as {
      userId: string;
      characterId: string;
      role: string;
    };

    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true },
    });

    if (!user) {
      return next(new Error('User not found'));
    }

    // Verify character exists and belongs to user
    const character = await prisma.character.findUnique({
      where: { id: decoded.characterId },
      select: { id: true, userId: true, status: true },
    });

    if (!character) {
      return next(new Error('Character not found'));
    }

    if (character.userId !== decoded.userId) {
      return next(new Error('Character does not belong to user'));
    }

    if (character.status === 'dead') {
      return next(new Error('Character is dead. Resurrect at hub.'));
    }

    // Attach auth data to socket
    const authData: SocketAuthData = {
      userId: decoded.userId,
      characterId: decoded.characterId,
      role: user.role,
    };

    socket.data = authData;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new Error('Invalid token'));
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(new Error('Token expired'));
    }
    next(new Error('Authentication failed'));
  }
}

/**
 * Zone validation middleware factory.
 * Ensures player is in the correct zone for certain actions.
 */
export function requireZone(zone: string) {
  return (socket: Socket, next: (err?: Error) => void): void => {
    const authData = socket.data as SocketAuthData;
    
    prisma.character.findUnique({
      where: { id: authData.characterId },
      select: { zone: true },
    }).then((character) => {
      if (!character) {
        return next(new Error('Character not found'));
      }
      if (character.zone !== zone) {
        return next(new Error(`This action requires being in zone: ${zone}`));
      }
      next();
    }).catch(() => {
      next(new Error('Zone validation failed'));
    });
  };
}

/**
 * God mode middleware.
 * Ensures only god-role users can execute god actions.
 */
export function requireGodMode(socket: Socket, next: (err?: Error) => void): void {
  const authData = socket.data as SocketAuthData;
  
  if (authData.role !== 'god') {
    return next(new Error('God mode required'));
  }
  
  next();
}
