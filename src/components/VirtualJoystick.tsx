import { useRef, useEffect, useState, useCallback } from 'react';

interface Props {
  onMove: (dx: number, dy: number) => void;
  size?: number;
}

export function VirtualJoystick({ onMove, size = 120 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const animationRef = useRef<number>();
  const lastMoveRef = useRef({ x: 0, y: 0 });

  const handleStart = useCallback((clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = size / 2 - 20;
    
    const clampedDistance = Math.min(distance, maxDistance);
    const angle = Math.atan2(dy, dx);
    
    const newX = Math.cos(angle) * clampedDistance;
    const newY = Math.sin(angle) * clampedDistance;
    
    setPosition({ x: newX, y: newY });
    setActive(true);
    lastMoveRef.current = { x: newX / maxDistance, y: newY / maxDistance };
  }, [size]);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!active) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = size / 2 - 20;
    
    const clampedDistance = Math.min(distance, maxDistance);
    const angle = Math.atan2(dy, dx);
    
    const newX = Math.cos(angle) * clampedDistance;
    const newY = Math.sin(angle) * clampedDistance;
    
    setPosition({ x: newX, y: newY });
    lastMoveRef.current = { x: newX / maxDistance, y: newY / maxDistance };
  }, [active, size]);

  const handleEnd = useCallback(() => {
    setActive(false);
    setPosition({ x: 0, y: 0 });
    lastMoveRef.current = { x: 0, y: 0 };
  }, []);

  // Touch events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (touch) handleStart(touch.clientX, touch.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (touch) handleMove(touch.clientX, touch.clientY);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      handleEnd();
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleStart, handleMove, handleEnd]);

  // Mouse events (for testing on desktop)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isMouseDown = false;

    const handleMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      handleStart(e.clientX, e.clientY);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      handleMove(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      isMouseDown = false;
      handleEnd();
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleStart, handleMove, handleEnd]);

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
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [active, onMove]);

  return (
    <div
      ref={containerRef}
      className="relative rounded-full bg-gray-800/50 border-2 border-gray-600/50 backdrop-blur-sm touch-none select-none"
      style={{ width: size, height: size }}
    >
      {/* Base circle */}
      <div className="absolute inset-4 rounded-full border-2 border-gray-600/30" />
      
      {/* Thumb */}
      <div
        className="absolute rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-lg shadow-emerald-500/50 transition-transform"
        style={{
          width: 50,
          height: 50,
          left: `calc(50% - 25px + ${position.x}px)`,
          top: `calc(50% - 25px + ${position.y}px)`,
          transform: active ? 'scale(1.1)' : 'scale(1)',
        }}
      />
      
      {/* Direction indicators */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 text-gray-500 text-xs">▲</div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-gray-500 text-xs">▼</div>
      <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">◀</div>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">▶</div>
    </div>
  );
}
