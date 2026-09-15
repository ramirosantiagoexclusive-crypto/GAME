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
  const [playerStamina, setPlayerStamina] = useState(100); // 0-100, влияет на бег
  const [isRunning, setIsRunning] = useState(false);
  
  // Статичные декорации (генерируются один раз)
  const decorationsRef = useRef<Array<{
    x: number;
    y: number;
    type: 'tree' | 'rock' | 'bush' | 'flower';
    variant: number;
  }>>([]);
  

  

  
  // Генерируем декорации один раз при монтировании
  useEffect(() => {
    if (decorationsRef.current.length === 0) {
      const decorations: Array<{
        x: number;
        y: number;
        type: 'tree' | 'rock' | 'bush' | 'flower';
        variant: number;
      }> = [];
      // Генерируем 100 декораций в мире
      for (let i = 0; i < 100; i++) {
        const seed = i * 137 + 42;
        const x = ((seed * 73) % 2000) - 1000;
        const y = ((seed * 173) % 2000) - 1000;
        const type = seed % 4 === 0 ? 'tree' : seed % 4 === 1 ? 'rock' : seed % 4 === 2 ? 'bush' : 'flower';
        decorations.push({ x, y, type, variant: seed % 3 });
      }
      decorationsRef.current = decorations;
    }
  }, []);

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
        
        // Determine NPC type for behavior
        const isRanged = npc.templateId.includes('Skeleton') || npc.templateId.includes('Lich');
        const isBoss = npc.templateId.includes('Chief') || npc.templateId.includes('Warlord') || 
                       npc.templateId.includes('King') || npc.templateId.includes('Alpha') || 
                       npc.templateId.includes('Lich');
        
        // Aggression range based on type
        const aggroRange = isBoss ? 200 : 150;
        const attackRange = isRanged ? 120 : 40;
        
        // Aggression if player is nearby
        if (dist < aggroRange && dist > attackRange) {
          // Move towards player
          const speed = isBoss ? 2.0 : 1.5;
          npc.x += (dx / dist) * speed;
          npc.y += (dy / dist) * speed;
        } else if (dist <= attackRange) {
          // Attack if in range
          const attackCooldown = isBoss ? 1000 : 1500;
          if (now - ai.lastAttack > attackCooldown) {
            ai.lastAttack = now;
            
            // Visual attack effect
            const effectType = isRanged ? 'projectile' : 'slash';
            const effectColor = isBoss ? '#fbbf24' : '#ef4444';
            
            const effect: AttackEffect = {
              id: Math.random().toString(),
              fromX: npc.x,
              fromY: npc.y,
              toX: char.x,
              toY: char.y,
              startTime: now,
              duration: isRanged ? 500 : 300,
              type: effectType,
              color: effectColor,
            };
            setAttackEffects(prev => [...prev, effect]);
            setTimeout(() => {
              setAttackEffects(prev => prev.filter(e => e.id !== effect.id));
            }, isRanged ? 600 : 400);
          }
        } else {
          // Patrol
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
              const patrolSpeed = isBoss ? 1.2 : 0.8;
              npc.x += (pdx / pdist) * patrolSpeed;
              npc.y += (pdy / pdist) * patrolSpeed;
            }
          }
        }
      });

      // ============ PLAYER MOVEMENT LOGIC ============

      let moved = false;
      let kx = 0, ky = 0;

      // Check if running (Shift key)
      const isRunningNow = keysRef.current.has('shift');
      setIsRunning(isRunningNow);

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

        // Apply speed modifier based on running and stamina
        let currentSpeed = moveSpeed;
        if (isRunningNow && playerStamina > 0) {
          currentSpeed = moveSpeed * 1.8; // Running is 80% faster
          setPlayerStamina(prev => Math.max(0, prev - 0.5)); // Drain stamina
        } else if (isRunningNow && playerStamina <= 0) {
          currentSpeed = moveSpeed * 0.7; // Slow when exhausted
        }

        localPosRef.current.x += kx * currentSpeed;
        localPosRef.current.y += ky * currentSpeed;
        localPosRef.current.x = Math.max(-500, Math.min(500, localPosRef.current.x));
        localPosRef.current.y = Math.max(-500, Math.min(500, localPosRef.current.y));
        moved = true;
      } else {
        // Regenerate stamina when not moving
        setPlayerStamina(prev => Math.min(100, prev + 0.2));
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

      // Static decorations (don't move with camera)
      decorationsRef.current.forEach(decor => {
        const dx = offsetX + decor.x;
        const dy = offsetY + decor.y;
        
        // Check visibility
        if (dx < -50 || dx > width + 50 || dy < -50 || dy > height + 50) return;
        
        if (decor.type === 'tree') {
          // Tree shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.beginPath();
          ctx.ellipse(dx + 5, dy + 20, 15, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          
          // Trunk
          ctx.fillStyle = '#4a2c17';
          ctx.fillRect(dx - 4, dy, 8, 20);
          ctx.strokeStyle = '#2d1810';
          ctx.lineWidth = 1;
          ctx.strokeRect(dx - 4, dy, 8, 20);
          
          // Crown (multiple circles for volume)
          const treeColors = ['#1e3a1e', '#166534', '#15803d'];
          ctx.fillStyle = treeColors[decor.variant];
          ctx.beginPath();
          ctx.arc(dx, dy - 10, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(dx - 8, dy - 5, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(dx + 8, dy - 5, 12, 0, Math.PI * 2);
          ctx.fill();
          
          // Highlight on crown
          ctx.fillStyle = 'rgba(134, 239, 172, 0.3)';
          ctx.beginPath();
          ctx.arc(dx - 5, dy - 15, 6, 0, Math.PI * 2);
          ctx.fill();
        } else if (decor.type === 'rock') {
          // Rock shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.beginPath();
          ctx.ellipse(dx + 3, dy + 8, 12, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          
          // Rock
          const rockColors = ['#374151', '#4b5563', '#6b7280'];
          ctx.fillStyle = rockColors[decor.variant];
          ctx.beginPath();
          ctx.ellipse(dx, dy, 12, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#1f2937';
          ctx.lineWidth = 1;
          ctx.stroke();
          
          // Highlight
          ctx.fillStyle = 'rgba(209, 213, 219, 0.4)';
          ctx.beginPath();
          ctx.ellipse(dx - 3, dy - 2, 4, 2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (decor.type === 'bush') {
          // Bush shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.beginPath();
          ctx.ellipse(dx + 3, dy + 10, 10, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          
          // Bush
          const bushColors = ['#166534', '#15803d', '#16a34a'];
          ctx.fillStyle = bushColors[decor.variant];
          ctx.beginPath();
          ctx.arc(dx, dy, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(dx + 6, dy - 3, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(dx - 5, dy - 2, 7, 0, Math.PI * 2);
          ctx.fill();
        } else if (decor.type === 'flower') {
          // Flower
          const flowerColors = ['#ec4899', '#f472b6', '#a855f7', '#3b82f6'];
          ctx.fillStyle = flowerColors[decor.variant];
          ctx.beginPath();
          ctx.arc(dx, dy, 3, 0, Math.PI * 2);
          ctx.fill();
          
          // Petals
          for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const px = dx + Math.cos(angle) * 4;
            const py = dy + Math.sin(angle) * 4;
            ctx.beginPath();
            ctx.arc(px, py, 2, 0, Math.PI * 2);
            ctx.fill();
          }
          
          // Center
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(dx, dy, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Hub buildings and decorations
      if (char.zone === 'hub') {
        // Main building - Town Hall
        const townHallX = offsetX + 0;
        const townHallY = offsetY - 100;
        
        // Building base
        ctx.fillStyle = '#78350f';
        ctx.fillRect(townHallX - 40, townHallY - 30, 80, 60);
        
        // Roof
        ctx.fillStyle = '#991b1b';
        ctx.beginPath();
        ctx.moveTo(townHallX - 45, townHallY - 30);
        ctx.lineTo(townHallX, townHallY - 60);
        ctx.lineTo(townHallX + 45, townHallY - 30);
        ctx.closePath();
        ctx.fill();
        
        // Door
        ctx.fillStyle = '#451a03';
        ctx.fillRect(townHallX - 8, townHallY + 10, 16, 20);
        
        // Windows
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(townHallX - 25, townHallY - 15, 12, 12);
        ctx.fillRect(townHallX + 13, townHallY - 15, 12, 12);
        
        // Sign
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('🏛️ Town Hall', townHallX, townHallY + 45);

        // Shop building
        const shopX = offsetX + 150;
        const shopY = offsetY - 50;
        
        ctx.fillStyle = '#1e40af';
        ctx.fillRect(shopX - 30, shopY - 25, 60, 50);
        
        ctx.fillStyle = '#1e3a8a';
        ctx.beginPath();
        ctx.moveTo(shopX - 35, shopY - 25);
        ctx.lineTo(shopX, shopY - 50);
        ctx.lineTo(shopX + 35, shopY - 25);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(shopX - 20, shopY - 10, 10, 10);
        ctx.fillRect(shopX + 10, shopY - 10, 10, 10);
        
        ctx.fillStyle = '#451a03';
        ctx.fillRect(shopX - 6, shopY + 10, 12, 15);
        
        ctx.fillStyle = '#60a5fa';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('🛒 Shop', shopX, shopY + 40);

        // Blacksmith
        const smithX = offsetX - 150;
        const smithY = offsetY - 50;
        
        ctx.fillStyle = '#374151';
        ctx.fillRect(smithX - 35, smithY - 25, 70, 50);
        
        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.moveTo(smithX - 40, smithY - 25);
        ctx.lineTo(smithX, smithY - 55);
        ctx.lineTo(smithX + 40, smithY - 25);
        ctx.closePath();
        ctx.fill();
        
        // Chimney with smoke
        ctx.fillStyle = '#4b5563';
        ctx.fillRect(smithX + 20, smithY - 55, 8, 20);
        
        // Smoke
        const smokeOffset = Math.sin(now / 500) * 3;
        ctx.fillStyle = 'rgba(156, 163, 175, 0.5)';
        ctx.beginPath();
        ctx.arc(smithX + 24 + smokeOffset, smithY - 60, 5, 0, Math.PI * 2);
        ctx.arc(smithX + 26 + smokeOffset, smithY - 68, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(smithX - 25, smithY - 10, 10, 10);
        ctx.fillRect(smithX + 15, smithY - 10, 10, 10);
        
        ctx.fillStyle = '#451a03';
        ctx.fillRect(smithX - 6, smithY + 10, 12, 15);
        
        ctx.fillStyle = '#9ca3af';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('⚒️ Blacksmith', smithX, smithY + 40);

        // Decorative lamps
        const lampPositions = [
          { x: 80, y: 0 },
          { x: -80, y: 0 },
          { x: 0, y: 80 },
          { x: 0, y: -80 },
        ];
        
        lampPositions.forEach(lamp => {
          const lx = offsetX + lamp.x;
          const ly = offsetY + lamp.y;
          
          // Lamp post
          ctx.fillStyle = '#4b5563';
          ctx.fillRect(lx - 1, ly - 15, 2, 15);
          
          // Lamp light
          const lampGlow = ctx.createRadialGradient(lx, ly - 18, 0, lx, ly - 18, 15);
          lampGlow.addColorStop(0, 'rgba(251, 191, 36, 0.6)');
          lampGlow.addColorStop(1, 'rgba(251, 191, 36, 0)');
          ctx.fillStyle = lampGlow;
          ctx.beginPath();
          ctx.arc(lx, ly - 18, 15, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(lx, ly - 18, 4, 0, Math.PI * 2);
          ctx.fill();
        });

        // Flowers are now part of static decorations
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

      // NPCs - detailed sprites
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
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(x, y + 18, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Determine NPC type for coloring
        const isBoss = npc.templateId.includes('Chief') || npc.templateId.includes('Warlord') || 
                       npc.templateId.includes('King') || npc.templateId.includes('Alpha') || 
                       npc.templateId.includes('Lich');
        
        const bodyColor = isBoss ? '#dc2626' : '#991b1b';
        const headColor = isBoss ? '#fbbf24' : '#f59e0b';

        // Legs
        ctx.fillStyle = '#450a0a';
        ctx.fillRect(x - 5, y + 7, 3, 10);
        ctx.fillRect(x + 2, y + 7, 3, 10);

        // Body
        const bodyGradient = ctx.createLinearGradient(x - 8, y - 4, x + 8, y + 8);
        bodyGradient.addColorStop(0, bodyColor);
        bodyGradient.addColorStop(1, '#7f1d1d');
        ctx.fillStyle = bodyGradient;
        ctx.fillRect(x - 8, y - 4, 16, 12);
        ctx.strokeStyle = '#450a0a';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 8, y - 4, 16, 12);

        // Arms
        ctx.fillStyle = bodyColor;
        ctx.fillRect(x - 11, y - 2, 3, 10);
        ctx.fillRect(x + 8, y - 2, 3, 10);

        // Head
        const headGradient = ctx.createRadialGradient(x, y - 10, 0, x, y - 10, 6);
        headGradient.addColorStop(0, headColor);
        headGradient.addColorStop(1, '#d97706');
        ctx.fillStyle = headGradient;
        ctx.beginPath();
        ctx.arc(x, y - 10, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Eyes (red for enemies)
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(x - 2, y - 11, 1.5, 0, Math.PI * 2);
        ctx.arc(x + 2, y - 11, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Boss crown
        if (isBoss) {
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.moveTo(x - 5, y - 16);
          ctx.lineTo(x - 3, y - 20);
          ctx.lineTo(x, y - 17);
          ctx.lineTo(x + 3, y - 20);
          ctx.lineTo(x + 5, y - 16);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#f59e0b';
          ctx.stroke();
        }

        // HP bar
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(x - 16, y - 26, 32, 5);
        const hpPercent = npc.hp / npc.maxHp;
        ctx.fillStyle = hpPercent > 0.5 ? '#10b981' : hpPercent > 0.25 ? '#f59e0b' : '#ef4444';
        ctx.fillRect(x - 16, y - 26, 32 * hpPercent, 5);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x - 16, y - 26, 32, 5);

        // Name and HP text
        ctx.fillStyle = isBoss ? '#fca5a5' : '#fecaca';
        ctx.font = isBoss ? 'bold 11px monospace' : '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(npc.templateId, x, y - 30);
        
        ctx.fillStyle = '#fff';
        ctx.font = '9px monospace';
        ctx.fillText(`${npc.hp}/${npc.maxHp}`, x, y + 30);
      });

      // Other players - detailed sprites
      ws.players.forEach(player => {
        const x = offsetX + player.x;
        const y = offsetY + player.y;
        if (x < -50 || x > width + 50 || y < -50 || y > height + 50) return;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(x, y + 18, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Legs
        ctx.fillStyle = '#7c3aed';
        ctx.fillRect(x - 5, y + 7, 3, 10);
        ctx.fillRect(x + 2, y + 7, 3, 10);

        // Body
        const bodyGradient = ctx.createLinearGradient(x - 8, y - 4, x + 8, y + 8);
        bodyGradient.addColorStop(0, '#8b5cf6');
        bodyGradient.addColorStop(1, '#6d28d9');
        ctx.fillStyle = bodyGradient;
        ctx.fillRect(x - 8, y - 4, 16, 12);
        ctx.strokeStyle = '#5b21b6';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 8, y - 4, 16, 12);

        // Arms
        ctx.fillStyle = '#8b5cf6';
        ctx.fillRect(x - 11, y - 2, 3, 10);
        ctx.fillRect(x + 8, y - 2, 3, 10);

        // Head
        const headGradient = ctx.createRadialGradient(x, y - 10, 0, x, y - 10, 6);
        headGradient.addColorStop(0, '#fcd34d');
        headGradient.addColorStop(1, '#fbbf24');
        ctx.fillStyle = headGradient;
        ctx.beginPath();
        ctx.arc(x, y - 10, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Eyes
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(x - 2, py - 11, 1, 0, Math.PI * 2);
        ctx.arc(x + 2, py - 11, 1, 0, Math.PI * 2);
        ctx.fill();

        // Name
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        const nameWidth = ctx.measureText(player.name).width + 8;
        ctx.fillRect(x - nameWidth / 2, y - 26, nameWidth, 12);
        ctx.fillStyle = '#c4b5fd';
        ctx.fillText(player.name, x, y - 17);
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

      // Current player - detailed sprite
      const px = width / 2;
      const py = height / 2;

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.ellipse(px, py + 20, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Legs
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(px - 6, py + 8, 4, 12);
      ctx.fillRect(px + 2, py + 8, 4, 12);

      // Body (torso)
      const bodyGradient = ctx.createLinearGradient(px - 10, py - 5, px + 10, py + 10);
      bodyGradient.addColorStop(0, '#3b82f6');
      bodyGradient.addColorStop(1, '#1e40af');
      ctx.fillStyle = bodyGradient;
      ctx.fillRect(px - 10, py - 5, 20, 15);
      
      // Body outline
      ctx.strokeStyle = '#1e3a8a';
      ctx.lineWidth = 1;
      ctx.strokeRect(px - 10, py - 5, 20, 15);

      // Arms
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(px - 14, py - 3, 4, 12);
      ctx.fillRect(px + 10, py - 3, 4, 12);

      // Head
      const headGradient = ctx.createRadialGradient(px, py - 12, 0, px, py - 12, 8);
      headGradient.addColorStop(0, '#fbbf24');
      headGradient.addColorStop(1, '#f59e0b');
      ctx.fillStyle = headGradient;
      ctx.beginPath();
      ctx.arc(px, py - 12, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Eyes
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(px - 3, py - 13, 1.5, 0, Math.PI * 2);
      ctx.arc(px + 3, py - 13, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Weapon (if equipped)
      const weapon = ws.players.find(p => p.characterId === char.id);
      // Draw sword on right side
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + 12, py);
      ctx.lineTo(px + 18, py - 10);
      ctx.stroke();
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(px + 11, py - 1, 3, 4);

      // Name plate
      ctx.font = 'bold 11px monospace';
      const nameWidth = ctx.measureText(char.name).width + 12;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(px - nameWidth / 2, py - 32, nameWidth, 14);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1;
      ctx.strokeRect(px - nameWidth / 2, py - 32, nameWidth, 14);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(char.name, px, py - 22);

      // HP bar
      const charHpPercent = char.hp / char.maxHp;
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(px - 18, py + 24, 36, 4);
      ctx.fillStyle = charHpPercent > 0.5 ? '#10b981' : charHpPercent > 0.25 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(px - 18, py + 24, 36 * charHpPercent, 4);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px - 18, py + 24, 36, 4);

      // Stamina bar (blue)
      const staminaPercent = playerStamina / 100;
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(px - 18, py + 35, 36, 3);
      ctx.fillStyle = staminaPercent > 0.5 ? '#3b82f6' : staminaPercent > 0.25 ? '#2563eb' : '#1d4ed8';
      ctx.fillRect(px - 18, py + 35, 36 * staminaPercent, 3);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(px - 18, py + 35, 36, 3);

      // Running indicator
      if (isRunning) {
        ctx.fillStyle = '#60a5fa';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('🏃 RUN', px, py + 45);
      }

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
