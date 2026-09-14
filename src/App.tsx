import { useState, useEffect, useRef, useCallback } from 'react';
import { MockSocket, createMockSocket, getRecipes, learnRecipe, getState } from './mock/server';
import { GameWorld } from './components/GameWorld';
import { InventoryPanel } from './components/InventoryPanel';
import { StashPanel } from './components/StashPanel';
import { CraftingPanel } from './components/CraftingPanel';
import { RaidPanel } from './components/RaidPanel';
import { ChatPanel } from './components/ChatPanel';
import { GodPanel } from './components/GodPanel';
import { LoginScreen } from './components/LoginScreen';

export type Tab = 'world' | 'inventory' | 'stash' | 'craft' | 'raid' | 'chat' | 'god';

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

export interface StashSlotData {
  slotIndex: number;
  itemInstanceId: string;
  templateId: string;
  templateName: string;
  templateType: string;
  quantity: number;
}

export interface WorldState {
  players: Array<{ characterId: string; name: string; x: number; y: number; hp: number; maxHp: number }>;
  npcs: Array<{ id: string; templateId: string; x: number; y: number; hp: number; maxHp: number; state: string }>;
  loot: Array<{ id: string; itemTemplateId: string; itemName: string; quantity: number; x: number; y: number; expiresAt: string }>;
  nodes: Array<{ id: string; x: number; y: number; templateId: string; templateName: string; isDepleted: boolean; respawnAt: string }>;
}

export interface ChatMessage {
  id: string;
  channel: 'global' | 'zone' | 'private' | 'system';
  senderId?: string;
  senderName?: string;
  message: string;
  timestamp: number;
}

