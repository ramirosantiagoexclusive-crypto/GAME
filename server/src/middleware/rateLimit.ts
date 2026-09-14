import { Socket } from 'socket.io';
import { checkRateLimit } from '../services/redis.js';

/**
 * Rate limiting middleware for Socket.io events
 * Prevents spam and abuse
 */
export function rateLimitMiddleware(
  maxRequests: number,
  windowSeconds: number
) {
  return async (socket: Socket, event: string, args: any[], next: (err?: Error) => void) => {
    const authData = socket.data as { characterId?: string };
    
    if (!authData?.characterId) {
      // Allow unauthenticated requests (auth events)
      return next();
    }

    const key = `${authData.characterId}:${event}`;
    const result = await checkRateLimit(key, maxRequests, windowSeconds);

    if (!result.allowed) {
      socket.emit('system:error', {
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded for ${event}. Try again later.`,
      });
      return next(new Error('Rate limit exceeded'));
    }

    next();
  };
}

/**
 * Pre-defined rate limits for different event types
 */
export const RATE_LIMITS = {
  // Movement - high frequency allowed
  'character:move': { max: 60, window: 10 }, // 60 moves per 10 seconds

  // Combat - moderate frequency
  'combat:attack': { max: 10, window: 5 }, // 10 attacks per 5 seconds

  // Inventory operations - low frequency
  'inventory:pickup': { max: 5, window: 2 },
  'inventory:equip': { max: 5, window: 2 },
  'inventory:unequip': { max: 5, window: 2 },
  'inventory:move': { max: 10, window: 2 },
  'inventory:drop': { max: 5, window: 2 },

  // Crafting - very low frequency
  'craft:start': { max: 3, window: 5 },
  'craft:salvage': { max: 3, window: 5 },

  // Raid - low frequency
  'raid:enter': { max: 2, window: 10 },
  'raid:extract': { max: 2, window: 10 },

  // World - moderate frequency
  'resource:harvest': { max: 5, window: 5 },

  // God mode - very low frequency
  'god:spawn': { max: 5, window: 10 },
  'god:config': { max: 3, window: 10 },
  'god:event': { max: 2, window: 30 },

  // Auth - very low frequency
  'auth:login': { max: 3, window: 60 },
  'auth:register': { max: 2, window: 60 },
} as const;

/**
 * Apply rate limiting to all socket events
 */
export function applyRateLimits(socket: Socket): void {
  for (const [event, limits] of Object.entries(RATE_LIMITS)) {
    socket.onAny(rateLimitMiddleware(limits.max, limits.window));
  }
}
