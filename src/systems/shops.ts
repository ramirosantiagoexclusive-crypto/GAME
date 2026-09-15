import { ITEM_TEMPLATES, type ItemTemplate, type ItemRarity, RARITY_CONFIG } from './items';

export interface ShopItem {
  template: ItemTemplate;
  price: number;
  stock: number; // -1 = бесконечно
  rarity: ItemRarity;
}

export interface Shop {
  id: string;
  name: string;
  description: string;
  location: { x: number; y: number; zone: string };
  items: ShopItem[];
  type: 'preparation' | 'special';
}

// Генерация случайной редкости для предмета магазина
function generateShopItemRarity(shopType: 'preparation' | 'special'): ItemRarity {
  if (shopType === 'preparation') {
    // В магазине подготовки больше обычных и необычных предметов
    const roll = Math.random();
    if (roll < 0.60) return 'common';
    if (roll < 0.85) return 'uncommon';
    if (roll < 0.95) return 'rare';
    if (roll < 0.99) return 'epic';
    return 'legendary';
  } else {
    // В особом магазине больше редких и эпических предметов
    const roll = Math.random();
    if (roll < 0.20) return 'uncommon';
    if (roll < 0.50) return 'rare';
    if (roll < 0.80) return 'epic';
    if (roll < 0.95) return 'legendary';
    return 'mythic';
  }
}

// Генерация цены предмета
function generatePrice(template: ItemTemplate, rarity: ItemRarity): number {
  const basePrice = template.level * 10;
  const rarityMultiplier = RARITY_CONFIG[rarity].statMultiplier;
  return Math.floor(basePrice * rarityMultiplier);
}

// Магазин подготовки к рейду (в хабе)
export const PREPARATION_SHOP: Shop = {
  id: 'preparation_shop',
  name: '⚔️ Магазин Рейдера',
  description: 'Всё необходимое для подготовки к рейду',
  location: { x: 150, y: -50, zone: 'hub' },
  type: 'preparation',
  items: generatePreparationShopItems(),
};

function generatePreparationShopItems(): ShopItem[] {
  const items: ShopItem[] = [];
  
  // Оружие (20 предметов)
  const weapons = ITEM_TEMPLATES.filter(t => t.type.startsWith('weapon_')).slice(0, 20);
  weapons.forEach(template => {
    const rarity = generateShopItemRarity('preparation');
    items.push({
      template,
      price: generatePrice(template, rarity),
      stock: -1,
      rarity,
    });
  });
  
  // Броня (20 предметов)
  const armors = ITEM_TEMPLATES.filter(t => t.type.startsWith('armor_')).slice(0, 20);
  armors.forEach(template => {
    const rarity = generateShopItemRarity('preparation');
    items.push({
      template,
      price: generatePrice(template, rarity),
      stock: -1,
      rarity,
    });
  });
  
  // Аксессуары (10 предметов)
  const accessories = ITEM_TEMPLATES.filter(t => t.type.startsWith('accessory_')).slice(0, 10);
  accessories.forEach(template => {
    const rarity = generateShopItemRarity('preparation');
    items.push({
      template,
      price: generatePrice(template, rarity),
      stock: -1,
      rarity,
    });
  });
  
  // Расходуемые предметы (30 предметов)
  const consumables = ITEM_TEMPLATES.filter(t => t.type.startsWith('consumable_')).slice(0, 30);
  consumables.forEach(template => {
    const rarity = generateShopItemRarity('preparation');
    items.push({
      template,
      price: generatePrice(template, rarity),
      stock: -1,
      rarity,
    });
  });
  
  return items;
}

