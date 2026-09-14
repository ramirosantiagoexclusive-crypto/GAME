# 🚀 Быстрый Старт — MMO Survival Server

## 📋 Требования

- **Node.js** 18+ 
- **PostgreSQL** 14+
- **Redis** 7+

## 🔧 Установка

### 1. Клонировать и установить зависимости

```bash
cd server
npm install
```

### 2. Настроить базу данных

Создайте базу данных PostgreSQL:

```sql
CREATE DATABASE mmo_survival;
```

### 3. Настроить переменные окружения

```bash
cp .env.example .env
```

Отредактируйте `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mmo_survival?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-key-change-this-in-production"
```

### 4. Инициализировать базу данных

```bash
# Создать миграции
npx prisma migrate dev --name init

# Сгенерировать Prisma Client
npx prisma generate

# Запустить seed (создать тестовые данные)
npm run prisma:seed
```

### 5. Запустить сервер

```bash
# Development mode (с hot reload)
npm run dev

# Production mode
npm run build
npm start
```

Сервер запустится на `http://localhost:3001`

## 🧪 Тестовые учётные данные

После запуска seed:

### Player
- **Email:** `player@test.local`
- **Password:** `player12345`
- **Character:** TestHero

### God Mode
- **Email:** `god@mmo.local`
- **Password:** `god12345`

## 🎮 Подключение через Socket.io

### JavaScript пример

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
  auth: {
    token: 'YOUR_JWT_TOKEN' // После логина
  }
});

// Регистрация
socket.emit('auth:register', {
  email: 'newplayer@test.local',
  password: 'password123',
  characterName: 'MyHero'
});

socket.on('auth:success', ({ token, character }) => {
  console.log('Logged in!', character);
  // Сохранить token и переподключиться с ним
});

// Логин
socket.emit('auth:login', {
  email: 'player@test.local',
  password: 'player12345'
});

// Движение
socket.emit('character:move', { x: 10, y: 20 });

// Подбор лута
socket.emit('inventory:pickup', { lootId: 'uuid-of-loot' });

// Экипировка
socket.emit('inventory:equip', { 
  slotIndex: 0, 
  equipmentSlot: 'weapon' 
});

// Крафт
socket.emit('craft:start', { recipeId: 'uuid-of-recipe' });

// Атака
socket.emit('combat:attack', { targetId: 'uuid-of-target' });

// Войти в рейд
socket.emit('raid:enter', { zoneId: 'raid_zone_1' });

// Экстракция (портал-камень)
socket.emit('raid:extract');

// God Mode: спавн
socket.emit('god:spawn', {
  type: 'item',
  templateId: 'uuid-of-template',
  x: 5,
  y: 5,
  zone: 'hub',
  quantity: 10
});
```

## 📊 Мониторинг

### Health Check

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "ok",
  "uptime": 123.45
}
```

## 🗄️ Управление базой данных

### Prisma Studio (GUI)

```bash
npx prisma studio
```

Откроется на `http://localhost:5555`

### Сброс базы данных

```bash
npx prisma migrate reset
```

### Просмотр миграций

```bash
npx prisma migrate status
```

## 🐛 Отладка

### Логи

Сервер выводит логи в консоль:
- `[Auth]` — аутентификация
- `[Socket]` — подключения/отключения
- `[Inventory]` — операции инвентаря
- `[Combat]` — боевые действия
- `[Cron]` — запланированные задачи
- `[Redis]` — операции с Redis
- `[Prisma]` — запросы к БД

### Уровень логирования

В `.env`:

```env
NODE_ENV=development  # Подробные логи (включая SQL queries)
NODE_ENV=production   # Только ошибки
```

## 📁 Структура проекта

```
server/
├── src/
│   ├── config/              # Конфигурация
│   ├── middleware/          # Auth, zone validation
│   ├── modules/             # Бизнес-логика
│   │   ├── auth/           # Регистрация, логин
│   │   ├── inventory/      # Инвентарь, экипировка
│   │   ├── crafting/       # Крафт, salvage
│   │   ├── world/          # Ресурсы, лут
│   │   ├── combat/         # PvP/PvE
│   │   ├── raid/           # Рейды, экстракция
│   │   └── god/            # God Mode
│   ├── services/           # Prisma, Redis, Cron
│   ├── socket/             # Socket.io handlers
│   ├── types/              # TypeScript типы
│   └── index.ts            # Точка входа
├── prisma/
│   ├── schema.prisma       # Схема БД
│   └── seed.ts             # Начальные данные
└── package.json
```

## 🔒 Безопасность

### Реализовано

- ✅ JWT аутентификация
- ✅ Zone validation (PvP заблокирован в хабе)
- ✅ Serializable transactions для инвентаря
- ✅ Rate limiting через Redis
- ✅ Input validation (Zod)
- ✅ God mode guard
- ✅ AFK timers (серверные)
- ✅ Loot TTL (автоматическая очистка)

### Рекомендации для production

- [ ] Использовать HTTPS
- [ ] Rotate JWT_SECRET регулярно
- [ ] Настроить CORS для конкретного домена
- [ ] Включить Redis persistence
- [ ] Настроить backup PostgreSQL
- [ ] Использовать connection pooling
- [ ] Добавить DDoS protection (CloudFlare, etc.)

## 🚨 Troubleshooting

### Ошибка: "Can't reach database server"

Проверьте что PostgreSQL запущен:

```bash
# macOS
brew services start postgresql

# Linux
sudo systemctl start postgresql

# Docker
docker start postgres
```

### Ошибка: "Can't connect to Redis"

Проверьте что Redis запущен:

```bash
# macOS
brew services start redis

# Linux
sudo systemctl start redis

# Docker
docker start redis
```

### Ошибка: "Port 3001 already in use"

Измените порт в `.env`:

```env
PORT=3002
```

### Ошибка: "Prisma Client not generated"

```bash
npx prisma generate
```

## 📚 Дополнительная информация

- [Prisma Documentation](https://www.prisma.io/docs)
- [Socket.io Documentation](https://socket.io/docs/v4)
- [Redis Documentation](https://redis.io/docs)

## 🤝 Поддержка

При возникновении проблем:
1. Проверьте логи сервера
2. Убедитесь что все сервисы запущены
3. Проверьте `.env` конфигурацию
4. Попробуйте сбросить базу: `npx prisma migrate reset`

---

**Версия:** 1.0.0  
**Последнее обновление:** 2024
