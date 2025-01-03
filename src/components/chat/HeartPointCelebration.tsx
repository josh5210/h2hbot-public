import React, { useEffect, useMemo, useState } from 'react';

interface HeartParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  velocity: {
    x: number;
    y: number;
  };
  rotation: number;
  opacity: number;
  color: string;
}

const COLORS = [
  'rgb(244, 63, 94)',  // rose-500
  'rgb(251, 113, 133)', // rose-400
  'rgb(253, 164, 175)', // rose-300
  'rgb(249, 168, 212)', // pink-300
  'rgb(244, 114, 182)', // pink-400
  'rgb(236, 72, 153)'   // pink-500
] as const;

const PARTICLE_COUNTS = {
  small: 10,
  medium: 20,
  large: 30
} as const;

const HeartCelebration = ({ 
  show, 
  onComplete, 
  intensity = 'medium' 
}: { 
  show: boolean; 
  onComplete: () => void; 
  intensity?: 'small' | 'medium' | 'large';
}) => {
  const [particles, setParticles] = useState<HeartParticle[]>([]);

  const createParticles = useMemo(() => (count: number) => 
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: 50,
      y: 50,
      size: Math.random() * 20 + 10,
      velocity: {
        x: (Math.random() - 0.5) * 8,
        y: (Math.random() - 0.5) * 8 - 2
      },
      rotation: Math.random() * 360,
      opacity: 1,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    })), 
  []);

  useEffect(() => {
    if (!show) {
      setParticles([]);
      return;
    }

    // Create initial particles
    const newParticles = createParticles(PARTICLE_COUNTS[intensity]);
    setParticles(newParticles);

    // Animation loop
    const startTime = Date.now();
    const duration = 2000; // 2 seconds

    const animate = () => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed >= duration) {
        setParticles([]);
        onComplete();
        return;
      }

      setParticles(prev => prev.map(p => ({
        ...p,
        x: p.x + p.velocity.x,
        y: p.y + p.velocity.y - 0.1,
        velocity: {
          x: p.velocity.x * 0.98,
          y: p.velocity.y * 0.98
        },
        rotation: p.rotation + p.velocity.x * 2,
        opacity: Math.max(0, 1 - elapsed / duration)
      })));

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [show, intensity, onComplete, createParticles]);

  if (!show && particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none">
      <div className="relative w-full h-full">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              transform: `translate(-50%, -50%) rotate(${p.rotation}deg)`,
              opacity: p.opacity,
              transition: 'transform 0.05s linear'
            }}
          >
            <div 
              className="relative"
              style={{
                width: p.size,
                height: p.size,
                color: p.color
              }}
            >
              {/* SVG Heart */}
              <svg 
                viewBox="0 0 24 24" 
                fill="currentColor"
                className="w-full h-full filter drop-shadow-lg"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HeartCelebration;