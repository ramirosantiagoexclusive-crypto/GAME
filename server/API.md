# 📡 Socket.io API Documentation

## 🔐 Authentication

Все события (кроме `auth:*`) требуют JWT токен в `auth.token`.

### `auth:register`
**Client → Server**

Регистрация нового аккаунта и персонажа.

```typescript
{
  email: string;        // Email (уникальный)
  password: string;     // Пароль (мин. 8 символов)
  characterName: string; // Имя персонажа (3-20 символов, уникальное)
}
```

**Response:** `auth:success` или `auth:error`

---

### `auth:login`
**Client → Server**

Вход в существующий аккаунт.

```typescript
{
  email: string;
  password: string;
}
```

**Response:** `auth:success` или `auth:error`

---

## 🎮 Character

### `character:move`
**Client → Server**

Перемещение персонажа.

```typescript
{
  x: number;  // Координата X (-10000 to 10000)
  y: number;  // Координата Y (-10000 to 10000)
}
```

**Broadcast:** `world:player_moved` (всем в зоне)

**Rate Limit:** 60 requests / 10 seconds

---

## 🎒 Inventory

### `inventory:pickup`
**Client → Server**

Подбор лута с земли.

```typescript
{
  lootId: string;  // UUID лута
}
```

**Response:** `inventory:update` или `inventory:error`

**Broadcast:** `loot:picked` (всем в зоне)

**Rate Limit:** 5 requests / 2 seconds

**⚠️ CRITICAL:** Использует Serializable transaction для предотвращения race conditions.

---

### `inventory:equip`
**Client → Server**

Экипировать предмет из инвентаря.

```typescript
{
  slotIndex: number;       // Индекс слота в инвентаре
  equipmentSlot: string;   // "weapon" | "armor" | "helmet" | "boots"
}
```

**Response:** `inventory:update` или `inventory:error`

**Rate Limit:** 5 requests / 2 seconds

---

### `inventory:unequip`
**Client → Server**

Снять предмет с экипировки в инвентарь.

```typescript
{
  equipmentSlot: string;  // "weapon" | "armor" | "helmet" | "boots"
}
```

**Response:** `inventory:update` или `inventory:error`

**Rate Limit:** 5 requests / 2 seconds

---

### `inventory:move`
**Client → Server**

Переместить предмет внутри инвентаря.

```typescript
{
  fromIndex: number;  // Индекс источника
  toIndex: number;    // Индекс назначения
}
```

**Response:** `inventory:update` или `inventory:error`

**Rate Limit:** 10 requests / 2 seconds

---

### `inventory:drop`
**Client → Server**

Выбросить предмет на землю.

```typescript
{
  slotIndex: number;   // Индекс слота
  quantity: number;    // Количество (1+)
}
```

**Response:** `inventory:update` или `inventory:error`

**Broadcast:** `loot:dropped` (всем в зоне)

**Rate Limit:** 5 requests / 2 seconds

---

## 🔨 Crafting

### `craft:start`
**Client → Server**

Скрафтить предмет по рецепту.

```typescript
{
  recipeId: string;  // UUID рецепта
}
```

**Response:** `inventory:update` + `system:notice` или `inventory:error`

**Rate Limit:** 3 requests / 5 seconds

**⚠️ CRITICAL:** Проверяет:
- Знание рецепта (PlayerKnowledge)
- Наличие ресурсов
- Свободные слоты в инвентаре

---

### `craft:salvage`
**Client → Server**

Переработать предмет в ресурсы.

```typescript
{
  slotIndex: number;  // Индекс слота в инвентаре
}
```

**Response:** `inventory:update` + `system:notice` или `inventory:error`

**Rate Limit:** 3 requests / 5 seconds

**⚠️ CRITICAL:** Нельзя перерабатывать экипированные предметы!

---

## ⚔️ Combat

### `combat:attack`
**Client → Server**

Атаковать цель (игрока или NPC).

```typescript
{
  targetId: string;  // UUID цели
}
```

**Response:** `combat:hit` или `combat:miss` или `system:error`

**Broadcast:** `combat:hit` (всем в зоне)

**Rate Limit:** 10 requests / 5 seconds

