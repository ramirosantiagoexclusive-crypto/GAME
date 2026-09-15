import { useState } from 'react';
import type { Shop, ShopItem } from '../systems/shops';
import { RARITY_CONFIG, type ItemRarity } from '../systems/items';

interface Props {
  shop: Shop;
  playerGold: number;
  onBuy: (itemId: string, price: number) => void;
  onClose: () => void;
}

export function ShopPanel({ shop, playerGold, onBuy, onClose }: Props) {
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [filter, setFilter] = useState<'all' | 'weapon' | 'armor' | 'accessory' | 'consumable' | 'special'>('all');
  const [rarityFilter, setRarityFilter] = useState<ItemRarity | 'all'>('all');

  const filteredItems = shop.items.filter(item => {
    // Фильтр по типу
    if (filter !== 'all') {
      if (filter === 'weapon' && !item.template.type.startsWith('weapon_')) return false;
      if (filter === 'armor' && !item.template.type.startsWith('armor_')) return false;
      if (filter === 'accessory' && !item.template.type.startsWith('accessory_')) return false;
      if (filter === 'consumable' && !item.template.type.startsWith('consumable_')) return false;
      if (filter === 'special' && !item.template.type.startsWith('special_')) return false;
    }
    
    // Фильтр по редкости
    if (rarityFilter !== 'all' && item.rarity !== rarityFilter) return false;
    
    return true;
  });

  const getRarityColor = (rarity: ItemRarity) => {
    return RARITY_CONFIG[rarity].color;
  };

  const getRarityGlow = (rarity: ItemRarity) => {
    return RARITY_CONFIG[rarity].glowColor;
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0d1220] border border-gray-700 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{shop.name}</h2>
            <p className="text-sm text-gray-400">{shop.description}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-gray-400">Ваше золото</div>
              <div className="text-lg font-bold text-yellow-400">💰 {playerGold}</div>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30"
            >
              ✕ Закрыть
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-700 flex gap-2 flex-wrap">
          <div className="flex gap-1">
            {(['all', 'weapon', 'armor', 'accessory', 'consumable', 'special'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded text-xs ${
                  filter === f
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
                }`}
              >
                {f === 'all' ? 'Все' : f === 'weapon' ? '⚔️ Оружие' : f === 'armor' ? '🛡️ Броня' : f === 'accessory' ? '💍 Аксессуары' : f === 'consumable' ? '🧪 Расходуемые' : '🗝️ Особые'}
              </button>
            ))}
          </div>
          
          <div className="flex gap-1 ml-auto">
            {(['all', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRarityFilter(r)}
                className={`px-2 py-1.5 rounded text-xs ${
                  rarityFilter === r
                    ? 'border-2'
                    : 'border border-gray-700 hover:border-gray-600'
                }`}
                style={{
                  color: r === 'all' ? '#9ca3af' : getRarityColor(r as ItemRarity),
                  borderColor: rarityFilter === r ? (r === 'all' ? '#9ca3af' : getRarityColor(r as ItemRarity)) : undefined,
                }}
              >
                {r === 'all' ? 'Все' : RARITY_CONFIG[r as ItemRarity].name}
              </button>
            ))}
          </div>
        </div>

        {/* Items Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredItems.map((item) => (
              <button
                key={item.template.id}
                onClick={() => setSelectedItem(item)}
                className={`p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                  selectedItem?.template.id === item.template.id
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
                }`}
                style={{
                  boxShadow: `0 0 10px ${getRarityGlow(item.rarity)}`,
                }}
              >
                <div className="text-xs font-bold mb-1" style={{ color: getRarityColor(item.rarity) }}>
                  [{RARITY_CONFIG[item.rarity].name}]
                </div>
                <div className="text-sm text-white font-medium mb-1 truncate">
                  {item.template.name}
                </div>
                <div className="text-xs text-gray-400 mb-2">
                  Ур. {item.template.level}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-yellow-400 text-sm font-bold">💰 {item.price}</span>
                  {item.stock > 0 && (
                    <span className="text-xs text-gray-500">×{item.stock}</span>
                  )}
                  {item.stock === -1 && (
                    <span className="text-xs text-gray-500">∞</span>
                  )}
                </div>
              </button>
            ))}
          </div>
          
          {filteredItems.length === 0 && (
            <div className="text-center text-gray-500 py-12">
              Нет предметов с выбранными фильтрами
            </div>
          )}
        </div>

        {/* Selected Item Details */}
        {selectedItem && (
          <div className="p-4 border-t border-gray-700 bg-gray-900/50">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1" style={{ color: getRarityColor(selectedItem.rarity) }}>
                  {selectedItem.template.name}
                </h3>
                <p className="text-sm text-gray-400 mb-2">
                  {selectedItem.template.description}
                </p>
                <div className="text-xs text-gray-500 mb-2">
                  Уровень: {selectedItem.template.level} | Редкость: {RARITY_CONFIG[selectedItem.rarity].name}
                </div>
                
                {/* Stats */}
                {Object.keys(selectedItem.template.baseStats).length > 0 && (
                  <div className="flex gap-3 flex-wrap">
                    {selectedItem.template.baseStats.damage && (
                      <div className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs">
                        ⚔️ Урон: {selectedItem.template.baseStats.damage}
                      </div>
                    )}
                    {selectedItem.template.baseStats.defense && (
                      <div className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs">
                        🛡️ Защита: {selectedItem.template.baseStats.defense}
                      </div>
                    )}
                    {selectedItem.template.baseStats.health && (
                      <div className="px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs">
                        ❤️ Здоровье: {selectedItem.template.baseStats.health}
                      </div>
                    )}
                    {selectedItem.template.baseStats.mana && (
                      <div className="px-2 py-1 rounded bg-purple-500/20 text-purple-400 text-xs">
                        💎 Мана: {selectedItem.template.baseStats.mana}
                      </div>
                    )}
                    {selectedItem.template.baseStats.speed && (
                      <div className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 text-xs">
                        ⚡ Скорость: {selectedItem.template.baseStats.speed}
                      </div>
                    )}
                    {selectedItem.template.baseStats.critChance && (
                      <div className="px-2 py-1 rounded bg-orange-500/20 text-orange-400 text-xs">
                        🎯 Крит: {selectedItem.template.baseStats.critChance}%
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <button
                onClick={() => {
                  onBuy(selectedItem.template.id, selectedItem.price);
                  setSelectedItem(null);
                }}
                disabled={playerGold < selectedItem.price || selectedItem.stock === 0}
                className={`px-6 py-3 rounded-lg font-bold transition-all ${
                  playerGold >= selectedItem.price && selectedItem.stock !== 0
                    ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 hover:bg-emerald-500/30'
                    : 'bg-gray-700 border-2 border-gray-600 text-gray-500 cursor-not-allowed'
                }`}
              >
                {selectedItem.stock === 0 ? 'Нет в наличии' : `Купить за 💰 ${selectedItem.price}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
