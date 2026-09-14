import type { InventorySlotData, EquipmentSlotData } from '../App';

interface Props {
  inventory: InventorySlotData[];
  equipment: EquipmentSlotData[];
  onEquip: (slotIndex: number, equipmentSlot: string) => void;
  onUnequip: (slot: string) => void;
  onDrop: (slotIndex: number, quantity: number) => void;
  onDeposit: (slotIndex: number) => void;
  canDeposit: boolean;
}

const EQUIPMENT_SLOTS = ['weapon', 'armor', 'helmet', 'boots'];

export function InventoryPanel({ inventory, equipment, onEquip, onUnequip, onDrop, onDeposit, canDeposit }: Props) {
  const slots = Array.from({ length: 10 }, (_, i) => inventory.find(s => s.slotIndex === i) ?? null);

  return (
    <div className="space-y-4">
      {/* Equipment */}
      <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-4">
        <h2 className="text-lg font-bold text-white mb-3">⚔️ Экипировка</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {EQUIPMENT_SLOTS.map(slot => {
            const equipped = equipment.find(e => e.slotType === slot);
            return (
              <div key={slot} className="rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                <div className="text-[10px] text-gray-500 uppercase mb-1">{slot}</div>
                {equipped ? (
                  <div>
                    <div className="text-xs text-white font-medium">{equipped.templateName}</div>
                    {equipped.durability !== undefined && equipped.maxDurability !== undefined && (
                      <div className="text-[10px] text-gray-400">
                        {equipped.durability}/{equipped.maxDurability}
                      </div>
                    )}
                    <button
                      onClick={() => onUnequip(slot)}
                      className="mt-1 px-2 py-0.5 text-[10px] rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    >
                      Снять
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-gray-600 italic">Пусто</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Inventory */}
      <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-4">
        <h2 className="text-lg font-bold text-white mb-3">🎒 Инвентарь ({inventory.length}/10)</h2>
        <div className="grid grid-cols-5 gap-2">
          {slots.map((slot, i) => (
            <div
              key={i}
              className={`aspect-square rounded-lg border p-2 flex flex-col justify-between ${
                slot ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-gray-700 bg-gray-900/30'
              }`}
            >
              <div className="text-[10px] text-gray-500">#{i}</div>
              {slot ? (
                <div className="flex-1 flex flex-col justify-end">
                  <div className="text-xs text-white font-medium truncate">{slot.templateName}</div>
                  <div className="text-[10px] text-gray-400">×{slot.quantity}</div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {['weapon', 'armor', 'helmet', 'boots'].includes(slot.templateType) && (
                      <button
                        onClick={() => onEquip(slot.slotIndex, slot.templateType)}
                        className="px-1.5 py-0.5 text-[9px] rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                        title="Экипировать"
                      >
                        ⚔️
                      </button>
                    )}
                    {canDeposit && (
                      <button
                        onClick={() => onDeposit(slot.slotIndex)}
                        className="px-1.5 py-0.5 text-[9px] rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                        title="В сейф"
                      >
                        🔒
                      </button>
                    )}
                    <button
                      onClick={() => onDrop(slot.slotIndex, slot.quantity)}
                      className="px-1.5 py-0.5 text-[9px] rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      title="Выбросить"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-gray-600 italic">Пусто</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