// Особый магазин в рейде (с редкими предметами)
export const SPECIAL_SHOPS: Shop[] = [
  {
    id: 'special_shop_1',
    name: '🗝️ Тайная Лавка',
    description: 'Редкие предметы из глубин рейда',
    location: { x: 320, y: 320, zone: 'raid_zone_1' },
    type: 'special',
    items: generateSpecialShopItems('goblin'),
  },
  {
    id: 'special_shop_2',
    name: '🗝️ Сокровищница Орков',
    description: 'Трофеи военных походов',
    location: { x: 620, y: 620, zone: 'raid_zone_1' },
    type: 'special',
    items: generateSpecialShopItems('orc'),
  },
  {
    id: 'special_shop_3',
    name: '🗝️ Крипта Древних',
    description: 'Артефакты забытых цивилизаций',
    location: { x: -390, y: -410, zone: 'raid_zone_1' },
    type: 'special',
    items: generateSpecialShopItems('undead'),
  },
  {
    id: 'special_shop_4',
    name: '🗝️ Пещера Троллей',
    description: 'Сокровища горных великанов',
    location: { x: 815, y: -290, zone: 'raid_zone_1' },
    type: 'special',
    items: generateSpecialShopItems('troll'),
  },
];

function generateSpecialShopItems(theme: string): ShopItem[] {
  const items: ShopItem[] = [];
  
  // Особые предметы (10 штук)
  const specialItems = ITEM_TEMPLATES.filter(t => t.type.startsWith('special_')).slice(0, 10);
  specialItems.forEach(template => {
    const rarity = generateShopItemRarity('special');
    items.push({
      template,
      price: generatePrice(template, rarity) * 3, // В 3 раза дороже
      stock: 1, // Только 1 штука
      rarity,
    });
  });
  
  // Редкое оружие (10 предметов)
  const rareWeapons = ITEM_TEMPLATES.filter(t => t.type.startsWith('weapon_')).slice(50, 60);
  rareWeapons.forEach(template => {
    const rarity = generateShopItemRarity('special');
    items.push({
      template,
      price: generatePrice(template, rarity) * 2,
      stock: 2,
      rarity,
    });
  });
  
  // Редкая броня (10 предметов)
  const rareArmors = ITEM_TEMPLATES.filter(t => t.type.startsWith('armor_')).slice(50, 60);
  rareArmors.forEach(template => {
    const rarity = generateShopItemRarity('special');
    items.push({
      template,
      price: generatePrice(template, rarity) * 2,
      stock: 2,
      rarity,
    });
  });
  
  // Редкие аксессуары (5 предметов)
  const rareAccessories = ITEM_TEMPLATES.filter(t => t.type.startsWith('accessory_')).slice(50, 55);
  rareAccessories.forEach(template => {
    const rarity = generateShopItemRarity('special');
    items.push({
      template,
      price: generatePrice(template, rarity) * 2,
      stock: 1,
      rarity,
    });
  });
  
  return items;
}

// Функция для получения магазина по позиции
export function getShopAtPosition(x: number, y: number, zone: string): Shop | undefined {
  const allShops = [PREPARATION_SHOP, ...SPECIAL_SHOPS];
  
  return allShops.find(shop => {
    if (shop.location.zone !== zone) return false;
    
    const dx = shop.location.x - x;
    const dy = shop.location.y - y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance < 50; // Радиус взаимодействия
  });
}

// Функция для покупки предмета
export function buyItem(shop: Shop, itemId: string, playerGold: number): {
  success: boolean;
  error?: string;
  newGold?: number;
  item?: ShopItem;
} {
  const shopItem = shop.items.find(i => i.template.id === itemId);
  
  if (!shopItem) {
    return { success: false, error: 'Предмет не найден в магазине' };
  }
  
  if (shopItem.stock === 0) {
    return { success: false, error: 'Предмет закончился' };
  }
  
  if (playerGold < shopItem.price) {
    return { success: false, error: 'Недостаточно золота' };
  }
  
  // Уменьшаем количество в магазине
  if (shopItem.stock > 0) {
    shopItem.stock--;
  }
  
  return {
    success: true,
    newGold: playerGold - shopItem.price,
    item: shopItem,
  };
}

// Функция для получения всех магазинов
export function getAllShops(): Shop[] {
  return [PREPARATION_SHOP, ...SPECIAL_SHOPS];
}

// Функция для получения магазинов в зоне
export function getShopsInZone(zone: string): Shop[] {
  return getAllShops().filter(shop => shop.location.zone === zone);
}
