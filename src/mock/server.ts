/**
 * Mock MMO Server — in-browser Socket.io emulator
 * Simulates all server logic for testing without PostgreSQL/Redis
 */

import { EventEmitter } from 'eventemitter3';

// ============ Types ============

export interface Character {
  id: string;
  name: string;
  x: number;
  y: number;
  zone: 'hub' | string;
  status: 'alive' | 'dead' | 'afk';
  hp: number;
  maxHp: number;
  maxStashSlots: number;
}

export interface ItemTemplate {
  id: string;
  name: string;
  type: 'resource' | 'weapon' | 'armor' | 'helmet' | 'boots' | 'consumable' | 'portal_stone' | 'bag';
  maxDurability?: number;
  defaultStats?: Record<string, number>;
  salvageYield?: Record<string, number>;
}

export interface ItemInstance {
  id: string;
  templateId: string;
  currentDurability?: number;
  customStats?: Record<string, number>;
}

export interface InventorySlot {
  id: string;
  characterId: string;
  itemInstanceId: string;
  quantity: number;
  slotIndex: number;
}

export interface EquipmentSlot {
  id: string;
  characterId: string;
  itemInstanceId: string;
  slotType: string;
}

export interface StashSlot {
  id: string;
  characterId: string;
  itemInstanceId: string;
  quantity: number;
  slotIndex: number;
}

export interface DroppedLoot {
  id: string;
  itemInstanceId: string;
  quantity: number;
  x: number;
  y: number;
  zone: string;
  expiresAt: number;
}

export interface ResourceNode {
  id: string;
  zone: string;
  x: number;
  y: number;
  templateId: string;
  isDepleted: boolean;
  respawnAt: number;
}

export interface Npc {
  id: string;
  name: string;
  zone: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  state: 'idle' | 'patrol' | 'combat';
}

export interface Recipe {
  id: string;
  name: string;
  requiredResources: Record<string, number>;
  resultTemplateId: string;
  resultQuantity: number;
}

export interface ChatMessage {
  id: string;
  channel: 'global' | 'zone' | 'private' | 'system';
  senderId?: string;
  senderName?: string;
  message: string;
  timestamp: number;
}

// ============ State ============

interface ServerState {
  characters: Map<string, Character>;
  templates: Map<string, ItemTemplate>;
  instances: Map<string, ItemInstance>;
  inventory: Map<string, InventorySlot>;
  equipment: Map<string, EquipmentSlot>;
  stash: Map<string, StashSlot>;
  loot: Map<string, DroppedLoot>;
  nodes: Map<string, ResourceNode>;
  npcs: Map<string, Npc>;
  recipes: Map<string, Recipe>;
  knowledge: Map<string, Set<string>>; // characterId -> recipeIds
  chatHistory: ChatMessage[];
  users: Map<string, { email: string; password: string; characterId: string }>;
}

const state: ServerState = {
  characters: new Map(),
  templates: new Map(),
  instances: new Map(),
  inventory: new Map(),
  equipment: new Map(),
  stash: new Map(),
  loot: new Map(),
  nodes: new Map(),
  npcs: new Map(),
  recipes: new Map(),
  knowledge: new Map(),
  chatHistory: [],
  users: new Map(),
};

// ============ Helpers ============

const uuid = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

function getInventorySlots(characterId: string): InventorySlot[] {
  return Array.from(state.inventory.values()).filter(s => s.characterId === characterId);
}

function getEquipmentSlots(characterId: string): EquipmentSlot[] {
  return Array.from(state.equipment.values()).filter(s => s.characterId === characterId);
}

function getStashSlots(characterId: string): StashSlot[] {
  return Array.from(state.stash.values()).filter(s => s.characterId === characterId);
}

function getLootInZone(zone: string): DroppedLoot[] {
  const now = Date.now();
  return Array.from(state.loot.values()).filter(l => l.zone === zone && l.expiresAt > now);
}

function getNodesInZone(zone: string): ResourceNode[] {
  return Array.from(state.nodes.values()).filter(n => n.zone === zone);
}

function getNpcsInZone(zone: string): Npc[] {
  return Array.from(state.npcs.values()).filter(n => n.zone === zone);
}

// ============ Seed Data ============

