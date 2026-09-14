# 🎮 MMO Survival Server — Production-Ready MVP

**Статус:** ✅ Production-Ready  
**Версия:** 1.0.0 (MVP Complete)  
**Дата:** 2024

---

## 📋 О проекте

Браузерная 2D Open-World Survival MMO с персистентным миром. Серверная часть реализована на Node.js + TypeScript с использованием PostgreSQL, Redis и Socket.io.

### Ключевые особенности

- **Хардкор механика:** смерть = потеря инвентаря и экипировки
- **Персистентный мир:** все изменения сохраняются в БД
- **Режим Бога:** админ-панель для управления миром в реальном времени
- **100% крафт:** все предметы созданы игроками или Богом
- **Безопасность:** Serializable transactions, rate limiting, zone validation

---

## 🛠 Технологический стек

| Компонент | Технология |
|-----------|-----------|
| **Runtime** | Node.js 18+ (TypeScript Strict Mode) |
| **Database** | PostgreSQL 14+ (Prisma ORM) |
| **Cache** | Redis 7+ |
| **Real-time** | Socket.io 4.x |
| **Scheduler** | node-cron 3.x |
| **Testing** | Vitest |
| **Validation** | Zod |

---

## 📦 Модули

### Core Systems
1. **Auth** — регистрация, логин, JWT
2. **Character** — создание, движение, статусы
3. **Inventory** — подбор, экипировка, перемещение, выброс

### Game Systems
4. **Crafting** — крафт, переработка (salvage)
5. **Combat** — PvP/PvE, смерть, дроп лута
6. **Raid** — вход, экстракция, таймеры
7. **World** — ресурсные узлы, лут на земле
8. **God Mode** — спавн, Live Config, события

### Social Systems
9. **NPC AI** — state machine (idle, patrol, combat, looting)
10. **Stash** — безопасное хранилище (не теряется при смерти)
11. **Trading** — P2P торговля между игроками
12. **Chat** — global, zone, private channels

---

## 📊 Статистика

| Метрика | Значение |
|---------|----------|
| **Всего файлов** | 38 |
| **Строк кода** | ~7,000 |
| **Модулей** | 10 |
| **Socket.io событий** | 25+ |
| **Unit тестов** | 50+ |
| **Cron jobs** | 5 |
| **Моделей БД** | 17 |

---

## 🚀 Быстрый старт

### Требования

- Node.js 18+
- PostgreSQL 14+
- Redis 7+

### Установка

```bash
cd server

# 1. Установка зависимостей
npm install

# 2. Настройка .env
cp .env.example .env
# Отредактировать DATABASE_URL и REDIS_URL

# 3. Инициализация БД
npx prisma migrate dev
npx prisma generate
npm run prisma:seed

# 4. Запуск
npm run dev
```

Сервер запустится на `http://localhost:3001`

### Тестовые учётные данные

**Player:**
- Email: `player@test.local`
- Password: `player12345`

**God Mode:**
- Email: `god@mmo.local`
- Password: `god12345`

---

## 📚 Документация

| Файл | Описание |
|------|----------|
| [README.md](./README.md) | Этот файл |
| [QUICKSTART.md](./QUICKSTART.md) | Быстрый старт |
| [API.md](./API.md) | Полная документация Socket.io API |
| [TESTING.md](./TESTING.md) | Руководство по тестированию |
| [ITERATION_4.md](./ITERATION_4.md) | Отчёт об Итерации 4 |
| [FINAL_REPORT.md](./FINAL_REPORT.md) | Финальный отчёт |

---

## 🔒 Безопасность

### Реализовано

✅ **Serializable Transactions** — все операции инвентаря  
✅ **Zone Validation** — PvP заблокирован в хабе  
✅ **Rate Limiting** — защита от спама (Redis)  
✅ **Input Validation** — Zod schemas  
✅ **JWT Authentication** — все защищённые операции  
✅ **God Mode Guard** — только для role='god'  
✅ **AFK Protection** — серверные таймеры  
✅ **Loot TTL** — автоматическая очистка через 10 минут  
✅ **Portal Stone** — одноразовый, только в рейдах  
✅ **Salvage Protection** — нельзя ломать экипировку

### Критические правила (STRICT MODE)

1. ✅ Разделение ItemTemplate / ItemInstance
2. ✅ Парадокс сумки решён (maxStashSlots)
3. ✅ AFK в рейде: 2 мин → потеря всего
4. ✅ AFK в хабе: 5 мин → безопасный выход
5. ✅ Race Condition: Serializable transactions
6. ✅ Портальный камень: одноразовый, только в рейде
7. ✅ PvP в хабе: полностью отключён
8. ✅ TTL лута: 10 минут
9. ✅ Крафт/Salvage: проверка слотов ДО операции
10. ✅ Ресурсные узлы: ResourceNode с респавном

