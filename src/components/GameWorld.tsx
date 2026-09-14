import { useRef, useState, useEffect } from 'react';
import type { CharacterData, WorldState } from '../App';

interface Props {
  character: CharacterData;
  worldState: WorldState;
  onMove: (x: number, y: number) => void;
  onPickup: (lootId: string) => void;
  onHarvest: (nodeId: string) => void;
  onAttack: (targetId: string) => void;
}

export function GameWorld({ character, worldState, onMove, onPickup, onHarvest, onAttack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const scale = 1;
    const offsetX = width / 2 - character.x * scale;
    const offsetY = height / 2 - character.y * scale;

    // Clear
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = '#1a2030';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = -1000; x < 1000; x += gridSize) {
      const screenX = offsetX + x * scale;
      ctx.beginPath();
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, height);
      ctx.stroke();
    }
    for (let y = -1000; y < 1000; y += gridSize) {
      const screenY = offsetY + y * scale;
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(width, screenY);
      ctx.stroke();
    }

    // Zone label
    ctx.fillStyle = '#4a5568';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`Zone: ${character.zone}`, 10, 20);

    // Resource nodes
    worldState.nodes.forEach(node => {
      const x = offsetX + node.x * scale;
      const y = offsetY + node.y * scale;
      ctx.fillStyle = node.isDepleted ? '#374151' : '#10b981';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(node.templateName[0], x, y + 3);
      ctx.textAlign = 'left';
    });

    // Loot
    worldState.loot.forEach(loot => {
      const x = offsetX + loot.x * scale;
      const y = offsetY + loot.y * scale;
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(x - 6, y - 6, 12, 12);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(loot.quantity.toString(), x, y + 3);
      ctx.textAlign = 'left';
    });

    // NPCs
    worldState.npcs.forEach(npc => {
      const x = offsetX + npc.x * scale;
      const y = offsetY + npc.y * scale;
      ctx.fillStyle = selectedTarget === npc.id ? '#ef4444' : '#dc2626';
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('👹', x, y + 4);
      ctx.font = '9px monospace';
      ctx.fillText(`${npc.hp}/${npc.maxHp}`, x, y + 20);
      ctx.textAlign = 'left';
    });

    // Other players
    worldState.players.forEach(player => {
      const x = offsetX + player.x * scale;
      const y = offsetY + player.y * scale;
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(player.name, x, y - 15);
      ctx.textAlign = 'left';
    });

    // Current player
    const px = width / 2;
    const py = height / 2;
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(px, py, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(character.name, px, py - 18);
    ctx.textAlign = 'left';
  }, [character, worldState, selectedTarget]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const worldX = character.x + (clickX - centerX);
    const worldY = character.y + (clickY - centerY);

    // Check if clicked on NPC
    const clickedNpc = worldState.npcs.find(npc => {
      const dx = npc.x - worldX;
      const dy = npc.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) < 15;
    });
    if (clickedNpc) {
      setSelectedTarget(clickedNpc.id);
      return;
    }

    // Check if clicked on loot
    const clickedLoot = worldState.loot.find(l => {
      const dx = l.x - worldX;
      const dy = l.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) < 15;
    });
    if (clickedLoot) {
      onPickup(clickedLoot.id);
      return;
    }

    // Check if clicked on node
    const clickedNode = worldState.nodes.find(n => {
      const dx = n.x - worldX;
      const dy = n.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) < 15;
    });
    if (clickedNode && !clickedNode.isDepleted) {
      onHarvest(clickedNode.id);
      return;
    }

    // Move
    onMove(Math.round(worldX), Math.round(worldY));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white">🌍 Игровой мир</h2>
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">🟢 Вы</span>
            <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400">🔵 Игроки: {worldState.players.length}</span>
            <span className="px-2 py-1 rounded bg-red-500/20 text-red-400">🔴 NPC: {worldState.npcs.length}</span>
            <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">🟡 Лут: {worldState.loot.length}</span>
            <span className="px-2 py-1 rounded bg-green-500/20 text-green-400">🟢 Ресурсы: {worldState.nodes.filter(n => !n.isDepleted).length}</span>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          onClick={handleCanvasClick}
          className="w-full rounded-lg border border-gray-700 cursor-crosshair bg-[#0a0e1a]"
        />

        <div className="mt-3 text-xs text-gray-400 space-y-1">
          <p>💡 <strong>Клик</strong> по пустому месту — движение</p>
          <p>💡 <strong>Клик</strong> по 🟢 ресурсу — добыча</p>
          <p>💡 <strong>Клик</strong> по 🟡 луту — подбор</p>
          <p>💡 <strong>Клик</strong> по 🔴 NPC — выбор цели (атака ниже)</p>
        </div>
      </div>

      {selectedTarget && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-red-400">🎯 Цель выбрана</h3>
              <p className="text-xs text-gray-400">NPC ID: {selectedTarget}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onAttack(selectedTarget)}
                className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm hover:bg-red-500/30"
              >
                ⚔️ Атаковать
              </button>
              <button
                onClick={() => setSelectedTarget(null)}
                className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 text-sm hover:bg-gray-600"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-4">
          <h3 className="font-bold text-white mb-3">📦 Лут на земле</h3>
          {worldState.loot.length === 0 ? (
            <p className="text-xs text-gray-500">Пусто</p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {worldState.loot.map(l => (
                <div key={l.id} className="flex items-center justify-between px-2 py-1 rounded bg-gray-900 text-xs">
                  <span className="text-yellow-400">{l.itemName} ×{l.quantity}</span>
                  <button
                    onClick={() => onPickup(l.id)}
                    className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                  >
                    Подобрать
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-4">
          <h3 className="font-bold text-white mb-3">🌿 Ресурсные узлы</h3>
          {worldState.nodes.length === 0 ? (
            <p className="text-xs text-gray-500">Пусто</p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {worldState.nodes.map(n => (
                <div key={n.id} className="flex items-center justify-between px-2 py-1 rounded bg-gray-900 text-xs">
                  <span className={n.isDepleted ? 'text-gray-500' : 'text-green-400'}>
                    {n.templateName} {n.isDepleted ? '(истощён)' : ''}
                  </span>
                  {!n.isDepleted && (
                    <button
                      onClick={() => onHarvest(n.id)}
                      className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                    >
                      Добыть
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