function seedData() {
  // Templates
  const templates: ItemTemplate[] = [
    { id: 'tpl_wood', name: 'Wood', type: 'resource' },
    { id: 'tpl_stone', name: 'Stone', type: 'resource' },
    { id: 'tpl_iron', name: 'Iron Ore', type: 'resource' },
    { id: 'tpl_herb', name: 'Herb', type: 'resource' },
    { id: 'tpl_gold', name: 'Gold', type: 'resource' },
    { id: 'tpl_sword_wood', name: 'Wooden Sword', type: 'weapon', maxDurability: 50, defaultStats: { damage: 10 }, salvageYield: { Wood: 3 } },
    { id: 'tpl_sword_iron', name: 'Iron Sword', type: 'weapon', maxDurability: 100, defaultStats: { damage: 25 }, salvageYield: { Iron: 5 } },
    { id: 'tpl_armor_leather', name: 'Leather Armor', type: 'armor', maxDurability: 80, defaultStats: { defense: 15 }, salvageYield: { Wood: 4 } },
    { id: 'tpl_helmet_iron', name: 'Iron Helmet', type: 'helmet', maxDurability: 60, defaultStats: { defense: 10 }, salvageYield: { Iron: 3 } },
    { id: 'tpl_potion', name: 'Health Potion', type: 'consumable', defaultStats: { healAmount: 30 } },
    { id: 'tpl_portal', name: 'Portal Stone', type: 'portal_stone' },
  ];
  templates.forEach(t => state.templates.set(t.id, t));

  // Recipes
  const recipes: Recipe[] = [
    { id: 'rec_sword_wood', name: 'Wooden Sword', requiredResources: { tpl_wood: 5, tpl_stone: 2 }, resultTemplateId: 'tpl_sword_wood', resultQuantity: 1 },
    { id: 'rec_sword_iron', name: 'Iron Sword', requiredResources: { tpl_iron: 8, tpl_wood: 2 }, resultTemplateId: 'tpl_sword_iron', resultQuantity: 1 },
    { id: 'rec_armor', name: 'Leather Armor', requiredResources: { tpl_wood: 10 }, resultTemplateId: 'tpl_armor_leather', resultQuantity: 1 },
    { id: 'rec_potion', name: 'Health Potion', requiredResources: { tpl_herb: 3 }, resultTemplateId: 'tpl_potion', resultQuantity: 2 },
    { id: 'rec_portal', name: 'Portal Stone', requiredResources: { tpl_stone: 10, tpl_iron: 5 }, resultTemplateId: 'tpl_portal', resultQuantity: 1 },
  ];
  recipes.forEach(r => state.recipes.set(r.id, r));

  // Resource nodes in hub - больше разнообразия
  const hubNodes = [
    { x: 100, y: 100, templateId: 'tpl_wood' },
    { x: 150, y: 50, templateId: 'tpl_wood' },
    { x: 180, y: 120, templateId: 'tpl_wood' },
    { x: -100, y: 100, templateId: 'tpl_stone' },
    { x: -150, y: -50, templateId: 'tpl_stone' },
    { x: -120, y: 80, templateId: 'tpl_stone' },
    { x: 200, y: -100, templateId: 'tpl_iron' },
    { x: 250, y: -80, templateId: 'tpl_iron' },
    { x: -200, y: 150, templateId: 'tpl_herb' },
    { x: -180, y: 180, templateId: 'tpl_herb' },
    { x: 50, y: -200, templateId: 'tpl_herb' },
    { x: 80, y: -180, templateId: 'tpl_herb' },
    { x: -50, y: -150, templateId: 'tpl_wood' },
    { x: 300, y: 50, templateId: 'tpl_stone' },
  ];
  hubNodes.forEach(n => {
    const id = uuid();
    state.nodes.set(id, { id, zone: 'hub', x: n.x, y: n.y, templateId: n.templateId, isDepleted: false, respawnAt: 0 });
  });

  // NPCs in raid zone
  // NPCs in raid zone - больше разнообразия
  const raidNpcs = [
    { name: 'Goblin', x: 300, y: 300, hp: 50, maxHp: 50 },
    { name: 'Goblin', x: 350, y: 280, hp: 50, maxHp: 50 },
    { name: 'Orc', x: 400, y: 400, hp: 100, maxHp: 100 },
    { name: 'Orc', x: 450, y: 380, hp: 100, maxHp: 100 },
    { name: 'Wolf', x: 250, y: 350, hp: 30, maxHp: 30 },
    { name: 'Wolf', x: 280, y: 370, hp: 30, maxHp: 30 },
    { name: 'Wolf', x: 230, y: 330, hp: 30, maxHp: 30 },
    { name: 'Troll', x: 500, y: 500, hp: 200, maxHp: 200 },
    { name: 'Skeleton', x: 150, y: 200, hp: 40, maxHp: 40 },
    { name: 'Skeleton', x: 180, y: 220, hp: 40, maxHp: 40 },
  ];
  raidNpcs.forEach(n => {
    const id = uuid();
    state.npcs.set(id, { id, name: n.name, zone: 'raid_zone_1', x: n.x, y: n.y, hp: n.hp, maxHp: n.maxHp, state: 'idle' });
  });

  // Test users
  state.users.set('player@test.local', { email: 'player@test.local', password: 'player12345', characterId: '' });
  state.users.set('god@mmo.local', { email: 'god@mmo.local', password: 'god12345', characterId: '' });
}

seedData();

// ============ Mock Socket ============

export class MockSocket extends EventEmitter {
  id = uuid();
  connected = true;
  data: { userId?: string; characterId?: string; role?: string } = {};
  
  private authData: { token?: string } = {};
  
  auth(auth: { token?: string }) {
    this.authData = auth;
  }