**⚠️ CRITICAL:**
- PvP заблокирован в зоне `hub`
- Нельзя атаковать мёртвых игроков
- Урон рассчитывается с учётом оружия и брони

---

## 🌍 World

### `resource:harvest`
**Client → Server**

Добыть ресурс с узла.

```typescript
{
  nodeId: string;  // UUID ресурсного узла
}
```

**Response:** `inventory:update` или `inventory:error`

**Rate Limit:** 5 requests / 5 seconds

**⚠️ CRITICAL:** Узел должен быть не истощён и готов к добыче.

---

## 🏰 Raid

### `raid:enter`
**Client → Server**

Войти в рейдовую зону.

```typescript
{
  zoneId: string;  // ID рейдовой зоны
}
```

**Response:** `raid:started` или `system:error`

**Rate Limit:** 2 requests / 10 seconds

**⚠️ CRITICAL:**
- Можно войти только из хаба
- Персонаж должен быть жив
- Таймер рейда: 15 минут

---

### `raid:extract`
**Client → Server**

Экстракция из рейда (использование портал-камня).

**No parameters required.**

**Response:** `character:extracted` + `inventory:update` или `system:error`

**Rate Limit:** 2 requests / 10 seconds

**⚠️ CRITICAL:**
- Работает ТОЛЬКО в рейдовых зонах (не в хабе)
- Портал-камень уничтожается при использовании
- Весь лут сохраняется!

---

## 👑 God Mode

Требует роль `god` в JWT токене.

### `god:spawn`
**Client → Server**

Спавн предметов или NPC.

```typescript
{
  type: "item" | "npc";
  templateId: string;  // UUID шаблона
  x: number;
  y: number;
  zone: string;
  quantity?: number;   // Только для items (default: 1)
}
```

**Response:** `god:ack`

**Broadcast:** `system:notice` (всем в зоне)

**Rate Limit:** 5 requests / 10 seconds

---

### `god:config`
**Client → Server**

Обновить Live Config.

```typescript
{
  key: string;    // Ключ конфигурации
  value: unknown; // Новое значение
}
```

**Response:** `god:ack` + `god:config_updated`

**Broadcast:** `system:notice` (всем)

**Rate Limit:** 3 requests / 10 seconds

---

### `god:event`
**Client → Server**

Запустить мировое событие.

```typescript
{
  eventType: string;  // Тип события
  duration: number;   // Длительность в секундах
}
```

**Response:** `god:ack`

**Broadcast:** `system:notice` (всем)

**Rate Limit:** 2 requests / 30 seconds

---

## 📡 Server → Client Events

### `auth:success`
Успешная авторизация.

```typescript
{
  token: string;       // JWT токен
  character: {
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
}
```

---

### `auth:error`
Ошибка авторизации.

```typescript
{
  message: string;
}
```

---

### `world:state`
Полное состояние зоны.

```typescript
{
  players: PlayerState[];
  npcs: NpcState[];
  loot: LootState[];
}
```

---

### `world:player_joined`
Игрок вошёл в зону.

```typescript
{
  characterId: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}
```

---

### `world:player_left`
Игрок покинул зону.

```typescript
{
  characterId: string;
}
```

---

### `world:player_moved`
Игрок переместился.

```typescript
{
  characterId: string;
  x: number;
  y: number;
}
```

---

### `combat:hit`
Результат атаки.

```typescript
{
  attackerId: string;
  targetId: string;
  damage: number;
  targetHp: number;
}
```

---

### `combat:miss`
Атака промахнулась.

```typescript
{
  attackerId: string;
  targetId: string;
  reason: string;
}
```

---

### `inventory:update`
Обновление инвентаря.

```typescript
{
  slots: InventorySlotData[];
  equipment: EquipmentSlotData[];
}
```

---

### `inventory:error`
Ошибка операции с инвентарём.

```typescript
{
  message: string;
}
```

---

### `loot:dropped`
Новый лут на земле.

```typescript
{
  id: string;
  itemTemplateId: string;
  itemName: string;
  quantity: number;
  x: number;
  y: number;
  expiresAt: string;  // ISO timestamp
}
```

