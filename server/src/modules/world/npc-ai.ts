import { prisma } from '../../services/prisma.js';

/**
 * NPC State Machine
 * States: idle, patrol, combat, looting, returning
 */

interface NpcState {
  id: string;
  templateId: string;
  zone: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  state: 'idle' | 'patrol' | 'combat' | 'looting' | 'returning';
  targetId?: string;
  homeX: number;
  homeY: number;
  aggroRange: number;
  patrolPoints?: Array<{ x: number; y: number }>;
  currentPatrolIndex?: number;
}

const npcStates = new Map<string, NpcState>();

/**
 * Initialize NPC state from database
 */
export async function initializeNpc(npcId: string): Promise<NpcState | null> {
  const npc = await prisma.npc.findUnique({
    where: { id: npcId },
  });

  if (!npc) return null;

  const state: NpcState = {
    id: npc.id,
    templateId: npc.templateId,
    zone: npc.zone,
    x: npc.x,
    y: npc.y,
    hp: npc.hp,
    maxHp: npc.maxHp,
    state: 'idle',
    homeX: npc.x,
    homeY: npc.y,
    aggroRange: 10, // Default aggro range
  };

  npcStates.set(npcId, state);
  return state;
}

/**
 * Get NPC state
 */
export function getNpcState(npcId: string): NpcState | undefined {
  return npcStates.get(npcId);
}

/**
 * Update NPC state
 */
export function updateNpcState(npcId: string, updates: Partial<NpcState>): void {
  const state = npcStates.get(npcId);
  if (state) {
    Object.assign(state, updates);
  }
}

/**
 * Remove NPC state
 */
export function removeNpcState(npcId: string): void {
  npcStates.delete(npcId);
}

/**
 * NPC AI tick - called every second
 */
export async function npcAiTick(): Promise<void> {
  for (const [npcId, state] of npcStates.entries()) {
    try {
      await processNpcState(state);
    } catch (error) {
      console.error(`[NPC AI] Error processing ${npcId}:`, error);
    }
  }
}

/**
 * Process NPC state machine
 */
async function processNpcState(state: NpcState): Promise<void> {
  switch (state.state) {
    case 'idle':
      await processIdle(state);
      break;
    case 'patrol':
      await processPatrol(state);
      break;
    case 'combat':
      await processCombat(state);
      break;
    case 'looting':
      await processLooting(state);
      break;
    case 'returning':
      await processReturning(state);
      break;
  }
}

/**
 * IDLE state - look for targets
 */
async function processIdle(state: NpcState): Promise<void> {
  // Check for nearby players
  const nearbyPlayers = await prisma.character.findMany({
    where: {
      zone: state.zone,
      status: 'alive',
      x: { gte: state.x - state.aggroRange, lte: state.x + state.aggroRange },
      y: { gte: state.y - state.aggroRange, lte: state.y + state.aggroRange },
    },
    select: { id: true, x: true, y: true },
  });

  if (nearbyPlayers.length > 0) {
    // Attack closest player
    const target = nearbyPlayers[0]!;
    updateNpcState(state.id, {
      state: 'combat',
      targetId: target.id,
    });
    return;
  }

  // 10% chance to start patrolling
  if (Math.random() < 0.1) {
    updateNpcState(state.id, {
      state: 'patrol',
      currentPatrolIndex: 0,
    });
  }
}

/**
 * PATROL state - move between patrol points
 */
async function processPatrol(state: NpcState): Promise<void> {
  if (!state.patrolPoints || state.patrolPoints.length === 0) {
    // No patrol points, return to idle
    updateNpcState(state.id, { state: 'idle' });
    return;
  }

  const currentIndex = state.currentPatrolIndex ?? 0;
  const targetPoint = state.patrolPoints[currentIndex];

  if (!targetPoint) {
    updateNpcState(state.id, { state: 'idle' });
    return;
  }

  // Move towards target
  const dx = targetPoint.x - state.x;
  const dy = targetPoint.y - state.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 0.5) {
    // Reached point, move to next
    const nextIndex = (currentIndex + 1) % state.patrolPoints.length;
    updateNpcState(state.id, { currentPatrolIndex: nextIndex });
  } else {
    // Move towards point
    const speed = 0.5;
    const newX = state.x + (dx / distance) * speed;
    const newY = state.y + (dy / distance) * speed;

    updateNpcState(state.id, { x: newX, y: newY });

    // Update in database
    await prisma.npc.update({
      where: { id: state.id },
       { x: newX, y: newY },
    });
  }
}