  // Simulate server processing
  sendToServer(event: string, payload?: any) {
    setTimeout(() => {
      try {
        this.handleEvent(event, payload);
      } catch (err) {
        this.emit('system:error', { code: 'SERVER_ERROR', message: String(err) });
      }
    }, 50); // Simulate network latency
  }

  private handleEvent(event: string, payload: any) {
    switch (event) {
      case 'auth:register':
        this.handleRegister(payload);
        break;
      case 'auth:login':
        this.handleLogin(payload);
        break;
      case 'character:move':
        this.handleMove(payload);
        break;
      case 'inventory:pickup':
        this.handlePickup(payload);
        break;
      case 'inventory:equip':
        this.handleEquip(payload);
        break;
      case 'inventory:unequip':
        this.handleUnequip(payload);
        break;
      case 'inventory:drop':
        this.handleDrop(payload);
        break;
      case 'craft:start':
        this.handleCraft(payload);
        break;
      case 'craft:salvage':
        this.handleSalvage(payload);
        break;
      case 'combat:attack':
        this.handleAttack(payload);
        break;
      case 'resource:harvest':
        this.handleHarvest(payload);
        break;
      case 'raid:enter':
        this.handleRaidEnter(payload);
        break;
      case 'raid:extract':
        this.handleRaidExtract();
        break;
      case 'stash:deposit':
        this.handleStashDeposit(payload);
        break;
      case 'stash:withdraw':
        this.handleStashWithdraw(payload);
        break;
      case 'chat:send':
        this.handleChatSend(payload);
        break;
      case 'god:spawn':
        this.handleGodSpawn(payload);
        break;
      case 'ability:use':
        this.handleAbilityUse(payload);
        break;
    }
  }

  private handleAbilityUse(payload: { ability: string }) {
    const char = this.getCharacter();
    if (!char) return;

    const { ability } = payload;
    
    // Find nearest NPC within range
    const abilityRanges: Record<string, number> = {
      'Q': 60,
      'W': 150,
      'E': 0,
      'R': 200,
    };

    const range = abilityRanges[ability] ?? 100;
    const damage = ability === 'R' ? 50 : ability === 'Q' ? 20 : 10;

    if (ability === 'E') {
      // Shield - heal self
      char.hp = Math.min(char.maxHp, char.hp + 30);
      this.emit('system:notice', { message: '🛡️ Shield activated! +30 HP' });
      this.emitWorldState();
      return;
    }

    // Find target in range
    let target: any = null;
    let minDist = Infinity;
    state.npcs.forEach(npc => {
      if (npc.zone !== char.zone) return;
      const dx = npc.x - char.x;
      const dy = npc.y - char.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= range && dist < minDist) {
        minDist = dist;
        target = npc;
      }
    });