---

### `loot:picked`
Лут подобран.

```typescript
{
  lootId: string;
}
```

---

### `loot:expired`
Лут истёк и исчез.

```typescript
{
  lootId: string;
}
```

---

### `character:died`
Персонаж умер.

```typescript
{
  characterId: string;
  killerId?: string;  // UUID убийцы (если PvP)
}
```

---

### `character:extracted`
Персонаж успешно экстрагировался из рейда.

```typescript
{
  characterId: string;
}
```

---

### `character:afk_warning`
Предупреждение об AFK.

```typescript
{
  secondsRemaining: number;
}
```

---

### `raid:started`
Рейд начат.

```typescript
{
  raidId: string;
  zoneId: string;
  endTime: string;  // ISO timestamp
}
```

---

### `raid:ended`
Рейд завершён.

```typescript
{
  raidId: string;
  status: string;  // "ended" | "wiped"
}
```

---

### `raid:timer`
Обновление таймера рейда.

```typescript
{
  secondsRemaining: number;
}
```

---

### `god:ack`
Подтверждение God Mode действия.

```typescript
{
  action: string;
  success: boolean;
  message?: string;
}
```

---

### `god:config_updated`
Live Config обновлён.

```typescript
{
  config: unknown;
}
```

---

### `system:error`
Системная ошибка.

```typescript
{
  code: string;
  message: string;
}
```

---

### `system:notice`
Системное уведомление.

```typescript
{
  message: string;
}
```

---

## 🚦 Rate Limiting

Все события защищены rate limiting. При превышении лимита:

```typescript
{
  code: "RATE_LIMITED",
  message: "Rate limit exceeded for {event}. Try again later."
}
```

### Лимиты по событиям

| Event | Max Requests | Window |
|-------|-------------|--------|
| `character:move` | 60 | 10s |
| `combat:attack` | 10 | 5s |
| `inventory:pickup` | 5 | 2s |
| `inventory:equip` | 5 | 2s |
| `inventory:unequip` | 5 | 2s |
| `inventory:move` | 10 | 2s |
| `inventory:drop` | 5 | 2s |
| `craft:start` | 3 | 5s |
| `craft:salvage` | 3 | 5s |
| `raid:enter` | 2 | 10s |
| `raid:extract` | 2 | 10s |
| `resource:harvest` | 5 | 5s |
| `god:spawn` | 5 | 10s |
| `god:config` | 3 | 10s |
| `god:event` | 2 | 30s |
| `auth:login` | 3 | 60s |
| `auth:register` | 2 | 60s |

---

## 🔒 Security Notes

### Serializable Transactions
Все операции инвентаря используют Serializable isolation level для предотвращения race conditions.

### Zone Validation
- PvP полностью заблокирован в зоне `hub`
- Портал-камень работает только в рейдовых зонах
- Нельзя атаковать игроков в хабе

### AFK Protection
- Рейд: 2 минуты AFK → потеря инвентаря и экипировки
- Хаб: 5 минут AFK → безопасный выход

### Loot TTL
Весь лут на земле автоматически удаляется через 10 минут.

---

## 📝 Example: Full Game Flow

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

// 1. Login
socket.emit('auth:login', {
  email: 'player@test.local',
  password: 'player12345'
});

socket.on('auth:success', ({ token, character }) => {
  console.log('Logged in as', character.name);
  
  // Reconnect with token
  socket.auth = { token };
  socket.connect();
});

// 2. Move to resource node
socket.emit('character:move', { x: 10, y: 10 });

// 3. Harvest resource
socket.emit('resource:harvest', { nodeId: 'node-uuid' });

// 4. Craft item
socket.emit('craft:start', { recipeId: 'recipe-uuid' });

// 5. Equip weapon
socket.emit('inventory:equip', {
  slotIndex: 0,
  equipmentSlot: 'weapon'
});

// 6. Enter raid
socket.emit('raid:enter', { zoneId: 'raid_zone_1' });

// 7. Fight NPCs
socket.emit('combat:attack', { targetId: 'npc-uuid' });

// 8. Extract with portal stone
socket.emit('raid:extract');
```
