# 🧪 Тестирование — MMO Survival Server

## 📋 Требования

- PostgreSQL запущен и доступен
- Redis запущен и доступен
- База данных создана и мигрирована

## 🚀 Запуск тестов

### Запустить все тесты

```bash
npm run test
```

### Запустить с coverage

```bash
npm run test:coverage
```

Отчёт будет сгенерирован в `coverage/` директории.

### Запустить в UI режиме

```bash
npm run test:ui
```

Откроется интерактивный UI на `http://localhost:51204/__vitest__/`

### Запустить конкретный тест

```bash
npx vitest tests/inventory.test.ts
```

### Запустить в watch режиме

```bash
npx vitest --watch
```

## 📊 Покрытие тестами

### Inventory Service (28 тестов)

- ✅ `getInventory` — получение инвентаря и экипировки
- ✅ `pickupLoot` — подбор лута с земли
  - Успешный подбор
  - Лут не найден
  - Инвентарь полон
  - Лут истёк
- ✅ `equipItem` — экипировка предметов
  - Успешная экипировка
  - Несоответствие типа
  - Слот занят
- ✅ `unequipItem` — снятие экипировки
  - Успешное снятие
  - Слот пуст
  - Инвентарь полон
- ✅ `moveItem` — перемещение предметов
  - Перемещение в пустой слот
  - Обмен между слотами
  - Перемещение в тот же слот
  - Пустой источник
- ✅ `dropItem` — выброс предметов
  - Успешный выброс
  - Удаление слота при полном выбросе
  - Превышение количества

### Combat Service (12 тестов)

- ✅ **PvP**
  - Успешная атака в рейдовой зоне
  - Блокировка PvP в хабе
  - Блокировка атаки игроков в хабе
  - Убийство игрока с дропом лута
  - Расчёт урона с оружием
  - Снижение урона бронёй
- ✅ **PvE**
  - Успешная атака NPC
  - Убийство NPC с дропом лута
- ✅ **Edge Cases**
  - Цель не найдена
  - Базовый урон без оружия
  - Нельзя атаковать мёртвых

### Crafting Service (10 тестов)

- ✅ `craftItem`
  - Успешный крафт
  - Рецепт не изучен
  - Недостаточно ресурсов
  - Инвентарь полон
  - Корректное потребление ресурсов
- ✅ `salvageItem`
  - Успешная переработка
  - Нельзя переработать экипированное
  - Нет salvage yield
  - Недостаточно места для результатов

## 🔧 Подготовка тестовой среды

### 1. Создать тестовую базу данных

```sql
CREATE DATABASE mmo_survival_test;
```

### 2. Обновить .env

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mmo_survival_test?schema=public"
```

### 3. Запустить миграции

```bash
npx prisma migrate deploy
```

### 4. Сгенерировать Prisma Client

```bash
npx prisma generate
```

## 📝 Структура тестов

```
tests/
├── setup.ts              # Инициализация и очистка БД
├── helpers.ts            # Helper функции для тестов
├── inventory.test.ts     # Тесты inventory service
├── combat.test.ts        # Тесты combat service
└── crafting.test.ts      # Тесты crafting service
```

## 🎯 Helper функции

### `createTestUser(email, characterName, options?)`

Создаёт тестового пользователя с персонажем.

```typescript
const { user, character } = await createTestUser('test@test.com', 'TestHero', {
  zone: 'hub',
  x: 10,
  y: 20,
  hp: 100,
});
```

### `createTestTemplate(name, type, options?)`

Создаёт тестовый шаблон предмета.

```typescript
const template = await createTestTemplate('Sword', 'weapon', {
  maxDurability: 100,
  defaultStats: { damage: 25 },
});
```

### `createTestItemInstance(templateId, options?)`

Создаёт тестовый экземпляр предмета.

```typescript
const instance = await createTestItemInstance(template.id, {
  currentDurability: 100,
});
```

### `addToInventory(characterId, itemInstanceId, slotIndex, quantity?)`

Добавляет предмет в инвентарь.

```typescript
await addToInventory(character.id, instance.id, 0, 5);
```

### `createTestLoot(itemInstanceId, x, y, zone, quantity?, expiresAt?)`

Создаёт тестовый лут на земле.

```typescript
const loot = await createTestLoot(instance.id, 10, 20, 'hub');
```

### `cleanupTestData()`

Очищает все тестовые данные.

```typescript
await cleanupTestData();
```

## 🐛 Отладка тестов

### Включить логи Prisma

В `tests/setup.ts`:

```typescript
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

### Запустить один тест

```bash
npx vitest tests/inventory.test.ts -t "should pickup loot successfully"
```

### Показать SQL запросы

```bash
DEBUG=prisma:query npx vitest
```

## 📈 Coverage отчёт

После запуска `npm run test:coverage`:

```bash
# Открыть HTML отчёт
open coverage/index.html

# Или посмотреть в терминале
cat coverage/text.txt
```

### Целевое покрытие

- **Statements:** > 80%
- **Branches:** > 70%
- **Functions:** > 80%
- **Lines:** > 80%

## 🔄 CI/CD Integration

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npx prisma generate
      - run: npm run test:coverage
```

## 📚 Дополнительные ресурсы

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)

---

**Версия:** 1.0.0  
**Последнее обновление:** 2024