/**
 * COMBAT state - attack target
 */
async function processCombat(state: NpcState): Promise<void> {
  if (!state.targetId) {
    updateNpcState(state.id, { state: 'idle' });
    return;
  }

  // Check if target is still alive and in range
  const target = await prisma.character.findUnique({
    where: { id: state.targetId },
    select: { x: true, y: true, status: true, zone: true },
  });

  if (!target || target.status !== 'alive' || target.zone !== state.zone) {
    // Target dead or gone, return to idle
    updateNpcState(state.id, {
      state: 'idle',
      targetId: undefined,
    });
    return;
  }

  const dx = target.x - state.x;
  const dy = target.y - state.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > state.aggroRange * 2) {
    // Target too far, return to home
    updateNpcState(state.id, {
      state: 'returning',
      targetId: undefined,
    });
    return;
  }

  if (distance > 2) {
    // Move towards target
    const speed = 0.8;
    const newX = state.x + (dx / distance) * speed;
    const newY = state.y + (dy / distance) * speed;

    updateNpcState(state.id, { x: newX, y: newY });

    await prisma.npc.update({
      where: { id: state.id },
       { x: newX, y: newY },
    });
  } else {
    // In attack range - attack!
    // This would trigger combat system
    // For now, just simulate damage
    const damage = 10;
    await prisma.character.update({
      where: { id: state.targetId },
       { hp: { decrement: damage } },
    });
  }
}

/**
 * LOOTING state - pick up nearby loot
 */
async function processLooting(state: NpcState): Promise<void> {
  // Find nearby loot
  const nearbyLoot = await prisma.droppedLoot.findFirst({
    where: {
      zone: state.zone,
      x: { gte: state.x - 2, lte: state.x + 2 },
      y: { gte: state.y - 2, lte: state.y + 2 },
    },
  });

  if (!nearbyLoot) {
    // No loot, return to idle
    updateNpcState(state.id, { state: 'idle' });
    return;
  }

  // Pick up loot (simplified - in real implementation would add to NPC inventory)
  await prisma.droppedLoot.delete({ where: { id: nearbyLoot.id } });
  await prisma.itemInstance.delete({ where: { id: nearbyLoot.itemInstanceId } });

  updateNpcState(state.id, { state: 'idle' });
}

/**
 * RETURNING state - return to home position
 */
async function processReturning(state: NpcState): Promise<void> {
  const dx = state.homeX - state.x;
  const dy = state.homeY - state.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 0.5) {
    // Reached home
    updateNpcState(state.id, { state: 'idle' });
    return;
  }

  // Move towards home
  const speed = 0.5;
  const newX = state.x + (dx / distance) * speed;
  const newY = state.y + (dy / distance) * speed;

  updateNpcState(state.id, { x: newX, y: newY });

  await prisma.npc.update({
    where: { id: state.id },
     { x: newX, y: newY },
  });
}

/**
 * Initialize all NPCs in a zone
 */
export async function initializeZoneNpcs(zone: string): Promise<void> {
  const npcs = await prisma.npc.findMany({
    where: { zone },
  });

  for (const npc of npcs) {
    await initializeNpc(npc.id);
  }

  console.log(`[NPC AI] Initialized ${npcs.length} NPCs in zone ${zone}`);
}

/**
 * Start NPC AI loop
 */
export function startNpcAiLoop(): void {
  setInterval(npcAiTick, 1000); // Tick every second
  console.log('[NPC AI] Started AI loop (1 tick/second)');
}