export default function App() {
  const [socket, setSocket] = useState<MockSocket | null>(null);
  const [character, setCharacter] = useState<CharacterData | null>(null);
  const [inventory, setInventory] = useState<InventorySlotData[]>([]);
  const [equipment, setEquipment] = useState<EquipmentSlotData[]>([]);
  const [stash, setStash] = useState<StashSlotData[]>([]);
  const [worldState, setWorldState] = useState<WorldState>({ players: [], npcs: [], loot: [], nodes: [] });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('world');
  const [isGod, setIsGod] = useState(false);

  const addNotice = useCallback((msg: string) => {
    setNotices(prev => [...prev.slice(-4), msg]);
    setTimeout(() => setNotices(prev => prev.slice(1)), 4000);
  }, []);

  useEffect(() => {
    const sock = createMockSocket();

    sock.on('auth:success', (data: any) => {
      setCharacter(data.character);
      setIsGod(sock.data.role === 'god');
      // Learn all recipes for demo
      learnRecipe(data.character.id, 'rec_sword_wood');
      learnRecipe(data.character.id, 'rec_sword_iron');
      learnRecipe(data.character.id, 'rec_armor');
      learnRecipe(data.character.id, 'rec_potion');
      learnRecipe(data.character.id, 'rec_portal');
    });

    sock.on('auth:error', (data: any) => {
      addNotice(`❌ ${data.message}`);
    });

    sock.on('inventory:update', (data: any) => {
      setInventory(data.slots);
      setEquipment(data.equipment);
    });

    sock.on('stash:update', (data: any) => {
      setStash(data.slots);
    });

    sock.on('world:state', (data: any) => {
      setWorldState(data);
    });

    sock.on('chat:message', (msg: any) => {
      setChatMessages(prev => [...prev.slice(-49), msg]);
    });

    sock.on('combat:hit', (data: any) => {
      addNotice(`⚔️ Hit! ${data.damage} dmg (HP: ${data.targetHp})`);
    });

    sock.on('character:extracted', () => {
      addNotice('🏠 Extracted to hub!');
    });

    sock.on('character:died', (data: any) => {
      if (data.characterId === sock.data.characterId) {
        addNotice('💀 You died! All loot dropped.');
      } else {
        addNotice(`💀 Player defeated!`);
      }
    });

    sock.on('raid:started', (data: any) => {
      addNotice(`🏰 Raid started in ${data.zoneId}!`);
    });

    sock.on('system:notice', (data: any) => {
      addNotice(`ℹ️ ${data.message}`);
    });

    sock.on('system:error', (data: any) => {
      addNotice(`❌ ${data.message}`);
    });

    sock.on('inventory:error', (data: any) => {
      addNotice(`❌ ${data.message}`);
    });

    sock.on('god:ack', (data: any) => {
      if (data.success) addNotice(`👑 God action: ${data.action}`);
      else addNotice(`❌ God action failed`);
    });

    setSocket(sock);

    return () => {
      sock.removeAllListeners();
    };
  }, [addNotice]);

  const handleLogin = (email: string, password: string, characterName?: string) => {
    if (!socket) return;
    if (characterName) {
      socket.sendToServer('auth:register', { email, password, characterName });
    } else {
      socket.sendToServer('auth:login', { email, password });
    }
  };

  const send = (event: string, payload?: any) => {
    socket?.sendToServer(event, payload);
  };

  if (!character) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'world', label: 'Мир', icon: '🌍' },
    { id: 'inventory', label: 'Инвентарь', icon: '🎒' },
    { id: 'stash', label: 'Сейф', icon: '🔒' },
    { id: 'craft', label: 'Крафт', icon: '🔨' },
    { id: 'raid', label: 'Рейд', icon: '⚔️' },
    { id: 'chat', label: 'Чат', icon: '💬' },
    ...(isGod ? [{ id: 'god' as Tab, label: 'God', icon: '👑' }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-gray-100 font-mono">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0d1220]/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <span className="text-white text-lg">⚔️</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-white">{character.name}</h1>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">Zone: <span className="text-emerald-400">{character.zone}</span></span>
                <span className="text-gray-600">•</span>
                <span className="text-gray-400">HP: <span className={character.hp < 30 ? 'text-red-400' : 'text-emerald-400'}>{character.hp}/{character.maxHp}</span></span>
                <span className="text-gray-600">•</span>
                <span className="text-gray-400">Pos: {Math.round(character.x)}, {Math.round(character.y)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => { setCharacter(null); setInventory([]); setEquipment([]); setStash([]); }}
            className="px-3 py-1.5 text-xs rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
          >
            Выйти
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="border-b border-gray-800 bg-[#0d1220]/50 sticky top-[68px] z-40">
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm whitespace-nowrap transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'border-emerald-400 text-emerald-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Notices */}
      <div className="fixed top-20 right-4 z-50 space-y-2 pointer-events-none">
        {notices.map((msg, i) => (
          <div
            key={i}
            className="px-3 py-2 rounded-lg bg-gray-900/95 border border-gray-700 text-xs text-gray-200 shadow-lg backdrop-blur-sm animate-fade-in max-w-xs"
          >
            {msg}
          </div>
        ))}
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'world' && socket && (
          <GameWorld
            character={character}
            worldState={worldState}
            onMove={(x: number, y: number) => send('character:move', { x, y })}
            onPickup={(lootId: string) => send('inventory:pickup', { lootId })}
            onHarvest={(nodeId: string) => send('resource:harvest', { nodeId })}
            onAttack={(targetId: string) => send('combat:attack', { targetId })}
          />
        )}
        {activeTab === 'inventory' && (
          <InventoryPanel
            inventory={inventory}
            equipment={equipment}
            onEquip={(slotIndex: number, equipmentSlot: string) => send('inventory:equip', { slotIndex, equipmentSlot })}
            onUnequip={(slot: string) => send('inventory:unequip', { equipmentSlot: slot })}
            onDrop={(slotIndex: number, quantity: number) => send('inventory:drop', { slotIndex, quantity })}
            onDeposit={(slotIndex: number) => send('stash:deposit', { slotIndex })}
            canDeposit={character.zone === 'hub'}
          />
        )}
        {activeTab === 'stash' && (
          <StashPanel
            stash={stash}
            maxSlots={character.maxStashSlots}
            onWithdraw={(stashIndex: number) => send('stash:withdraw', { stashIndex })}
            canAccess={character.zone === 'hub'}
          />
        )}
        {activeTab === 'craft' && (
          <CraftingPanel
            inventory={inventory}
            onCraft={(recipeId: string) => send('craft:start', { recipeId })}
            onSalvage={(slotIndex: number) => send('craft:salvage', { slotIndex })}
          />
        )}
        {activeTab === 'raid' && (
          <RaidPanel
            character={character}
            inventory={inventory}
            onEnterRaid={() => send('raid:enter', { zoneId: 'raid_zone_1' })}
            onExtract={() => send('raid:extract')}
          />
        )}
        {activeTab === 'chat' && (
          <ChatPanel
            messages={chatMessages}
            character={character}
            onSend={(channel: 'global' | 'zone' | 'private', message: string) => send('chat:send', { channel, message })}
          />
        )}
        {activeTab === 'god' && isGod && (
          <GodPanel
            character={character}
            onSpawn={(payload: any) => send('god:spawn', payload)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-8 py-4 text-center text-xs text-gray-500">
        MMO Survival — Mock Server Demo • Все данные в памяти браузера
      </footer>
    </div>
  );
}
