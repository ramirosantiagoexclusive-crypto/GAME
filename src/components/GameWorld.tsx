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
  onAbility?: (ability: string) => void;
}

interface Ability {
  key: string;
  name: string;
  icon: string;
  cooldown: number;
  lastUsed: number;
  color: string;
  range: number;
  unlockLevel: number;
}

interface MoveTarget {
  x: number;
  y: number;
  time: number;
}

interface AttackEffect {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startTime: number;
  duration: number;
  type: 'slash' | 'projectile' | 'magic';
  color: string;
}

export function GameWorld({ character, worldState, onMove, onPickup, onHarvest, onAttack, onAbility }: Props) {
  console.log('[GameWorld] 🎮 MOBA-style v2.0 component loaded!');
  useEffect(() => {
    console.log('✅ GameWorld mounted - MOBA controls active!');
  }, []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [attackEffects, setAttackEffects] = useState<AttackEffect[]>([]);
  const [abilities, setAbilities] = useState<Ability[]>([
    { key: 'Q', name: 'Удар', icon: '⚔️', cooldown: 2, lastUsed: 0, color: '#ef4444', range: 60, unlockLevel: 1 },
    { key: 'E', name: 'Щит', icon: '🛡️', cooldown: 8, lastUsed: 0, color: '#10b981', range: 0, unlockLevel: 3 },
    { key: 'R', name: 'Ульта', icon: '💥', cooldown: 30, lastUsed: 0, color: '#a855f7', range: 200, unlockLevel: 5 },
  ]);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [playerXP, setPlayerXP] = useState(0);

  // Refs for game loop (avoid stale closures)
  const localPosRef = useRef({ x: character.x, y: character.y });
  const targetPosRef = useRef<{ x: number; y: number } | null>(null);
  const attackTargetRef = useRef<string | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const animationFrameRef = useRef<number>(0);
  const lastServerUpdateRef = useRef(0);
  const worldStateRef = useRef(worldState);
  const characterRef = useRef(character);
  const selectedTargetRef = useRef(selectedTarget);
  const moveTargetRef = useRef<MoveTarget | null>(null);
  const attackEffectsRef = useRef<AttackEffect[]>([]);
  
  // NPC AI state (stored separately from worldState)
  const npcAIRef = useRef<Map<string, {
    homeX: number;
    homeY: number;
    lastAttack: number;
    patrolTarget: { x: number; y: number } | null;
  }>>(new Map());

  // Initialize NPC AI data when NPCs change
  useEffect(() => {
    worldState.npcs.forEach(npc => {
      if (!npcAIRef.current.has(npc.id)) {
        npcAIRef.current.set(npc.id, {
          homeX: npc.x,
          homeY: npc.y,
          lastAttack: 0,
          patrolTarget: null,
        });
      }
    });
    // Clean up removed NPCs
    const currentIds = new Set(worldState.npcs.map(n => n.id));
    for (const id of npcAIRef.current.keys()) {
      if (!currentIds.has(id)) {
        npcAIRef.current.delete(id);
      }
    }
  }, [worldState.npcs]);

  // Keep refs in sync with state
  useEffect(() => { worldStateRef.current = worldState; }, [worldState]);
  useEffect(() => { characterRef.current = character; }, [character]);
  useEffect(() => { selectedTargetRef.current = selectedTarget; }, [selectedTarget]);
  useEffect(() => { moveTargetRef.current = moveTarget; }, [moveTarget]);
  useEffect(() => { attackEffectsRef.current = attackEffects; }, [attackEffects]);

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
        e.preventDefault();
      }

      // Способности только на Q, E, R (W зарезервирована для движения)
      if (['q', 'e', 'r'].includes(key) && !e.repeat) {
        useAbility(key.toUpperCase());
      }

      if (key === 's' && !keysRef.current.has('a') && !keysRef.current.has('d') && !keysRef.current.has('w')) {
        // Only stop if S is pressed alone (not WASD movement)
      }

      if (key === ' ' && selectedTargetRef.current) {
        e.preventDefault();
        attackTargetRef.current = selectedTargetRef.current;
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
  }, []);

  const useAbility = useCallback((key: string) => {
    const now = Date.now();
    setAbilities(prev => prev.map(a => {
      if (a.key === key) {
        // Проверка разблокировки
        if (a.unlockLevel > playerLevel) {
          console.log(`Способность ${a.name} заблокирована! Нужен уровень ${a.unlockLevel}`);
          return a;
        }
        
        const elapsed = (now - a.lastUsed) / 1000;
        if (elapsed >= a.cooldown) {
          onAbility?.(key);

          const targetId = selectedTargetRef.current;
          const target = targetId ? worldStateRef.current.npcs.find(n => n.id === targetId) : null;
          if (target) {
            const effect: AttackEffect = {
              id: Math.random().toString(),
              fromX: localPosRef.current.x,
              fromY: localPosRef.current.y,
              toX: target.x,
              toY: target.y,
              startTime: now,
              duration: 400,
              type: key === 'R' ? 'magic' : 'slash',
              color: a.color,
            };
            setAttackEffects(prev => [...prev, effect]);
            setTimeout(() => {
              setAttackEffects(prev => prev.filter(e => e.id !== effect.id));
            }, 500);
          }

          return { ...a, lastUsed: now };
        }
      }
      return a;
    }));
  }, [onAbility, playerLevel]);

  // Система опыта - добавляем XP за убийство NPC
  useEffect(() => {
    const prevNpcCount = worldStateRef.current.npcs.length;
    return () => {
      const currentNpcCount = worldState.npcs.length;
      if (currentNpcCount < prevNpcCount) {
        // NPC убит - даем XP
        const xpGained = 20 + Math.floor(Math.random() * 10);
        setPlayerXP(prev => {
          const newXP = prev + xpGained;
          const xpToNextLevel = playerLevel * 100;
          if (newXP >= xpToNextLevel) {
            setPlayerLevel(l => l + 1);
            return newXP - xpToNextLevel;
          }
          return newXP;
        });
      }
    };
  }, [worldState.npcs.length, playerLevel]);

  // MAIN GAME LOOP — handles movement AND rendering
  useEffect(() => {
    const moveSpeed = 4;
    const attackRange = 50;
    const arriveThreshold = 5;
    let lastAttackTime = 0;

    const loop = () => {
      const now = Date.now();
      const canvas = canvasRef.current;
      if (!canvas) {
        animationFrameRef.current = requestAnimationFrame(loop);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      const ws = worldStateRef.current;
      const char = characterRef.current;
      const width = canvas.width;
      const height = canvas.height;

      // ============ NPC AI ============
      ws.npcs.forEach(npc => {
        const ai = npcAIRef.current.get(npc.id);
        if (!ai) return;
        
        const dx = char.x - npc.x;
        const dy = char.y - npc.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Агрессия если игрок рядом
        if (dist < 150 && dist > 40) {
          // Движение к игроку
          npc.x += (dx / dist) * 1.5;
          npc.y += (dy / dist) * 1.5;
        } else if (dist <= 40) {
          // Атака если очень близко (каждые 1.5 сек)
          if (now - ai.lastAttack > 1500) {
            ai.lastAttack = now;
            // Визуальный эффект атаки
            const effect: AttackEffect = {
              id: Math.random().toString(),
              fromX: npc.x,
              fromY: npc.y,
              toX: char.x,
              toY: char.y,
              startTime: now,
              duration: 300,
              type: 'slash',
              color: '#ef4444',
            };
            setAttackEffects(prev => [...prev, effect]);
            setTimeout(() => {
              setAttackEffects(prev => prev.filter(e => e.id !== effect.id));
            }, 400);
          }
        } else {
          // Патрулирование
          if (!ai.patrolTarget || Math.random() < 0.005) {
            ai.patrolTarget = {
              x: ai.homeX + (Math.random() - 0.5) * 100,
              y: ai.homeY + (Math.random() - 0.5) * 100,
            };
          }
          if (ai.patrolTarget) {
            const pdx = ai.patrolTarget.x - npc.x;
            const pdy = ai.patrolTarget.y - npc.y;
            const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
            if (pdist > 5) {
              npc.x += (pdx / pdist) * 0.8;
              npc.y += (pdy / pdist) * 0.8;
            }
          }
        }
      });

      // ============ PLAYER MOVEMENT LOGIC ============

      let moved = false;
      let kx = 0, ky = 0;

      // Keyboard movement
      if (keysRef.current.has('w') || keysRef.current.has('arrowup')) ky -= 1;
      if (keysRef.current.has('s') || keysRef.current.has('arrowdown')) ky += 1;
      if (keysRef.current.has('a') || keysRef.current.has('arrowleft')) kx -= 1;
      if (keysRef.current.has('d') || keysRef.current.has('arrowright')) kx += 1;

      if (kx !== 0 || ky !== 0) {
        targetPosRef.current = null;
        moveTargetRef.current = null;

        const length = Math.sqrt(kx * kx + ky * ky);
        kx /= length;
        ky /= length;

        localPosRef.current.x += kx * moveSpeed;
        localPosRef.current.y += ky * moveSpeed;
        localPosRef.current.x = Math.max(-500, Math.min(500, localPosRef.current.x));
        localPosRef.current.y = Math.max(-500, Math.min(500, localPosRef.current.y));
        moved = true;
      }

      // Click-to-move (lerp)
      const tp = targetPosRef.current;
      if (tp && kx === 0 && ky === 0) {
        const dx = tp.x - localPosRef.current.x;
        const dy = tp.y - localPosRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > arriveThreshold) {
          localPosRef.current.x += (dx / distance) * moveSpeed;
          localPosRef.current.y += (dy / distance) * moveSpeed;
          moved = true;
        } else {
          targetPosRef.current = null;
          moveTargetRef.current = null;
        }
      }

      // Attack target movement
      if (attackTargetRef.current) {
        const target = ws.npcs.find(n => n.id === attackTargetRef.current);
        if (target) {
          const dx = target.x - localPosRef.current.x;
          const dy = target.y - localPosRef.current.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > attackRange) {
            localPosRef.current.x += (dx / distance) * moveSpeed;
            localPosRef.current.y += (dy / distance) * moveSpeed;
            moved = true;
          } else if (now - lastAttackTime > 800) {
            // Attack!
            lastAttackTime = now;
            onAttack(target.id);

            const effect: AttackEffect = {
              id: Math.random().toString(),
              fromX: localPosRef.current.x,
              fromY: localPosRef.current.y,
              toX: target.x,
              toY: target.y,
              startTime: now,
              duration: 300,
              type: 'slash',
              color: '#fbbf24',
            };
            setAttackEffects(prev => [...prev, effect]);
            setTimeout(() => {
              setAttackEffects(prev => prev.filter(e => e.id !== effect.id));
            }, 400);
          }
        } else {
          attackTargetRef.current = null;
          setSelectedTarget(null);
        }
      }

      // Send position to server (throttled)
      if (moved && now - lastServerUpdateRef.current > 80) {
        onMove(Math.round(localPosRef.current.x), Math.round(localPosRef.current.y));
        lastServerUpdateRef.current = now;
      }

      // ============ RENDERING ============

      const playerX = localPosRef.current.x;
      const playerY = localPosRef.current.y;
      const offsetX = width / 2 - playerX;
      const offsetY = height / 2 - playerY;

      // Clear with gradient background
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, '#0a1628');
      bgGradient.addColorStop(1, '#0f172a');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // Ground texture - grass patches
      const grassSeed = Math.floor(playerX / 200) * 1000 + Math.floor(playerY / 200);
      for (let i = 0; i < 30; i++) {
        const seed = (grassSeed + i * 137) % 10000;
        const gx = offsetX + ((seed * 73) % 1000) - 500;
        const gy = offsetY + ((seed * 137) % 1000) - 500;
        if (gx > -50 && gx < width + 50 && gy > -50 && gy < height + 50) {
          ctx.fillStyle = `rgba(34, 197, 94, ${0.05 + (seed % 10) * 0.01})`;
          ctx.beginPath();
          ctx.ellipse(gx, gy, 15 + (seed % 10), 8 + (seed % 5), (seed % 3) * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Decorative elements - trees, rocks
      const decorSeed = Math.floor(playerX / 300) * 1000 + Math.floor(playerY / 300);
      for (let i = 0; i < 15; i++) {
        const seed = (decorSeed + i * 251) % 10000;
        const dx = offsetX + ((seed * 97) % 1200) - 600;
        const dy = offsetY + ((seed * 173) % 1200) - 600;
        if (dx > -50 && dx < width + 50 && dy > -50 && dy < height + 50) {
          if (seed % 3 === 0) {
            // Tree
            ctx.fillStyle = '#1e3a1e';
            ctx.beginPath();
            ctx.arc(dx, dy - 15, 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#4a2c17';
            ctx.fillRect(dx - 3, dy, 6, 15);
          } else if (seed % 3 === 1) {
            // Rock
            ctx.fillStyle = '#374151';
            ctx.beginPath();
            ctx.ellipse(dx, dy, 12, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#1f2937';
            ctx.lineWidth = 1;
            ctx.stroke();
          } else {
            // Bush
            ctx.fillStyle = '#166534';
            ctx.beginPath();
            ctx.arc(dx, dy, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(dx + 6, dy - 3, 8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Grid (subtle)
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.3)';
      ctx.lineWidth = 1;
      const gridSize = 50;
      const startX = Math.floor((playerX - width / 2) / gridSize) * gridSize;
      const startY = Math.floor((playerY - height / 2) / gridSize) * gridSize;
      for (let x = startX; x < playerX + width / 2 + gridSize; x += gridSize) {
        const screenX = offsetX + x;
        ctx.beginPath();
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, height);
        ctx.stroke();
      }
      for (let y = startY; y < playerY + height / 2 + gridSize; y += gridSize) {
        const screenY = offsetY + y;
        ctx.beginPath();
        ctx.moveTo(0, screenY);
        ctx.lineTo(width, screenY);
        ctx.stroke();
      }

      // Zone label
      ctx.fillStyle = '#4a5568';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Zone: ${char.zone}`, 10, 20);
      ctx.fillText(`Pos: ${Math.round(playerX)}, ${Math.round(playerY)}`, 10, 38);

      // Move target indicator
      const mt = moveTargetRef.current;
      if (mt && now - mt.time < 500) {
        const tx = offsetX + mt.x;
        const ty = offsetY + mt.y;
        const alpha = 1 - (now - mt.time) / 500;

        ctx.strokeStyle = `rgba(16, 185, 129, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tx, ty, 15, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(tx - 8, ty);
        ctx.lineTo(tx + 8, ty);
        ctx.moveTo(tx, ty - 8);
        ctx.lineTo(tx, ty + 8);
        ctx.stroke();

        // Path line
        ctx.strokeStyle = `rgba(16, 185, 129, ${alpha * 0.3})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(width / 2, height / 2);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Attack target line
      if (attackTargetRef.current) {
        const target = ws.npcs.find(n => n.id === attackTargetRef.current);
        if (target) {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 4]);
          ctx.beginPath();
          ctx.moveTo(width / 2, height / 2);
          ctx.lineTo(offsetX + target.x, offsetY + target.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Attack range indicator
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, attackRange, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Resource nodes
      ws.nodes.forEach(node => {
        const x = offsetX + node.x;
        const y = offsetY + node.y;
        if (x < -50 || x > width + 50 || y < -50 || y > height + 50) return;

        if (!node.isDepleted) {
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, 25);
          gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
          gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(x, y, 25, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = node.isDepleted ? '#374151' : '#10b981';
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = node.isDepleted ? '#1f2937' : '#065f46';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(node.templateName[0], x, y + 5);
      });

      // Loot
      ws.loot.forEach(loot => {
        const x = offsetX + loot.x;
        const y = offsetY + loot.y;
        if (x < -50 || x > width + 50 || y < -50 || y > height + 50) return;

        // Pulsing glow
        const pulse = (Math.sin(now / 300) + 1) / 2;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 20 + pulse * 5);
        gradient.addColorStop(0, 'rgba(251, 191, 36, 0.5)');
        gradient.addColorStop(1, 'rgba(251, 191, 36, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, 20 + pulse * 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(x - 10, y - 10, 20, 20);
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 10, y - 10, 20, 20);

        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(loot.quantity.toString(), x, y + 4);
      });

      // NPCs
      ws.npcs.forEach(npc => {
        const x = offsetX + npc.x;
        const y = offsetY + npc.y;
        if (x < -50 || x > width + 50 || y < -50 || y > height + 50) return;

        // Selection ring
        if (selectedTargetRef.current === npc.id || attackTargetRef.current === npc.id) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x, y, 24, 0, Math.PI * 2);
          ctx.stroke();

          const pulse = (Math.sin(now / 200) + 1) / 2;
          ctx.strokeStyle = `rgba(239, 68, 68, ${0.3 + pulse * 0.3})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x, y, 28 + pulse * 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x, y + 16, 14, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        const gradient = ctx.createRadialGradient(x - 4, y - 4, 0, x, y, 16);
        gradient.addColorStop(0, '#f87171');
        gradient.addColorStop(1, '#991b1b');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#7f1d1d';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👹', x, y + 6);

        // HP bar
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(x - 18, y - 28, 36, 6);
        const hpPercent = npc.hp / npc.maxHp;
        ctx.fillStyle = hpPercent > 0.5 ? '#10b981' : hpPercent > 0.25 ? '#f59e0b' : '#ef4444';
        ctx.fillRect(x - 18, y - 28, 36 * hpPercent, 6);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 18, y - 28, 36, 6);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`${npc.hp}/${npc.maxHp}`, x, y + 32);

        ctx.fillStyle = '#fca5a5';
        ctx.font = '10px monospace';
        ctx.fillText(npc.templateId, x, y - 32);
      });

      // Other players
      ws.players.forEach(player => {
        const x = offsetX + player.x;
        const y = offsetY + player.y;
        if (x < -50 || x > width + 50 || y < -50 || y > height + 50) return;

        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1e40af';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(player.name, x, y - 20);
      });

      // Attack effects
      attackEffectsRef.current.forEach(effect => {
        const elapsed = now - effect.startTime;
        const progress = Math.min(elapsed / effect.duration, 1);

        const fromX = offsetX + effect.fromX;
        const fromY = offsetY + effect.fromY;
        const toX = offsetX + effect.toX;
        const toY = offsetY + effect.toY;

        if (effect.type === 'slash') {
          const currentX = fromX + (toX - fromX) * Math.min(progress * 2, 1);
          const currentY = fromY + (toY - fromY) * Math.min(progress * 2, 1);

          ctx.strokeStyle = effect.color;
          ctx.lineWidth = 4 * (1 - progress);
          ctx.beginPath();
          ctx.arc(currentX, currentY, 15 + progress * 20, 0, Math.PI * 1.5);
          ctx.stroke();

          if (progress > 0.5) {
            const impactAlpha = 1 - (progress - 0.5) * 2;
            ctx.fillStyle = `rgba(251, 191, 36, ${impactAlpha})`;
            ctx.beginPath();
            ctx.arc(toX, toY, 20 * progress, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (effect.type === 'projectile') {
          const currentX = fromX + (toX - fromX) * progress;
          const currentY = fromY + (toY - fromY) * progress;

          ctx.fillStyle = effect.color;
          ctx.beginPath();
          ctx.arc(currentX, currentY, 8, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = effect.color + '80';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(fromX, fromY);
          ctx.lineTo(currentX, currentY);
          ctx.stroke();
        } else if (effect.type === 'magic') {
          const radius = progress * 60;
          const alpha = 1 - progress;

          ctx.strokeStyle = effect.color;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(toX, toY, radius, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = effect.color;
          ctx.globalAlpha = alpha * 0.4;
          ctx.beginPath();
          ctx.arc(toX, toY, radius * 0.7, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;

          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const px = toX + Math.cos(angle) * radius;
            const py = toY + Math.sin(angle) * radius;
            ctx.fillStyle = effect.color;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(px, py, 3 * (1 - progress), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      });

      // Current player
      const px = width / 2;
      const py = height / 2;

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(px, py + 18, 16, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Glow
      const playerGlow = ctx.createRadialGradient(px, py, 0, px, py, 30);
      playerGlow.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
      playerGlow.addColorStop(1, 'rgba(16, 185, 129, 0)');
      ctx.fillStyle = playerGlow;
      ctx.beginPath();
      ctx.arc(px, py, 30, 0, Math.PI * 2);
      ctx.fill();

      // Body
      const playerGradient = ctx.createRadialGradient(px - 4, py - 4, 0, px, py, 18);
      playerGradient.addColorStop(0, '#34d399');
      playerGradient.addColorStop(1, '#047857');
      ctx.fillStyle = playerGradient;
      ctx.beginPath();
      ctx.arc(px, py, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Name plate
      ctx.font = 'bold 12px monospace';
      const nameWidth = ctx.measureText(char.name).width + 16;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(px - nameWidth / 2, py - 36, nameWidth, 18);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1;
      ctx.strokeRect(px - nameWidth / 2, py - 36, nameWidth, 18);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(char.name, px, py - 23);

      // HP bar
      const charHpPercent = char.hp / char.maxHp;
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(px - 20, py + 22, 40, 5);
      ctx.fillStyle = charHpPercent > 0.5 ? '#10b981' : charHpPercent > 0.25 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(px - 20, py + 22, 40 * charHpPercent, 5);

      ctx.textAlign = 'left';

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [onMove, onAttack]);

  // Joystick movement
  const handleJoystickMove = useCallback((dx: number, dy: number) => {
    const moveSpeed = 3;
    if (dx !== 0 || dy !== 0) {
      targetPosRef.current = null;
      moveTargetRef.current = null;
      setMoveTarget(null);

      localPosRef.current.x += dx * moveSpeed;
      localPosRef.current.y += dy * moveSpeed;
      localPosRef.current.x = Math.max(-500, Math.min(500, localPosRef.current.x));
      localPosRef.current.y = Math.max(-500, Math.min(500, localPosRef.current.y));

      const now = Date.now();
      if (now - lastServerUpdateRef.current > 80) {
        onMove(Math.round(localPosRef.current.x), Math.round(localPosRef.current.y));
        lastServerUpdateRef.current = now;
      }
    }
  }, [onMove]);

  // Canvas click handler - только ЛКМ
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Только левая кнопка
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const playerX = localPosRef.current.x;
    const playerY = localPosRef.current.y;
    const worldX = playerX + (clickX - canvas.width / 2);
    const worldY = playerY + (clickY - canvas.height / 2);

    const ws = worldStateRef.current;

    // NPC - выбор цели
    const clickedNpc = ws.npcs.find(npc => {
      const dx = npc.x - worldX;
      const dy = npc.y - worldY;
      return Math.sqrt(dx * dx + dy * dy) < 20;
    });
    if (clickedNpc) {
      setSelectedTarget(clickedNpc.id);
      attackTargetRef.current = clickedNpc.id;
      targetPosRef.current = null;
      return;
    }

    // Loot (проверяем дистанцию до игрока)
    const clickedLoot = ws.loot.find(l => {
      const dx = l.x - worldX;
      const dy = l.y - worldY;
      const clickDist = Math.sqrt(dx * dx + dy * dy);
      
      const playerDist = Math.sqrt(
        Math.pow(l.x - localPosRef.current.x, 2) + 
        Math.pow(l.y - localPosRef.current.y, 2)
      );
      
      return clickDist < 20 && playerDist < 50;
    });
    if (clickedLoot) {
      onPickup(clickedLoot.id);
      return;
    }

    // Resource node (проверяем дистанцию)
    const clickedNode = ws.nodes.find(n => {
      const dx = n.x - worldX;
      const dy = n.y - worldY;
      const clickDist = Math.sqrt(dx * dx + dy * dy);
      
      const playerDist = Math.sqrt(
        Math.pow(n.x - localPosRef.current.x, 2) + 
        Math.pow(n.y - localPosRef.current.y, 2)
      );
      
      return clickDist < 20 && playerDist < 60;
    });
    if (clickedNode && !clickedNode.isDepleted) {
      onHarvest(clickedNode.id);
      return;
    }

    // Move to click
    targetPosRef.current = { x: worldX, y: worldY };
    attackTargetRef.current = null;
    setSelectedTarget(null);
    setMoveTarget({ x: worldX, y: worldY, time: Date.now() });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  // Mobile attack button
  const handleMobileAttack = () => {
    if (selectedTarget) {
      attackTargetRef.current = selectedTarget;
    } else {
      let nearestId: string | null = null;
      let minDist = Infinity;
      worldStateRef.current.npcs.forEach(npc => {
        const dx = npc.x - localPosRef.current.x;
        const dy = npc.y - localPosRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          nearestId = npc.id;
        }
      });
      if (nearestId) {
        setSelectedTarget(nearestId);
        attackTargetRef.current = nearestId;
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-lg font-bold text-white">🌍 Игровой мир <span className="text-xs text-emerald-400 ml-2">v2.0 MOBA</span></h2>
          <div className="flex gap-2 text-xs flex-wrap">
            <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">🟢 Вы</span>
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
            onContextMenu={handleContextMenu}
            className="w-full rounded-lg border border-gray-700 bg-[#0a0e1a]"
            style={{ cursor: isMobile ? 'default' : 'crosshair', touchAction: 'none' }}
          />

          {isMobile && (
            <div className="absolute bottom-4 left-4">
              <VirtualJoystick onMove={handleJoystickMove} size={140} />
            </div>
          )}

          {isMobile && (
            <div className="absolute bottom-4 right-4 flex flex-col gap-2 items-center">
              <button
                onPointerDown={handleMobileAttack}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-orange-500 text-white text-3xl font-bold shadow-lg shadow-red-500/50 active:scale-90 transition-transform border-2 border-red-300/30"
              >
                ⚔️
              </button>

              <div className="flex gap-2">
                {abilities.map(ability => {
                  const now = Date.now();
                  const elapsed = (now - ability.lastUsed) / 1000;
                  const onCooldown = elapsed < ability.cooldown;
                  const cdPercent = onCooldown ? 1 - elapsed / ability.cooldown : 0;

                  return (
                    <button
                      key={ability.key}
                      onClick={() => useAbility(ability.key)}
                      disabled={onCooldown}
                      className="relative w-12 h-12 rounded-lg text-xl font-bold shadow-lg active:scale-90 transition-transform border-2"
                      style={{
                        background: onCooldown ? '#374151' : ability.color,
                        borderColor: onCooldown ? '#4b5563' : ability.color,
                        opacity: onCooldown ? 0.6 : 1,
                      }}
                    >
                      {ability.icon}
                      {onCooldown && (
                        <>
                          <div
                            className="absolute inset-0 bg-black/60 rounded-lg"
                            style={{ clipPath: `polygon(0 0, 100% 0, 100% ${cdPercent * 100}%, 0 ${cdPercent * 100}%)` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-xs text-white">
                            {Math.ceil(ability.cooldown - elapsed)}
                          </span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!isMobile && (
            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 text-[10px] text-gray-300 space-y-0.5 border border-gray-700">
              <div className="text-emerald-400 font-bold mb-1">✨ MOBA-стиль v2.0</div>
              <div><span className="text-emerald-400 font-bold">ЛКМ</span> — выбор цели/взаимодействие</div>
              <div><span className="text-emerald-400 font-bold">ЛКМ по земле</span> — движение</div>
              <div><span className="text-emerald-400 font-bold">WASD</span> — движение</div>
              <div><span className="text-emerald-400 font-bold">Q/E/R</span> — способности</div>
              <div><span className="text-emerald-400 font-bold">Space</span> — атака цели</div>
              <div className="text-gray-500 mt-1">Ур. {playerLevel} • XP: {playerXP}</div>
            </div>
          )}
        </div>
      </div>

      {/* Desktop ability bar */}
      {!isMobile && (
        <div className="rounded-xl border border-gray-800 bg-[#0d1220] p-3">
          <div className="flex items-center justify-center gap-3">
            {abilities.map(ability => {
              const now = Date.now();
              const elapsed = (now - ability.lastUsed) / 1000;
              const onCooldown = elapsed < ability.cooldown;
              const cdPercent = onCooldown ? 1 - elapsed / ability.cooldown : 0;
              const isLocked = ability.unlockLevel > playerLevel;

              return (
                <button
                  key={ability.key}
                  onClick={() => useAbility(ability.key)}
                  disabled={onCooldown || isLocked}
                  className="relative group"
                  title={isLocked ? `${ability.name} — нужен ур. ${ability.unlockLevel}` : `${ability.name} (${ability.key})`}
                >
                  <div
                    className="w-16 h-16 rounded-lg flex flex-col items-center justify-center text-2xl font-bold shadow-lg transition-all border-2"
                    style={{
                      background: isLocked ? '#111827' : onCooldown ? '#1f2937' : `linear-gradient(135deg, ${ability.color}, ${ability.color}aa)`,
                      borderColor: isLocked ? '#1f2937' : onCooldown ? '#374151' : ability.color,
                      opacity: isLocked ? 0.4 : onCooldown ? 0.6 : 1,
                      boxShadow: isLocked ? 'none' : onCooldown ? 'none' : `0 0 15px ${ability.color}40`,
                    }}
                  >
                    <span>{isLocked ? '🔒' : ability.icon}</span>
                    <span className="text-[10px] text-white/80 font-mono">{ability.key}</span>
                  </div>
                  {isLocked && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-[9px] text-gray-400 font-bold">Ур.{ability.unlockLevel}</span>
                    </div>
                  )}
                  {onCooldown && !isLocked && (
                    <>
                      <div
                        className="absolute inset-0 bg-black/70 rounded-lg pointer-events-none"
                        style={{ clipPath: `polygon(0 0, 100% 0, 100% ${cdPercent * 100}%, 0 ${cdPercent * 100}%)` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-lg text-white font-bold pointer-events-none">
                        {Math.ceil(ability.cooldown - elapsed)}
                      </span>
                    </>
                  )}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-black/90 text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-gray-700">
                    {isLocked ? `🔒 Нужен ур. ${ability.unlockLevel}` : `${ability.name} • ${ability.cooldown}s`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedTarget && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-xl">👹</div>
              <div>
                <div className="font-bold text-red-400 text-sm">
                  {worldState.npcs.find(n => n.id === selectedTarget)?.templateId ?? 'Цель'}
                </div>
                <div className="text-xs text-gray-400">
                  HP: {worldState.npcs.find(n => n.id === selectedTarget)?.hp ?? 0} / {worldState.npcs.find(n => n.id === selectedTarget)?.maxHp ?? 0}
                </div>
              </div>
            </div>
            <button
              onClick={() => { setSelectedTarget(null); attackTargetRef.current = null; }}
              className="px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 text-xs hover:bg-gray-600"
            >
              ✕ Снять цель
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
