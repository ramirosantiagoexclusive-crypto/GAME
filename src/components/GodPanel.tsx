import { useState } from 'react';
import type { CharacterData } from '../App';
import { getTemplates } from '../mock/server';

interface Props {
  character: CharacterData;
  onSpawn: (payload: any) => void;
}

export function GodPanel({ character, onSpawn }: Props) {
  const [templateId, setTemplateId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const templates = getTemplates();

  const handleSpawn = () => {
    if (!templateId) return;
    onSpawn({
      type: 'item',
      templateId,
      x: character.x,
      y: character.y,
      zone: character.zone,
      quantity,
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <span className="text-2xl">👑</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">God Mode</h2>
            <p className="text-xs text-gray-400">Режим бога — управление миром</p>
          </div>
        </div>

        <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 mb-4">
          <p className="text-xs text-purple-400">
            ⚠️ <strong>Внимание:</strong> Все действия логируются и необратимы
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-2">Шаблон предмета</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white focus:border-purple-500 focus:outline-none"
            >
              <option value="">Выберите шаблон...</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-2">Количество</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              max={100}
              className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white focus:border-purple-500 focus:outline-none"
            />
          </div>

          <button
            onClick={handleSpawn}
            disabled={!templateId}
            className={`w-full py-3 rounded-lg font-medium ${
              templateId
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            ✨ Создать предметы
          </button>

          <div className="pt-4 border-t border-gray-800">
            <p className="text-xs text-gray-400 mb-2">Быстрые действия:</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setTemplateId('tpl_portal');
                  setQuantity(5);
                }}
                className="px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs text-purple-400 hover:bg-purple-500/20"
              >
                🌀 5 портал-камней
              </button>
              <button
                onClick={() => {
                  setTemplateId('tpl_potion');
                  setQuantity(10);
                }}
                className="px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs text-purple-400 hover:bg-purple-500/20"
              >
                🧪 10 зелий
              </button>
              <button
                onClick={() => {
                  setTemplateId('tpl_sword_iron');
                  setQuantity(1);
                }}
                className="px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs text-purple-400 hover:bg-purple-500/20"
              >
                ⚔️ Железный меч
              </button>
              <button
                onClick={() => {
                  setTemplateId('tpl_armor_leather');
                  setQuantity(1);
                }}
                className="px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs text-purple-400 hover:bg-purple-500/20"
              >
                🛡️ Кожаная броня
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-4">
        <h3 className="font-bold text-white mb-3">📊 Статистика мира</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg bg-gray-900/50 p-3">
            <div className="text-gray-400">Ваша позиция</div>
            <div className="text-white font-medium">{Math.round(character.x)}, {Math.round(character.y)}</div>
          </div>
          <div className="rounded-lg bg-gray-900/50 p-3">
            <div className="text-gray-400">Зона</div>
            <div className="text-white font-medium">{character.zone}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