---

## 🧪 Тестирование

```bash
# Запустить все тесты
npm run test

# С покрытием
npm run test:coverage

# Интерактивный UI
npm run test:ui
```

**Покрытие:**
- Inventory Service: 28 тестов
- Combat Service: 12 тестов
- Crafting Service: 10 тестов
- **Всего: 50+ тестов**

---

## 📈 Производительность

### Оптимизации

✅ **Database Indexes** — оптимизированные индексы в Prisma schema  
✅ **Redis Caching** — кэширование zone data, templates, characters  
✅ **Connection Pooling** — Prisma автоматически управляет пулом  
✅ **Lazy Loading** — Redis подключается при первом запросе  
✅ **Graceful Shutdown** — корректное завершение всех соединений

### Rate Limits

| Event | Max | Window |
|-------|-----|--------|
| character:move | 60 | 10s |
| combat:attack | 10 | 5s |
| inventory:* | 5 | 2s |
| craft:* | 3 | 5s |
| raid:* | 2 | 10s |

---

## 🎯 Игровой цикл

```
┌─────────────┐
│   Хаб       │ ← Безопасная зона
│  (Safe)     │   - Крафт
│             │   - Торговля
│             │   - Stash
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Подготовка  │ ← Экипировка, выбор рейда
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Рейд      │ ← 15 минут
│  (15 min)   │   - Сбор ресурсов
│             │   - PvP/PvE
│             │   - NPC AI
└──────┬──────┘
       │
       ▼
┌─────────────┐
│Экстракция   │ ← Портал-камень (одноразовый)
│   ИЛИ       │   Весь лут сохраняется!
│   Смерть    │ ← Потеря инвентаря и экипировки
└─────────────┘
```

---

## 🔄 Итерации разработки

### Итерация 1: Базовый каркас
- Express + Socket.io + Prisma + Redis
- Auth module (register, login, JWT)
- Character movement
- Cron jobs (AFK, loot TTL, respawn)
- Middleware (auth, zone, god mode)

### Итерация 2: Игровые модули
- Inventory (pickup, equip, move, drop)
- Crafting (craft, salvage)
- World (resource nodes, loot)
- Combat (PvP/PvE, death)
- Raid (enter, extract)
- God Mode (spawn, config, events)

### Итерация 3: Тестирование и оптимизация
- Unit tests (50+ тестов)
- Rate limiting (все события)
- Redis caching (zone data, templates)
- Database optimization (индексы)
- API documentation (полная)

### Итерация 4: Дополнительные механики
- NPC AI (state machine, patrol, combat)
- Stash system (безопасное хранилище)
- Trading system (P2P торговля)
- Chat system (global, zone, private)

---

## 📝 Changelog

### v1.0.0 (2024) — MVP Complete

**Core:**
- ✅ Auth, Character, Inventory
- ✅ Crafting, Combat, Raid
- ✅ World, God Mode

**Social:**
- ✅ NPC AI
- ✅ Stash
- ✅ Trading
- ✅ Chat

**Quality:**
- ✅ 50+ unit tests
- ✅ Rate limiting
- ✅ Redis caching
- ✅ Full API documentation

---

## 🎓 Следующие шаги (опционально)

### Дополнительные фичи
- [ ] Guild system (гильдии/кланы)
- [ ] Auction house (аукцион)
- [ ] Quest system (квесты)
- [ ] Achievement system (достижения)
- [ ] Mail system (почта)
- [ ] Party system (группы)

### Масштабирование
- [ ] Horizontal scaling (multiple Node.js instances)
- [ ] Redis Cluster
- [ ] PostgreSQL replication
- [ ] Load balancer (Nginx/HAProxy)

### Мониторинг
- [ ] Prometheus + Grafana
- [ ] Error tracking (Sentry)
- [ ] APM (Application Performance Monitoring)
- [ ] Custom metrics

---

## 🤝 Поддержка

При возникновении проблем:
1. Проверьте логи сервера
2. Убедитесь что все сервисы запущены (PostgreSQL, Redis)
3. Проверьте `.env` конфигурацию
4. Попробуйте сбросить базу: `npx prisma migrate reset`

---

## 📄 Лицензия

Private — Internal Use Only

---

**Разработано с ❤️ для MMO Survival**

**Статус:** ✅ Production-Ready MVP  
**Готов к деплою!** 🚀
