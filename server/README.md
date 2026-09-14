# MMO Survival Server

Production-ready backend для браузерной 2D Open-World Survival MMO.

## 🛠 Стек

- **Runtime:** Node.js + TypeScript (Strict Mode)
- **Database:** PostgreSQL + Prisma ORM
- **Real-time:** Socket.io (WebSockets)
- **Cache:** Redis (Live Config, AFK timers, rate limiting)
- **Scheduler:** node-cron (респауны, очистка лута, AFK проверки)

## 📦 Установка

```bash
cd server
npm install
```

## 🔧 Настройка

1. Скопируйте `.env.example` в `.env`:
```bash
cp .env.example .env
```

2. Настройте переменные окружения:
- `DATABASE_URL` — подключение к PostgreSQL
- `REDIS_URL` — подключение к Redis
- `JWT_SECRET` — секрет для JWT (используйте `openssl rand -hex 32`)

3. Инициализируйте базу данных:
```bash
npm run prisma:migrate
npm run prisma:generate
npm run prisma:seed
```

## 🚀 Запуск

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## 📁 Структура

```
server/
├── src/
│   ├── config/          # Конфигурация
│   ├── middleware/      # Auth, zone validation
│   ├── modules/         # Бизнес-логика по доменам
│   │   ├── auth/        # Регистрация, логин
│   │   ├── character/   # Движение, статусы
│   │   ├── inventory/   # Инвентарь, экипировка
│   │   ├── combat/      # PvP/PvE
│   │   ├── crafting/    # Крафт, salvage
│   │   ├── raid/        # Рейды, экстракция
│   │   ├── world/       # Ресурсы, лут, NPC
│   │   └── god/         # God Mode
│   ├── services/        # Prisma, Redis, Cron
│   ├── socket/          # Socket.io handlers
│   ├── types/           # TypeScript типы
│   └── index.ts         # Точка входа
├── prisma/
│   ├── schema.prisma    # Схема БД
│   └── seed.ts          # Начальные данные
├── .env.example         # Пример конфигурации
└── package.json
```

## 🔐 Критические Правила (STRICT MODE)

1. **Разделение предметов:** ItemTemplate (статичные) vs ItemInstance (уникальные)
2. **Парадокс сумки:** maxStashSlots — необратимая мета-прогрессия
3. **AFK в рейде:** 2 минуты → потеря инвентаря и экипировки
4. **AFK в хабе:** 5 минут → безопасный выход
5. **Race Condition:** Все операции инвентаря — в Serializable транзакциях
6. **Портальный камень:** Одноразовый, только в рейде
7. **PvP в хабе:** Полностью отключён
8. **TTL лута:** 10 минут, затем автоматическая очистка
9. **Крафт/Salvage:** Проверка слотов ДО операции
10. **Ресурсные узлы:** ResourceNode с респавном

## 🎮 Socket.io Events

### Client → Server
- `auth:register` — Регистрация
- `auth:login` — Логин
- `character:move` — Движение
- `inventory:pickup` — Подбор лута
- `inventory:equip` — Экипировать
- `craft:start` — Начать крафт
- `raid:enter` — Войти в рейд
- `raid:extract` — Экстракция (портал-камень)
- `combat:attack` — Атака
- `resource:harvest` — Добыча ресурса
- `god:spawn` — Спавн (God Mode)
- `god:config` — Изменить Live Config (God Mode)

### Server → Client
- `auth:success` — Успешная авторизация
- `world:state` — Обновление мира
- `combat:hit` — Результат атаки
- `inventory:update` — Обновление инвентаря
- `loot:dropped` — Новый лут
- `character:died` — Смерть персонажа
- `raid:started` — Рейд начат
- `system:error` — Ошибка

## 🧪 Тестовые учётные данные

После запуска `npm run prisma:seed`:

- **Player:** `player@test.local` / `player12345`
- **God:** `god@mmo.local` / `god12345`

## 📊 Мониторинг

- `GET /health` — Health check

## 🔒 Безопасность

- Все операции инвентаря — в транзакциях с Serializable isolation
- Сервер — единственный источник истины
- Rate limiting через Redis
- JWT аутентификация для всех защищённых операций
- Zone validation middleware

## 📝 Лицензия

Private — Internal Use Only
