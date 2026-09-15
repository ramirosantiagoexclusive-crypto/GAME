// Система редкости предметов
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface ItemRarityConfig {
  name: string;
  color: string;
  glowColor: string;
  dropChance: number; // 0-1
  statMultiplier: number;
}

export const RARITY_CONFIG: Record<ItemRarity, ItemRarityConfig> = {
  common: {
    name: 'Обычный',
    color: '#9ca3af',
    glowColor: 'rgba(156, 163, 175, 0.3)',
    dropChance: 0.60,
    statMultiplier: 1.0,
  },
  uncommon: {
    name: 'Необычный',
    color: '#22c55e',
    glowColor: 'rgba(34, 197, 94, 0.4)',
    dropChance: 0.25,
    statMultiplier: 1.3,
  },
  rare: {
    name: 'Редкий',
    color: '#3b82f6',
    glowColor: 'rgba(59, 130, 246, 0.5)',
    dropChance: 0.10,
    statMultiplier: 1.6,
  },
  epic: {
    name: 'Эпический',
    color: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.6)',
    dropChance: 0.04,
    statMultiplier: 2.0,
  },
  legendary: {
    name: 'Легендарный',
    color: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.7)',
    dropChance: 0.009,
    statMultiplier: 2.5,
  },
  mythic: {
    name: 'Мифический',
    color: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.8)',
    dropChance: 0.001,
    statMultiplier: 3.0,
  },
};

// Функция для получения случайной редкости
export function getRandomRarity(): ItemRarity {
  const roll = Math.random();
  let cumulative = 0;
  
  for (const [rarity, config] of Object.entries(RARITY_CONFIG)) {
    cumulative += config.dropChance;
    if (roll <= cumulative) {
      return rarity as ItemRarity;
    }
  }
  
  return 'common';
}

// Типы предметов
export type ItemType = 
  | 'weapon_sword' | 'weapon_axe' | 'weapon_bow' | 'weapon_staff' | 'weapon_dagger'
  | 'armor_head' | 'armor_chest' | 'armor_legs' | 'armor_feet'
  | 'accessory_ring' | 'accessory_amulet' | 'accessory_belt'
  | 'consumable_potion' | 'consumable_food' | 'consumable_scroll'
  | 'material_ore' | 'material_wood' | 'material_herb' | 'material_gem' | 'material_cloth'
  | 'special_quest' | 'special_key' | 'special_relic';

export interface ItemTemplate {
  id: string;
  name: string;
  type: ItemType;
  baseStats: {
    damage?: number;
    defense?: number;
    health?: number;
    mana?: number;
    speed?: number;
    critChance?: number;
    critDamage?: number;
  };
  level: number;
  description: string;
  craftable: boolean;
  craftRecipe?: {
    materials: Array<{ itemId: string; quantity: number }>;
  };
}

