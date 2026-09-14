import type { CharacterData, InventorySlotData } from '../App';

interface Props {
  character: CharacterData;
  inventory: InventorySlotData[];
  onEnterRaid: () => void;
  onExtract: () => void;
}

export function RaidPanel({ character, inventory, onEnterRaid, onExtract }: Props) {
  const inRaid = character.zone !== 'hub';
  const hasPortalStone = inventory.some(s => s.templateType === 'portal_stone');

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-6">
        <h2 className="text-xl font-bold text-white mb-4">⚔️ Рейдовая зона</h2>
        
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
            <h3 className="font-bold text-white mb-2">📊 Статус</h3>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Зона:</span>
                <span className={inRaid ? 'text-red-400' : 'text-emerald-400'}>{character.zone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Статус:</span>
                <span className="text-white">{inRaid ? 'В рейде' : 'В хабе'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Портал-камень:</span>
                <span className={hasPortalStone ? 'text-emerald-400' : 'text-red-400'}>
                  {hasPortalStone ? 'Есть' : 'Нет'}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
            <h3 className="font-bold text-white mb-2">⚠️ Правила</h3>
            <ul className="space-y-1 text-xs text-gray-400">
              <li>• Смерть = потеря всего лута</li>
              <li>• Экстракция только с портал-камнем</li>
              <li>• Таймер рейда: 15 минут</li>
              <li>• Сейф недоступен в рейде</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-3">
          {!inRaid ? (
            <button
              onClick={onEnterRaid}
              className="flex-1 py-3 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 text-white font-medium hover:opacity-90"
            >
              🏰 Войти в рейд
            </button>
          ) : (
            <button
              onClick={onExtract}
              disabled={!hasPortalStone}
              className={`flex-1 py-3 rounded-lg font-medium ${
                hasPortalStone
                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:opacity-90'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {hasPortalStone ? '🏠 Экстракция (портал-камень)' : '❌ Нет портал-камня'}
            </button>
          )}
        </div>

        {!inRaid && !hasPortalStone && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <p className="text-xs text-amber-400">
              💡 <strong>Совет:</strong> Создайте портал-камень перед рейдом! 
              Он нужен для безопасной экстракции с лутом.
            </p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-4">
        <h3 className="font-bold text-white mb-3">📜 Лог рейда</h3>
        <div className="text-xs text-gray-400 space-y-1">
          <p>• Рейд начинается при входе в рейдовую зону</p>
          <p>• Собирайте ресурсы и сражайтесь с NPC</p>
          <p>• Используйте портал-камень для безопасного выхода</p>
          <p>• Если таймер истечёт — автоматическая экстракция</p>
          <p>• Если умрёте — потеряете весь инвентарь и экипировку</p>
        </div>
      </div>
    </div>
  );
}
