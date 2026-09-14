import { useRef, useEffect, useState, useCallback } from 'react';

interface Props {
  onMove: (dx: number, dy: number) => void;
  size?: number;
}

/**
 * Mobile Legends style virtual joystick
 * - Left side of screen
 * - Drag to move character
 * - Continuous movement while held
 */
export function VirtualJoystick({ onMove, size = 140 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const lastMoveRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number>();
  const pointerIdRef = useRef<number | null>(null);

  const updatePosition = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = size / 2 - 25;

    const clampedDistance = Math.min(distance, maxDistance);
    const angle = Math.atan2(dy, dx);

    const newX = Math.cos(angle) * clampedDistance;
    const newY = Math.sin(angle) * clampedDistance;

    setPosition({ x: newX, y: newY });
    lastMoveRef.current = {
      x: newX / maxDistance,
      y: newY / maxDistance,
    };
  }, [size]);

  // Pointer events (unified touch + mouse)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handlePointerDown = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      container.setPointerCapture(e.pointerId);
      pointerIdRef.current = e.pointerId;
      setActive(true);
      updatePosition(e.clientX, e.clientY);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (pointerIdRef.current !== e.pointerId) return;
      e.preventDefault();
      updatePosition(e.clientX, e.clientY);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (pointerIdRef.current !== e.pointerId) return;
      pointerIdRef.current = null;
      setActive(false);
      setPosition({ x: 0, y: 0 });
      lastMoveRef.current = { x: 0, y: 0 };
    };

    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerup', handlePointerUp);
    container.addEventListener('pointercancel', handlePointerUp);

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [updatePosition]);

  // Continuous movement loop
  useEffect(() => {
    const loop = () => {
      if (active && (lastMoveRef.current.x !== 0 || lastMoveRef.current.y !== 0)) {
        onMove(lastMoveRef.current.x, lastMoveRef.current.y);
      }
      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [active, onMove]);

  const intensity = Math.sqrt(position.x * position.x + position.y * position.y) / (size / 2 - 25);

  return (
    <div
      ref={containerRef}
      className="relative rounded-full select-none touch-none"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, rgba(16, 185, 129, ${0.1 + intensity * 0.15}) 0%, rgba(15, 23, 42, 0.6) 70%)`,
        border: `2px solid rgba(16, 185, 129, ${0.3 + intensity * 0.4})`,
        boxShadow: active ? '0 0 20px rgba(16, 185, 129, 0.3)' : 'none',
      }}
    >
      {/* Crosshair lines */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-2 right-2 h-px bg-gray-600/30" />
        <div className="absolute left-1/2 top-2 bottom-2 w-px bg-gray-600/30" />
      </div>

      {/* Outer ring */}
      <div
        className="absolute rounded-full border-2 border-emerald-500/20 pointer-events-none"
        style={{
          inset: 10,
          transform: active ? 'scale(1.05)' : 'scale(1)',
          transition: 'transform 0.1s',
        }}
      />

      {/* Thumb */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 56,
          height: 56,
          left: `calc(50% - 28px + ${position.x}px)`,
          top: `calc(50% - 28px + ${position.y}px)`,
          background: 'radial-gradient(circle at 30% 30%, #34d399, #059669)',
          boxShadow: `0 0 ${10 + intensity * 15}px rgba(16, 185, 129, ${0.4 + intensity * 0.4})`,
          transition: active ? 'none' : 'all 0.15s ease-out',
        }}
      >
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-white/20 to-transparent" />
      </div>
    </div>
  );
}
