import type { StashSlotData } from '../App';

interface Props {
  stash: StashSlotData[];
  maxSlots: number;
  onWithdraw: (stashIndex: number) => void;
  canAccess: boolean;
}

export function StashPanel({ stash, maxSlots, onWithdraw, canAccess }: Props) {
  const slots = Array.from({ length: maxSlots }, (_, i) => stash.find(s => s.slotIndex === i) ?? null);

  if (!canAccess) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h2 className="text-lg font-bold text-amber-400 mb-2">Сейф недоступен</h2>
        <p className="text-sm text-gray-400">Доступ к сейфу только в безопасной зоне (Хаб)</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-4">
      <h2 className="text-lg font-bold text-white mb-3">🔒 Сейф ({stash.length}/{maxSlots})</h2>
      <p className="text-xs text-gray-400 mb-4">Безопасное хранилище — не теряется при смерти</p>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {slots.map((slot, i) => (
          <div
            key={i}
            className={`rounded-lg border p-3 ${
              slot ? 'border-purple-500/30 bg-purple-500/5' : 'border-gray-700 bg-gray-900/30'
            }`}
          >
            <div className="text-[10px] text-gray-500 mb-1">Слот #{i}</div>
            {slot ? (
              <div>
                <div className="text-xs text-white font-medium truncate">{slot.templateName}</div>
                <div className="text-[10px] text-gray-400 mb-2">×{slot.quantity}</div>
                <button
                  onClick={() => onWithdraw(slot.slotIndex)}
                  className="w-full px-2 py-1 text-[10px] rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                >
                  Забрать
                </button>
              </div>
            ) : (
              <div className="text-[10px] text-gray-600 italic">Пусто</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
