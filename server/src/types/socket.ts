// ============ Socket.io Event Types ============

/** Client → Server events */
export interface ClientToServerEvents {
  // Auth
  'auth:login': (payload: { email: string; password: string }) => void;
  'auth:register': (payload: { email: string; password: string; characterName: string }) => void;

  // Character
  'character:move': (payload: { x: number; y: number }) => void;
  'character:interact': (payload: { targetId: string; action: string }) => void;

  // Inventory
  'inventory:pickup': (payload: { lootId: string }) => void;
  'inventory:equip': (payload: { slotIndex: number; equipmentSlot: string }) => void;
  'inventory:unequip': (payload: { equipmentSlot: string }) => void;
  'inventory:move': (payload: { fromIndex: number; toIndex: number }) => void;
  'inventory:drop': (payload: { slotIndex: number; quantity: number }) => void;

  // Crafting
  'craft:start': (payload: { recipeId: string }) => void;
  'craft:salvage': (payload: { slotIndex: number }) => void;

  // Raid
  'raid:enter': (payload: { zoneId: string }) => void;
  'raid:extract': () => void;

  // Combat
  'combat:attack': (payload: { targetId: string }) => void;

  // Resource
  'resource:harvest': (payload: { nodeId: string }) => void;

  // God Mode
  'god:spawn': (payload: { type: string; templateId: string; x: number; y: number; zone: string; quantity?: number }) => void;
  'god:config': (payload: { key: string; value: unknown }) => void;
  'god:event': (payload: { eventType: string; duration: number }) => void;
}

/** Server → Client events */
export interface ServerToClientEvents {
  // Auth
  'auth:success': (payload: { token: string; character: CharacterData }) => void;
  'auth:error': (payload: { message: string }) => void;

  // World
  'world:state': (payload: { players: PlayerState[]; npcs: NpcState[]; loot: LootState[] }) => void;
  'world:player_joined': (payload: PlayerState) => void;
  'world:player_left': (payload: { characterId: string }) => void;
  'world:player_moved': (payload: { characterId: string; x: number; y: number }) => void;

  // Combat
  'combat:hit': (payload: { attackerId: string; targetId: string; damage: number; targetHp: number }) => void;
  'combat:miss': (payload: { attackerId: string; targetId: string; reason: string }) => void;

  // Inventory
  'inventory:update': (payload: { slots: InventorySlotData[]; equipment: EquipmentSlotData[] }) => void;
  'inventory:error': (payload: { message: string }) => void;

  // Loot
  'loot:dropped': (payload: LootState) => void;
  'loot:picked': (payload: { lootId: string }) => void;
  'loot:expired': (payload: { lootId: string }) => void;

  // Character
  'character:died': (payload: { characterId: string; killerId?: string }) => void;
  'character:extracted': (payload: { characterId: string }) => void;
  'character:afk_warning': (payload: { secondsRemaining: number }) => void;

  // Raid
  'raid:started': (payload: { raidId: string; zoneId: string; endTime: string }) => void;
  'raid:ended': (payload: { raidId: string; status: string }) => void;
  'raid:timer': (payload: { secondsRemaining: number }) => void;

  // God Mode
  'god:ack': (payload: { action: string; success: boolean; message?: string }) => void;
  'god:config_updated': (payload: { config: unknown }) => void;

  // System
  'system:error': (payload: { code: string; message: string }) => void;
  'system:notice': (payload: { message: string }) => void;
}

// ============ Data Types ============

export interface CharacterData {
  id: string;
  name: string;
  x: number;
  y: number;
  zone: string;
  status: string;
  hp: number;
  maxHp: number;
  maxStashSlots: number;
}

export interface PlayerState {
  characterId: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export interface NpcState {
  id: string;
  templateId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  state: string;
}

export interface LootState {
  id: string;
  itemTemplateId: string;
  itemName: string;
  quantity: number;
  x: number;
  y: number;
  expiresAt: string;
}

export interface InventorySlotData {
  slotIndex: number;
  itemInstanceId: string;
  templateId: string;
  templateName: string;
  templateType: string;
  quantity: number;
  durability?: number;
  maxDurability?: number;
}

export interface EquipmentSlotData {
  slotType: string;
  itemInstanceId: string;
  templateId: string;
  templateName: string;
  quantity: number;
  durability?: number;
  maxDurability?: number;
}

// ============ Socket Data ============

export interface SocketAuthData {
  userId: string;
  characterId: string;
  role: string;
}