// Генерация списка предметов (~1000 предметов)
export function generateItemTemplates(): ItemTemplate[] {
  const templates: ItemTemplate[] = [];
  
  // Оружие (100 предметов)
  const weaponTypes = ['sword', 'axe', 'bow', 'staff', 'dagger'];
  const weaponNames = {
    sword: ['Меч', 'Клинок', 'Сабля', 'Палаш', 'Рапира'],
    axe: ['Топор', 'Секира', 'Бердыш', 'Чекан', 'Клевец'],
    bow: ['Лук', 'Арбалет', 'Самострел', 'Длинный лук', 'Композитный лук'],
    staff: ['Посох', 'Жезл', 'Стафф', 'Волшебный посох', 'Древний жезл'],
    dagger: ['Кинжал', 'Нож', 'Стилет', 'Дага', 'Мизерикордия'],
  };
  
  const prefixes = ['Ржавый', 'Стальной', 'Закалённый', 'Древний', 'Проклятый', 'Святой', 'Демонический', 'Драконий', 'Небесный', 'Адский'];
  const suffixes = ['Силы', 'Мудрости', 'Ловкости', 'Скорости', 'Ярости', 'Защиты', 'Удачи', 'Мастерства', 'Власти', 'Судьбы'];
  
  for (let i = 0; i < 100; i++) {
    const weaponType = weaponTypes[i % weaponTypes.length];
    const baseName = weaponNames[weaponType as keyof typeof weaponNames][i % 5];
    const prefix = prefixes[Math.floor(i / 10) % prefixes.length];
    const suffix = suffixes[Math.floor(i / 20) % suffixes.length];
    
    templates.push({
      id: `weapon_${i}`,
      name: `${prefix} ${baseName} ${suffix}`,
      type: `weapon_${weaponType}` as ItemType,
      baseStats: {
        damage: 10 + (i % 50) * 2,
        critChance: 5 + (i % 10),
        critDamage: 150 + (i % 5) * 10,
      },
      level: 1 + Math.floor(i / 10),
      description: `${prefix.toLowerCase()} ${baseName.toLowerCase()}, наделённый ${suffix.toLowerCase()}.`,
      craftable: i < 50,
      craftRecipe: i < 50 ? {
        materials: [
          { itemId: 'material_ore', quantity: 5 + i % 10 },
          { itemId: 'material_wood', quantity: 2 + i % 5 },
        ],
      } : undefined,
    });
  }
  
  // Броня (100 предметов)
  const armorTypes = ['head', 'chest', 'legs', 'feet'];
  const armorNames = {
    head: ['Шлем', 'Капюшон', 'Корона', 'Тиара', 'Маска'],
    chest: ['Кираса', 'Доспех', 'Мантия', 'Роба', 'Кольчуга'],
    legs: ['Поножи', 'Штаны', 'Наголенники', 'Латы', 'Шаровары'],
    feet: ['Сапоги', 'Ботинки', 'Сандалии', 'Латные сапоги', 'Страннические ботинки'],
  };
  
  for (let i = 0; i < 100; i++) {
    const armorType = armorTypes[i % armorTypes.length];
    const baseName = armorNames[armorType as keyof typeof armorNames][i % 5];
    const prefix = prefixes[Math.floor(i / 10) % prefixes.length];
    const suffix = suffixes[Math.floor(i / 20) % suffixes.length];
    
    templates.push({
      id: `armor_${i}`,
      name: `${prefix} ${baseName} ${suffix}`,
      type: `armor_${armorType}` as ItemType,
      baseStats: {
        defense: 5 + (i % 30) * 2,
        health: 20 + (i % 20) * 5,
      },
      level: 1 + Math.floor(i / 10),
      description: `${prefix.toLowerCase()} ${baseName.toLowerCase()}, усиленный ${suffix.toLowerCase()}.`,
      craftable: i < 50,
      craftRecipe: i < 50 ? {
        materials: [
          { itemId: 'material_ore', quantity: 8 + i % 15 },
          { itemId: 'material_cloth', quantity: 3 + i % 5 },
        ],
      } : undefined,
    });
  }
  
  // Аксессуары (100 предметов)
  const accessoryTypes = ['ring', 'amulet', 'belt'];
  const accessoryNames = {
    ring: ['Кольцо', 'Перстень', 'Печатка', 'Обруч', 'Кольцо силы'],
    amulet: ['Амулет', 'Ожерелье', 'Подвеска', 'Медальон', 'Талисман'],
    belt: ['Пояс', 'Ремень', 'Кушак', 'Опояска', 'Пояс силы'],
  };
  
  for (let i = 0; i < 100; i++) {
    const accessoryType = accessoryTypes[i % accessoryTypes.length];
    const baseName = accessoryNames[accessoryType as keyof typeof accessoryNames][i % 5];
    const prefix = prefixes[Math.floor(i / 10) % prefixes.length];
    const suffix = suffixes[Math.floor(i / 20) % suffixes.length];
    
    templates.push({
      id: `accessory_${i}`,
      name: `${prefix} ${baseName} ${suffix}`,
      type: `accessory_${accessoryType}` as ItemType,
      baseStats: {
        mana: 10 + (i % 15) * 3,
        critChance: 2 + (i % 8),
        speed: 1 + (i % 5),
      },
      level: 1 + Math.floor(i / 10),
      description: `${prefix.toLowerCase()} ${baseName.toLowerCase()}, пропитанный ${suffix.toLowerCase()}.`,
      craftable: i < 50,
      craftRecipe: i < 50 ? {
        materials: [
          { itemId: 'material_gem', quantity: 2 + i % 5 },
          { itemId: 'material_ore', quantity: 3 + i % 8 },
        ],
      } : undefined,
    });
  }
  
  // Расходуемые предметы (100 предметов)
  const consumableTypes = ['potion', 'food', 'scroll'];
  const consumableNames = {
    potion: ['Зелье здоровья', 'Зелье маны', 'Зелье силы', 'Зелье скорости', 'Зелье защиты'],
    food: ['Хлеб', 'Мясо', 'Сыр', 'Фрукты', 'Суп'],
    scroll: ['Свиток телепортации', 'Свиток возвращения', 'Свиток улучшения', 'Свиток знания', 'Свиток силы'],
  };
  
  for (let i = 0; i < 100; i++) {
    const consumableType = consumableTypes[i % consumableTypes.length];
    const baseName = consumableNames[consumableType as keyof typeof consumableNames][i % 5];
    const prefix = prefixes[Math.floor(i / 10) % prefixes.length];
    
    templates.push({
      id: `consumable_${i}`,
      name: `${prefix} ${baseName}`,
      type: `consumable_${consumableType}` as ItemType,
      baseStats: {
        health: consumableType === 'potion' ? 50 + (i % 10) * 20 : undefined,
        mana: consumableType === 'potion' ? 30 + (i % 10) * 15 : undefined,
      },
      level: 1 + Math.floor(i / 20),
      description: `${prefix.toLowerCase()} ${baseName.toLowerCase()}.`,
      craftable: true,
      craftRecipe: {
        materials: [
          { itemId: 'material_herb', quantity: 2 + i % 5 },
        ],
      },
    });
  }
  
  // Материалы (100 предметов)
  const materialTypes = ['ore', 'wood', 'herb', 'gem', 'cloth'];
  const materialNames = {
    ore: ['Железная руда', 'Мифриловая руда', 'Адамантитовая руда', 'Орихалковая руда', 'Драконья руда'],
    wood: ['Дуб', 'Тис', 'Красное дерево', 'Железное дерево', 'Древесина энтов'],
    herb: ['Трава жизни', 'Лунный цветок', 'Огненный корень', 'Ледяной лист', 'Драконья трава'],
    gem: ['Рубин', 'Сапфир', 'Изумруд', 'Алмаз', 'Драконий камень'],
    cloth: ['Лён', 'Шёлк', 'Бархат', 'Мифриловая ткань', 'Драконья чешуя'],
  };
  
  for (let i = 0; i < 100; i++) {
    const materialType = materialTypes[i % materialTypes.length];
    const baseName = materialNames[materialType as keyof typeof materialNames][i % 5];
    const prefix = prefixes[Math.floor(i / 10) % prefixes.length];
    
    templates.push({
      id: `material_${i}`,
      name: `${prefix} ${baseName}`,
      type: `material_${materialType}` as ItemType,
      baseStats: {},
      level: 1 + Math.floor(i / 20),
      description: `${prefix.toLowerCase()} ${baseName.toLowerCase()}.`,
      craftable: false,
    });
  }
  
  // Особые предметы (50 предметов)
  const specialItems = [
    { id: 'special_key_1', name: 'Ключ от подземелья', type: 'special_key' as ItemType, description: 'Открывает вход в древнее подземелье.' },
    { id: 'special_key_2', name: 'Ключ от сокровищницы', type: 'special_key' as ItemType, description: 'Открывает сокровищницу дракона.' },
    { id: 'special_relic_1', name: 'Древний артефакт', type: 'special_relic' as ItemType, description: 'Таинственный артефакт из забытых времён.' },
    { id: 'special_relic_2', name: 'Око дракона', type: 'special_relic' as ItemType, description: 'Пульсирует древней магией.' },
    { id: 'special_quest_1', name: 'Письмо короля', type: 'special_quest' as ItemType, description: 'Секретное послание от короля.' },
    { id: 'special_quest_2', name: 'Карта сокровищ', type: 'special_quest' as ItemType, description: 'Ведёт к легендарному сокровищу.' },
  ];
  
  for (let i = 0; i < 50; i++) {
    const baseItem = specialItems[i % specialItems.length];
    const prefix = prefixes[Math.floor(i / 10) % prefixes.length];
    
    templates.push({
      id: `${baseItem.id}_${i}`,
      name: `${prefix} ${baseItem.name}`,
      type: baseItem.type,
      baseStats: {},
      level: 1 + Math.floor(i / 10),
      description: baseItem.description,
      craftable: false,
    });
  }
  
  return templates;
}

// Экспортируем сгенерированные шаблоны
export const ITEM_TEMPLATES = generateItemTemplates();

// Функция для получения предмета по ID
export function getItemTemplate(id: string): ItemTemplate | undefined {
  return ITEM_TEMPLATES.find(item => item.id === id);
}

// Функция для получения предметов по типу
export function getItemsByType(type: ItemType): ItemTemplate[] {
  return ITEM_TEMPLATES.filter(item => item.type === type);
}

// Функция для получения предметов по уровню
export function getItemsByLevel(level: number): ItemTemplate[] {
  return ITEM_TEMPLATES.filter(item => item.level === level);
}

// Функция для получения предметов по редкости
export function getItemsByRarity(rarity: ItemRarity): ItemTemplate[] {
  // Это пример, в реальности редкость определяется при создании экземпляра
  return ITEM_TEMPLATES;
}