    if (target) {
      target.hp = Math.max(0, target.hp - damage);
      this.emit('combat:hit', { attackerId: char.id, targetId: target.id, damage, targetHp: target.hp });
      this.emit('system:notice', { message: `✨ ${ability} ability hit for ${damage} damage!` });

      if (target.hp <= 0) {
        // Drop loot
        const lootTemplates = ['tpl_wood', 'tpl_stone', 'tpl_iron', 'tpl_gold'];
        const tplId = lootTemplates[Math.floor(Math.random() * lootTemplates.length)];
        const instanceId = uuid();
        state.instances.set(instanceId, { id: instanceId, templateId: tplId });
        
        const lootId = uuid();
        state.loot.set(lootId, {
          id: lootId,
          itemInstanceId: instanceId,
          quantity: Math.floor(Math.random() * 5) + 1,
          x: target.x,
          y: target.y,
          zone: target.zone,
          expiresAt: Date.now() + 10 * 60 * 1000,
        });

        state.npcs.delete(target.id);
        this.emit('system:notice', { message: `${target.name} defeated!` });
      }

      this.emitWorldState();
    } else {
      this.emit('system:notice', { message: `✨ ${ability} ability — no target in range` });
    }
  }

  // ============ Auth ============

  private handleRegister(payload: { email: string; password: string; characterName: string }) {
    if (state.users.has(payload.email)) {
      this.emit('auth:error', { message: 'Email already registered' });
      return;
    }

    const charId = uuid();
    const character: Character = {
      id: charId,
      name: payload.characterName,
      x: 0, y: 0,
      zone: 'hub',
      status: 'alive',
      hp: 100, maxHp: 100,
      maxStashSlots: 2,
    };
    state.characters.set(charId, character);
    state.users.set(payload.email, { email: payload.email, password: payload.password, characterId: charId });

    this.data = { userId: uuid(), characterId: charId, role: 'player' };
    this.emit('auth:success', { token: 'mock-token-' + charId, character });
    this.emitWorldState();
  }

  private handleLogin(payload: { email: string; password: string }) {
    const user = state.users.get(payload.email);
    if (!user || user.password !== payload.password) {
      this.emit('auth:error', { message: 'Invalid credentials' });
      return;
    }

    const character = state.characters.get(user.characterId);
    if (!character) {
      this.emit('auth:error', { message: 'Character not found' });
      return;
    }

    this.data = { userId: uuid(), characterId: character.id, role: payload.email === 'god@mmo.local' ? 'god' : 'player' };
    this.emit('auth:success', { token: 'mock-token-' + character.id, character });
    this.emitWorldState();
  }

  // ============ Character ============

  private handleMove(payload: { x: number; y: number }) {
    const char = this.getCharacter();
    if (!char) return;

    char.x = Math.max(-500, Math.min(500, payload.x));
    char.y = Math.max(-500, Math.min(500, payload.y));
    this.emitWorldState();
  }

  // ============ Inventory ============

  private handlePickup(payload: { lootId: string }) {
    const char = this.getCharacter();
    if (!char) return;

    const loot = state.loot.get(payload.lootId);
    if (!loot) {
      this.emit('inventory:error', { message: 'Loot not found' });
      return;
    }

    if (loot.expiresAt < Date.now()) {
      this.emit('inventory:error', { message: 'Loot expired' });
      return;
    }

    const inv = getInventorySlots(char.id);
    const maxSlots = 10;
    if (inv.length >= maxSlots) {
      this.emit('inventory:error', { message: 'Inventory full' });
      return;
    }

    const usedIndices = new Set(inv.map(s => s.slotIndex));
    let freeIndex = -1;
    for (let i = 0; i < maxSlots; i++) {
      if (!usedIndices.has(i)) { freeIndex = i; break; }
    }

    const slotId = uuid();
    state.inventory.set(slotId, {
      id: slotId,
      characterId: char.id,
      itemInstanceId: loot.itemInstanceId,
      quantity: loot.quantity,
      slotIndex: freeIndex,
    });

    state.loot.delete(payload.lootId);
    this.emitInventoryUpdate();
    this.emitWorldState();
  }

  private handleEquip(payload: { slotIndex: number; equipmentSlot: string }) {
    const char = this.getCharacter();
    if (!char) return;

    const invSlot = getInventorySlots(char.id).find(s => s.slotIndex === payload.slotIndex);
    if (!invSlot) {
      this.emit('inventory:error', { message: 'Item not found' });
      return;
    }

    const instance = state.instances.get(invSlot.itemInstanceId);
    if (!instance) return;

    const template = state.templates.get(instance.templateId);
    if (!template || template.type !== payload.equipmentSlot) {
      this.emit('inventory:error', { message: 'Item cannot be equipped in this slot' });
      return;
    }

    const existingEquip = getEquipmentSlots(char.id).find(s => s.slotType === payload.equipmentSlot);
    if (existingEquip) {
      this.emit('inventory:error', { message: 'Slot already occupied' });
      return;
    }

    const equipId = uuid();
    state.equipment.set(equipId, {
      id: equipId,
      characterId: char.id,
      itemInstanceId: invSlot.itemInstanceId,
      slotType: payload.equipmentSlot,
    });

    state.inventory.delete(invSlot.id);
    this.emitInventoryUpdate();
  }

  private handleUnequip(payload: { equipmentSlot: string }) {
    const char = this.getCharacter();
    if (!char) return;

    const equipSlot = getEquipmentSlots(char.id).find(s => s.slotType === payload.equipmentSlot);
    if (!equipSlot) {
      this.emit('inventory:error', { message: 'No item in slot' });
      return;
    }

    const inv = getInventorySlots(char.id);
    if (inv.length >= 10) {
      this.emit('inventory:error', { message: 'Inventory full' });
      return;
    }

    const usedIndices = new Set(inv.map(s => s.slotIndex));
    let freeIndex = -1;
    for (let i = 0; i < 10; i++) {
      if (!usedIndices.has(i)) { freeIndex = i; break; }
    }

    const slotId = uuid();
    state.inventory.set(slotId, {
      id: slotId,
      characterId: char.id,
      itemInstanceId: equipSlot.itemInstanceId,
      quantity: 1,
      slotIndex: freeIndex,
    });

    state.equipment.delete(equipSlot.id);
    this.emitInventoryUpdate();
  }

  private handleDrop(payload: { slotIndex: number; quantity: number }) {
    const char = this.getCharacter();
    if (!char) return;

    const invSlot = getInventorySlots(char.id).find(s => s.slotIndex === payload.slotIndex);
    if (!invSlot) {
      this.emit('inventory:error', { message: 'Item not found' });
      return;
    }

    if (payload.quantity > invSlot.quantity) {
      this.emit('inventory:error', { message: 'Quantity exceeds stack' });
      return;
    }

    const lootId = uuid();
    state.loot.set(lootId, {
      id: lootId,
      itemInstanceId: invSlot.itemInstanceId,
      quantity: payload.quantity,
      x: char.x,
      y: char.y,
      zone: char.zone,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    if (payload.quantity === invSlot.quantity) {
      state.inventory.delete(invSlot.id);
    } else {
      invSlot.quantity -= payload.quantity;
    }

    this.emitInventoryUpdate();
    this.emitWorldState();
  }

  // ============ Crafting ============

  private handleCraft(payload: { recipeId: string }) {
    const char = this.getCharacter();
    if (!char) return;

    const recipe = state.recipes.get(payload.recipeId);
    if (!recipe) {
      this.emit('inventory:error', { message: 'Recipe not found' });
      return;
    }

    const known = state.knowledge.get(char.id);
    if (!known?.has(recipe.id)) {
      this.emit('inventory:error', { message: 'Recipe not learned' });
      return;
    }

    const inv = getInventorySlots(char.id);
    
    // Check resources
    const resourceMap = new Map<string, { slots: InventorySlot[]; total: number }>();
    for (const slot of inv) {
      const instance = state.instances.get(slot.itemInstanceId);
      if (!instance) continue;
      const existing = resourceMap.get(instance.templateId);
      if (existing) {
        existing.slots.push(slot);
        existing.total += slot.quantity;
      } else {
        resourceMap.set(instance.templateId, { slots: [slot], total: slot.quantity });
      }
    }

    for (const [templateId, required] of Object.entries(recipe.requiredResources)) {
      const available = resourceMap.get(templateId);
      if (!available || available.total < required) {
        const template = state.templates.get(templateId);
        this.emit('inventory:error', { message: `Missing: ${template?.name ?? templateId}` });
        return;
      }
    }

    // Check free slot
    if (inv.length >= 10) {
      this.emit('inventory:error', { message: 'Inventory full' });
      return;
    }

    // Consume resources
    for (const [templateId, required] of Object.entries(recipe.requiredResources)) {
      let remaining = required;
      const available = resourceMap.get(templateId)!;
      for (const slot of available.slots) {
        if (remaining <= 0) break;
        if (slot.quantity <= remaining) {
          state.inventory.delete(slot.id);
          state.instances.delete(slot.itemInstanceId);
          remaining -= slot.quantity;
        } else {
          slot.quantity -= remaining;
          remaining = 0;
        }
      }
    }

    // Create result
    const instanceId = uuid();
    const template = state.templates.get(recipe.resultTemplateId)!;
    state.instances.set(instanceId, {
      id: instanceId,
      templateId: template.id,
      currentDurability: template.maxDurability,
      customStats: template.defaultStats,
    });

    const usedIndices = new Set(getInventorySlots(char.id).map(s => s.slotIndex));
    let freeIndex = -1;
    for (let i = 0; i < 10; i++) {
      if (!usedIndices.has(i)) { freeIndex = i; break; }
    }

    const slotId = uuid();
    state.inventory.set(slotId, {
      id: slotId,
      characterId: char.id,
      itemInstanceId: instanceId,
      quantity: recipe.resultQuantity,
      slotIndex: freeIndex,
    });

    this.emitInventoryUpdate();
    this.emit('system:notice', { message: `Crafted: ${template.name}` });
  }

  private handleSalvage(payload: { slotIndex: number }) {
    const char = this.getCharacter();
    if (!char) return;

    const invSlot = getInventorySlots(char.id).find(s => s.slotIndex === payload.slotIndex);
    if (!invSlot) {
      this.emit('inventory:error', { message: 'Item not found' });
      return;
    }

    const instance = state.instances.get(invSlot.itemInstanceId);
    if (!instance) return;

    const template = state.templates.get(instance.templateId);
    if (!template?.salvageYield) {
      this.emit('inventory:error', { message: 'Cannot be salvaged' });
      return;
    }

    // Check if equipped
    const equipped = getEquipmentSlots(char.id).find(s => s.itemInstanceId === invSlot.itemInstanceId);
    if (equipped) {
      this.emit('inventory:error', { message: 'Cannot salvage equipped items' });
      return;
    }

    // Delete original
    state.inventory.delete(invSlot.id);
    state.instances.delete(invSlot.itemInstanceId);

    // Create salvage results
    const inv = getInventorySlots(char.id);
    const usedIndices = new Set(inv.map(s => s.slotIndex));
    let nextIndex = 0;
    
    for (const [name, qty] of Object.entries(template.salvageYield)) {
      const tpl = Array.from(state.templates.values()).find(t => t.name === name);
      if (!tpl) continue;

      while (usedIndices.has(nextIndex)) nextIndex++;

      const instanceId = uuid();
      state.instances.set(instanceId, { id: instanceId, templateId: tpl.id });
      
      const slotId = uuid();
      state.inventory.set(slotId, {
        id: slotId,
        characterId: char.id,
        itemInstanceId: instanceId,
        quantity: qty,
        slotIndex: nextIndex,
      });
      usedIndices.add(nextIndex);
      nextIndex++;
    }

    this.emitInventoryUpdate();
    this.emit('system:notice', { message: 'Salvaged!' });
  }

  // ============ Combat ============

  private handleAttack(payload: { targetId: string }) {
    const char = this.getCharacter();
    if (!char) return;

    if (char.zone === 'hub') {
      this.emit('system:error', { code: 'PVP_DISABLED', message: 'PvP disabled in hub' });
      return;
    }

    // Try NPC
    const npc = state.npcs.get(payload.targetId);
    if (npc) {
      const equip = getEquipmentSlots(char.id).find(s => s.slotType === 'weapon');
      let damage = 5;
      if (equip) {
        const instance = state.instances.get(equip.itemInstanceId);
        if (instance) {
          const template = state.templates.get(instance.templateId);
          damage = template?.defaultStats?.damage ?? 10;
        }
      }

      npc.hp = Math.max(0, npc.hp - damage);
      this.emit('combat:hit', { attackerId: char.id, targetId: npc.id, damage, targetHp: npc.hp });

      if (npc.hp <= 0) {
        // Drop loot
        const lootTemplates = ['tpl_wood', 'tpl_stone', 'tpl_iron', 'tpl_gold'];
        const tplId = lootTemplates[Math.floor(Math.random() * lootTemplates.length)];
        const instanceId = uuid();
        state.instances.set(instanceId, { id: instanceId, templateId: tplId });
        
        const lootId = uuid();
        state.loot.set(lootId, {
          id: lootId,
          itemInstanceId: instanceId,
          quantity: Math.floor(Math.random() * 5) + 1,
          x: npc.x,
          y: npc.y,
          zone: npc.zone,
          expiresAt: Date.now() + 10 * 60 * 1000,
        });

        state.npcs.delete(npc.id);
        this.emit('system:notice', { message: `${npc.name} defeated!` });
      }

      this.emitWorldState();
      return;
    }

    // Try player
    const target = state.characters.get(payload.targetId);
    if (target) {
      if (target.zone === 'hub') {
        this.emit('system:error', { code: 'PVP_DISABLED', message: 'Cannot attack in hub' });
        return;
      }

      const equip = getEquipmentSlots(char.id).find(s => s.slotType === 'weapon');
      let damage = 5;
      if (equip) {
        const instance = state.instances.get(equip.itemInstanceId);
        if (instance) {
          const template = state.templates.get(instance.templateId);
          damage = template?.defaultStats?.damage ?? 10;
        }
      }

      target.hp = Math.max(0, target.hp - damage);
      this.emit('combat:hit', { attackerId: char.id, targetId: target.id, damage, targetHp: target.hp });

      if (target.hp <= 0) {
        target.status = 'dead';
        // Drop all inventory
        for (const slot of getInventorySlots(target.id)) {
          const lootId = uuid();
          state.loot.set(lootId, {
            id: lootId,
            itemInstanceId: slot.itemInstanceId,
            quantity: slot.quantity,
            x: target.x,
            y: target.y,
            zone: target.zone,
            expiresAt: Date.now() + 10 * 60 * 1000,
          });
          state.inventory.delete(slot.id);
        }
        for (const slot of getEquipmentSlots(target.id)) {
          const lootId = uuid();
          state.loot.set(lootId, {
            id: lootId,
            itemInstanceId: slot.itemInstanceId,
            quantity: 1,
            x: target.x,
            y: target.y,
            zone: target.zone,
            expiresAt: Date.now() + 10 * 60 * 1000,
          });
          state.equipment.delete(slot.id);
        }
        this.emit('character:died', { characterId: target.id, killerId: char.id });
      }

      this.emitWorldState();
    }
  }

  // ============ World ============

  private handleHarvest(payload: { nodeId: string }) {
    const char = this.getCharacter();
    if (!char) return;

    const node = state.nodes.get(payload.nodeId);
    if (!node) {
      this.emit('inventory:error', { message: 'Node not found' });
      return;
    }

    if (node.isDepleted) {
      this.emit('inventory:error', { message: 'Node depleted' });
      return;
    }

    const inv = getInventorySlots(char.id);
    
    // Try to stack with existing
    const existing = inv.find(s => {
      const inst = state.instances.get(s.itemInstanceId);
      return inst?.templateId === node.templateId;
    });

    if (existing) {
      existing.quantity += 1;
    } else {
      if (inv.length >= 10) {
        this.emit('inventory:error', { message: 'Inventory full' });
        return;
      }

      const instanceId = uuid();
      state.instances.set(instanceId, { id: instanceId, templateId: node.templateId });

      const usedIndices = new Set(inv.map(s => s.slotIndex));
      let freeIndex = -1;
      for (let i = 0; i < 10; i++) {
        if (!usedIndices.has(i)) { freeIndex = i; break; }
      }

      const slotId = uuid();
      state.inventory.set(slotId, {
        id: slotId,
        characterId: char.id,
        itemInstanceId: instanceId,
        quantity: 1,
        slotIndex: freeIndex,
      });
    }

    node.isDepleted = true;
    node.respawnAt = Date.now() + 30 * 1000; // 30 sec

    // Respawn after delay
    setTimeout(() => {
      node.isDepleted = false;
      this.emitWorldState();
    }, 30 * 1000);

    this.emitInventoryUpdate();
    this.emitWorldState();
    this.emit('system:notice', { message: 'Resource harvested!' });
  }

  // ============ Raid ============

  private handleRaidEnter(payload: { zoneId: string }) {
    const char = this.getCharacter();
    if (!char) return;

    if (char.zone !== 'hub') {
      this.emit('system:error', { code: 'NOT_IN_HUB', message: 'Must be in hub' });
      return;
    }

    char.zone = payload.zoneId;
    char.x = 0;
    char.y = 0;

    this.emit('raid:started', {
      raidId: uuid(),
      zoneId: payload.zoneId,
      endTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });

    this.emitWorldState();
    this.emit('system:notice', { message: `Entered raid: ${payload.zoneId}` });
  }

  private handleRaidExtract() {
    const char = this.getCharacter();
    if (!char) return;

    if (char.zone === 'hub') {
      this.emit('system:error', { code: 'NOT_IN_RAID', message: 'Not in raid' });
      return;
    }

    // Check for portal stone
    const inv = getInventorySlots(char.id);
    const portalSlot = inv.find(s => {
      const inst = state.instances.get(s.itemInstanceId);
      if (!inst) return false;
      const tpl = state.templates.get(inst.templateId);
      return tpl?.type === 'portal_stone';
    });

    if (!portalSlot) {
      this.emit('system:error', { code: 'NO_PORTAL', message: 'No portal stone' });
      return;
    }

    // Consume portal stone
    state.inventory.delete(portalSlot.id);
    state.instances.delete(portalSlot.itemInstanceId);

    // Teleport to hub (keep loot!)
    char.zone = 'hub';
    char.x = 0;
    char.y = 0;

    this.emit('character:extracted', { characterId: char.id });
    this.emitInventoryUpdate();
    this.emitWorldState();
    this.emit('system:notice', { message: 'Successfully extracted!' });
  }

  // ============ Stash ============

  private handleStashDeposit(payload: { slotIndex: number }) {
    const char = this.getCharacter();
    if (!char) return;

    if (char.zone !== 'hub') {
      this.emit('inventory:error', { message: 'Only in hub' });
      return;
    }

    const invSlot = getInventorySlots(char.id).find(s => s.slotIndex === payload.slotIndex);
    if (!invSlot) {
      this.emit('inventory:error', { message: 'Item not found' });
      return;
    }

    const stashSlots = getStashSlots(char.id);
    if (stashSlots.length >= char.maxStashSlots) {
      this.emit('inventory:error', { message: 'Stash full' });
      return;
    }

    const usedIndices = new Set(stashSlots.map(s => s.slotIndex));
    let freeIndex = -1;
    for (let i = 0; i < char.maxStashSlots; i++) {
      if (!usedIndices.has(i)) { freeIndex = i; break; }
    }

    const slotId = uuid();
    state.stash.set(slotId, {
      id: slotId,
      characterId: char.id,
      itemInstanceId: invSlot.itemInstanceId,
      quantity: invSlot.quantity,
      slotIndex: freeIndex,
    });

    state.inventory.delete(invSlot.id);
    this.emitInventoryUpdate();
    this.emitStashUpdate();
  }

  private handleStashWithdraw(payload: { stashIndex: number }) {
    const char = this.getCharacter();
    if (!char) return;

    if (char.zone !== 'hub') {
      this.emit('inventory:error', { message: 'Only in hub' });
      return;
    }

    const stashSlot = getStashSlots(char.id).find(s => s.slotIndex === payload.stashIndex);
    if (!stashSlot) {
      this.emit('inventory:error', { message: 'Item not found in stash' });
      return;
    }

    const inv = getInventorySlots(char.id);
    if (inv.length >= 10) {
      this.emit('inventory:error', { message: 'Inventory full' });
      return;
    }

    const usedIndices = new Set(inv.map(s => s.slotIndex));
    let freeIndex = -1;
    for (let i = 0; i < 10; i++) {
      if (!usedIndices.has(i)) { freeIndex = i; break; }
    }

    const slotId = uuid();
    state.inventory.set(slotId, {
      id: slotId,
      characterId: char.id,
      itemInstanceId: stashSlot.itemInstanceId,
      quantity: stashSlot.quantity,
      slotIndex: freeIndex,
    });

    state.stash.delete(stashSlot.id);
    this.emitInventoryUpdate();
    this.emitStashUpdate();
  }

  // ============ Chat ============

  private handleChatSend(payload: { channel: string; message: string; targetId?: string }) {
    const char = this.getCharacter();
    if (!char) return;

    if (!payload.message || payload.message.length > 200) {
      this.emit('system:error', { code: 'INVALID_MESSAGE', message: 'Invalid message' });
      return;
    }

    const msg: ChatMessage = {
      id: uuid(),
      channel: payload.channel as any,
      senderId: char.id,
      senderName: char.name,
      message: payload.message,
      timestamp: Date.now(),
    };

    state.chatHistory.push(msg);
    if (state.chatHistory.length > 100) state.chatHistory.shift();

    this.emit('chat:message', msg);
  }

  // ============ God Mode ============

  private handleGodSpawn(payload: { type: string; templateId: string; x: number; y: number; zone: string; quantity?: number }) {
    if (this.data.role !== 'god') {
      this.emit('system:error', { code: 'GOD_REQUIRED', message: 'God mode required' });
      return;
    }

    const qty = payload.quantity ?? 1;
    for (let i = 0; i < qty; i++) {
      const instanceId = uuid();
      state.instances.set(instanceId, { id: instanceId, templateId: payload.templateId });

      const lootId = uuid();
      state.loot.set(lootId, {
        id: lootId,
        itemInstanceId: instanceId,
        quantity: 1,
        x: payload.x + i * 10,
        y: payload.y,
        zone: payload.zone,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });
    }

    this.emit('god:ack', { action: 'spawn', success: true });
    this.emitWorldState();
  }

  // ============ Helpers ============

  private getCharacter(): Character | null {
    if (!this.data.characterId) {
      this.emit('system:error', { code: 'UNAUTHORIZED', message: 'Not authenticated' });
      return null;
    }
    const char = state.characters.get(this.data.characterId);
    if (!char) {
      this.emit('system:error', { code: 'NOT_FOUND', message: 'Character not found' });
      return null;
    }
    return char;
  }

  private emitWorldState() {
    const char = this.getCharacter();
    if (!char) return;

    const charsInZone = Array.from(state.characters.values()).filter(c => c.zone === char.zone && c.id !== char.id);
    const loot = getLootInZone(char.zone);
    const nodes = getNodesInZone(char.zone);
    const npcs = getNpcsInZone(char.zone);

    this.emit('world:state', {
      players: charsInZone.map(c => ({ characterId: c.id, name: c.name, x: c.x, y: c.y, hp: c.hp, maxHp: c.maxHp })),
      npcs: npcs.map(n => ({ id: n.id, templateId: n.name, x: n.x, y: n.y, hp: n.hp, maxHp: n.maxHp, state: n.state })),
      loot: loot.map(l => {
        const inst = state.instances.get(l.itemInstanceId);
        const tpl = inst ? state.templates.get(inst.templateId) : null;
        return { id: l.id, itemTemplateId: inst?.templateId ?? '', itemName: tpl?.name ?? '', quantity: l.quantity, x: l.x, y: l.y, expiresAt: new Date(l.expiresAt).toISOString() };
      }),
      nodes: nodes.map(n => {
        const tpl = state.templates.get(n.templateId);
        return { id: n.id, x: n.x, y: n.y, templateId: n.templateId, templateName: tpl?.name ?? '', isDepleted: n.isDepleted, respawnAt: new Date(n.respawnAt).toISOString() };
      }),
    });
  }

  private emitInventoryUpdate() {
    const char = this.getCharacter();
    if (!char) return;

    const inv = getInventorySlots(char.id);
    const equip = getEquipmentSlots(char.id);

    this.emit('inventory:update', {
      slots: inv.map(s => {
        const inst = state.instances.get(s.itemInstanceId);
        const tpl = inst ? state.templates.get(inst.templateId) : null;
        return {
          slotIndex: s.slotIndex,
          itemInstanceId: s.itemInstanceId,
          templateId: inst?.templateId ?? '',
          templateName: tpl?.name ?? '',
          templateType: tpl?.type ?? '',
          quantity: s.quantity,
          durability: inst?.currentDurability,
          maxDurability: tpl?.maxDurability,
        };
      }),
      equipment: equip.map(s => {
        const inst = state.instances.get(s.itemInstanceId);
        const tpl = inst ? state.templates.get(inst.templateId) : null;
        return {
          slotType: s.slotType,
          itemInstanceId: s.itemInstanceId,
          templateId: inst?.templateId ?? '',
          templateName: tpl?.name ?? '',
          quantity: 1,
          durability: inst?.currentDurability,
          maxDurability: tpl?.maxDurability,
        };
      }),
    });
  }

  private emitStashUpdate() {
    const char = this.getCharacter();
    if (!char) return;

    const stashSlots = getStashSlots(char.id);
    this.emit('stash:update', {
      slots: stashSlots.map(s => {
        const inst = state.instances.get(s.itemInstanceId);
        const tpl = inst ? state.templates.get(inst.templateId) : null;
        return {
          slotIndex: s.slotIndex,
          itemInstanceId: s.itemInstanceId,
          templateId: inst?.templateId ?? '',
          templateName: tpl?.name ?? '',
          templateType: tpl?.type ?? '',
          quantity: s.quantity,
        };
      }),
      maxSlots: char.maxStashSlots,
    });
  }
}

// ============ Exports ============

export function createMockSocket(): MockSocket {
  return new MockSocket();
}

export function getRecipes() {
  return Array.from(state.recipes.values());
}

export function getTemplates() {
  return Array.from(state.templates.values());
}

export function getChatHistory() {
  return [...state.chatHistory];
}

export function learnRecipe(characterId: string, recipeId: string) {
  if (!state.knowledge.has(characterId)) {
    state.knowledge.set(characterId, new Set());
  }
  state.knowledge.get(characterId)!.add(recipeId);
}

export function getState() {
  return state;
}
