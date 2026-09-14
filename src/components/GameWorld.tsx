import { useRef, useEffect, useState, useCallback } from 'react';
import type { CharacterData, WorldState } from '../App';
import { VirtualJoystick } from './VirtualJoystick';

interface Props {
  character: CharacterData;
  worldState: WorldState;
  onMove: (x: number, y: number) => void;
  onPickup: (lootId: string) => void;
  onHarvest: (nodeId: string) => void;
  onAttack: (targetId: string) => void;
}

interface AttackAnimation {
  targetX: number;
  targetY: number;
  startTime: number;
  duration: number;
}

export function GameWorld({ character, worldState, onMove, onPickup, onHarvest, onAttack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [attackAnimation, setAttackAnimation] = useState<AttackAnimation | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const positionRef = useRef({ x: character.x, y: character.y });
  const lastMoveTimeRef = useRef(0);
  const animationFrameRef = useRef<number>();

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        keysRef.current.add(key);
      }
      if (key === ' ' || key === 'enter') {
        // Attack selected target
        if (selectedTarget) {
          handleAttack(selectedTarget);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedTarget]);

  // Continuous movement loop
  useEffect(() => {
    const moveSpeed = 3;
    const moveThreshold = 100; // ms between position updates

    const loop = () => {
      const now = Date.now();
      let dx = 0;
      let dy = 0;

      // Keyboard input
      if (keysRef.current.has('w') || keysRef.current.has('arrowup')) dy -= 1;
      if (keysRef.current.has('s') || keysRef.current.has('arrowdown')) dy += 1;
      if (keysRef.current.has('a') || keysRef.current.has('arrowleft')) dx -= 1;
      if (keysRef.current.has('d') || keysRef.current.has('arrowright')) dx += 1;

      // Normalize diagonal movement
      if (dx !== 0 && dy !== 0) {
        const length = Math.sqrt(dx * dx + dy * dy);
        dx /= length;
        dy /= length;
      }

      // Apply movement
      if (dx !== 0 || dy !== 0) {
        positionRef.current.x += dx * moveSpeed;
        positionRef.current.y += dy * moveSpeed;

        // Clamp to world bounds
        positionRef.current.x = Math.max(-500, Math.min(500, positionRef.current.x));
        positionRef.current.y = Math.max(-500, Math.min(500, positionRef.current.y));

        // Send position update (throttled)
        if (now - lastMoveTimeRef.current > moveThreshold) {
          onMove(Math.round(positionRef.current.x), Math.round(positionRef.current.y));
          lastMoveTimeRef.current = now;
        }
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [onMove]);

  // Joystick movement
  const handleJoystickMove = useCallback((dx: number, dy: number) => {
    const moveSpeed = 2;
    positionRef.current.x += dx * moveSpeed;
    positionRef.current.y += dy * moveSpeed;

    positionRef.current.x = Math.max(-500, Math.min(500, positionRef.current.x));
    positionRef.current.y = Math.max(-500, Math.min(500, positionRef.current.y));

    const now = Date.now();
    if (now - lastMoveTimeRef.current > 100) {
      onMove(Math.round(positionRef.current.x), Math.round(positionRef.current.y));
      lastMoveTimeRef.current = now;
    }
  }, [onMove]);

  // Attack with animation
  const handleAttack = useCallback((targetId: string) => {
    const target = worldState.npcs.find(n => n.id === targetId);
    if (!target) return;

    // Check distance
    const dx = target.x - character.x;
    const dy = target.y - character.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 50) {
      // Too far, move closer first
      const angle = Math.atan2(dy, dx);
      positionRef.current.x = target.x - Math.cos(angle) * 40;
      positionRef.current.y = target.y - Math.sin(angle) * 40;
      onMove(Math.round(positionRef.current.x), Math.round(positionRef.current.y));
      return;
    }

    // Start attack animation
    setAttackAnimation({
      targetX: target.x,
      targetY: target.y,
      startTime: Date.now(),
      duration: 300,
    });

    // Execute attack after animation
    setTimeout(() => {
      onAttack(targetId);
      setAttackAnimation(null);
    }, 300);
  }, [worldState.npcs, character.x, character.y, onMove, onAttack]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const offsetX = width / 2 - character.x;
    const offsetY = height / 2 - character.y;

    // Clear
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = '#1a2030';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = -1000; x < 1000; x += gridSize) {
      const screenX = offsetX + x;
      ctx.beginPath();
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, height);
      ctx.stroke();
    }
    for (let y = -1000; y < 1000; y += gridSize) {
      const screenY = offsetY + y;
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
      const x = offsetX + node.x;
      const y = offsetY + node.y;
      ctx.fillStyle = node.isDepleted ? '#374151' : '#10b981';
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(node.templateName[0], x, y + 4);
      ctx.textAlign = 'left';
    });

    // Loot
    worldState.loot.forEach(loot => {
      const x = offsetX + loot.x;
      const y = offsetY + loot.y;
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(x - 8, y - 8, 16, 16);
      ctx.fillStyle = '#000';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(loot.quantity.toString(), x, y + 4);
      ctx.textAlign = 'left';
    });

    // NPCs
    worldState.npcs.forEach(npc => {
      const x = offsetX + npc.x;
      const y = offsetY + npc.y;
      
      // Selection indicator
      if (selectedTarget === npc.id) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, Math.PI * 2);
        ctx.stroke();
      }

      // NPC body
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, Math.PI * 2);
      ctx.fill();
      
      // NPC emoji
      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👹', x, y + 5);
      
      // HP bar
      const hpPercent = npc.hp / npc.maxHp;
      ctx.fillStyle = '#374151';
      ctx.fillRect(x - 15, y - 25, 30, 4);
      ctx.fillStyle = hpPercent > 0.5 ? '#10b981' : hpPercent > 0.25 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(x - 15, y - 25, 30 * hpPercent, 4);
      
      // HP text
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.fillText(`${npc.hp}/${npc.maxHp}`, x, y + 25);
      ctx.textAlign = 'left';
    });

    // Other players
    worldState.players.forEach(player => {
      const x = offsetX + player.x;
      const y = offsetY + player.y;
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(player.name, x, y - 18);
      ctx.textAlign = 'left';
    });

    // Attack animation
    if (attackAnimation) {
      const elapsed = Date.now() - attackAnimation.startTime;
      const progress = Math.min(elapsed / attackAnimation.duration, 1);
      
      const startX = width / 2;
      const startY = height / 2;
      const endX = offsetX + attackAnimation.targetX;
      const endY = offsetY + attackAnimation.targetY;
      
      const currentX = startX + (endX - startX) * progress;
      const currentY = startY + (endY - startY) * progress;
      
      // Slash effect
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(currentX, currentY, 20 + progress * 10, 0, Math.PI * 2);
      ctx.stroke();
      
      // Impact effect
      if (progress > 0.7) {
        ctx.fillStyle = `rgba(251, 191, 36, ${1 - progress})`;
        ctx.beginPath();
        ctx.arc(endX, endY, 30 * progress, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Current player
    const px = width / 2;
    const py = height / 2;
    
    // Player glow
    const gradient = ctx.createRadialGradient(px, py, 0, px, py, 20);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(px, py, 20, 0, Math.PI * 2);
    ctx.fill();
    
    // Player body
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Player name
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(character.name, px, py - 22);
    ctx.textAlign = 'left';
  }, [character, worldState, selectedTarget, attackAnimation]);

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
      return Math.sqrt(dx * dx + dy * dy) < 20;
    });
    if (clickedNpc) {
      setSelectedTarget(clickedNpc.id);
      return;
    }

    // Check if clicked on loot
    const clickedLoot = worldState.loot.find(l => {
      const dx = l.x - worldX;
      const dy = l.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) < 20;
    });
    if (clickedLoot) {
      onPickup(clickedLoot.id);
      return;
    }

    // Check if clicked on node
    const clickedNode = worldState.nodes.find(n => {
      const dx = n.x - worldX;
      const dy = n.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) < 20;
    });
    if (clickedNode && !clickedNode.isDepleted) {
      onHarvest(clickedNode.id);
      return;
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white">🌍 Игровой мир</h2>
          <div className="flex gap-2 text-xs flex-wrap">
            <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">🟢 Вы</span>
            <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400">🔵 Игроки: {worldState.players.length}</span>
            <span className="px-2 py-1 rounded bg-red-500/20 text-red-400">🔴 NPC: {worldState.npcs.length}</span>
            <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">🟡 Лут: {worldState.loot.length}</span>
          </div>
        </div>

        <div className="relative">
          <canvas
            ref={canvasRef}
            width={800}
            height={500}
            onClick={handleCanvasClick}
            className="w-full rounded-lg border border-gray-700 cursor-crosshair bg-[#0a0e1a]"
          />

          {/* Mobile joystick */}
          {isMobile && (
            <div className="absolute bottom-4 left-4">
              <VirtualJoystick onMove={handleJoystickMove} size={120} />
            </div>
          )}

          {/* Attack button for mobile */}
          {isMobile && selectedTarget && (
            <div className="absolute bottom-4 right-4">
              <button
                onClick={() => handleAttack(selectedTarget)}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-orange-500 text-white text-2xl font-bold shadow-lg shadow-red-500/50 active:scale-95 transition-transform"
              >
                ⚔️
              </button>
            </div>
          )}
        </div>

        <div className="mt-3 text-xs text-gray-400 space-y-1">
          {isMobile ? (
            <>
              <p>💡 <strong>Джойстик</strong> — движение</p>
              <p>💡 <strong>Клик</strong> по объектам — взаимодействие</p>
              <p>💡 <strong>Красная кнопка</strong> — атака выбранной цели</p>
            </>
          ) : (
            <>
              <p>💡 <strong>WASD / Стрелки</strong> — движение</p>
              <p>💡 <strong>Клик</strong> по 🟢 ресурсу — добыча</p>
              <p>💡 <strong>Клик</strong> по 🟡 луту — подбор</p>
              <p>💡 <strong>Клик</strong> по 🔴 NPC — выбор цели</p>
              <p>💡 <strong>Пробел / Enter</strong> — атака выбранной цели</p>
            </>
          )}
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
                onClick={() => handleAttack(selectedTarget)}
                className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm hover:bg-red-500/30 active:scale-95 transition-transform"
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
                    className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 active:scale-95 transition-transform"
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
                      className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 active:scale-95 transition-transform"
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
