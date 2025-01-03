// /src/components/AIAvatar.tsx
import React, { useState, useEffect } from 'react';

type FaceMood = 'happy' | 'surprised' | 'love' | 'confused' | 'sleeping' | 'winking';
type FaceState = 'idle' | 'thinking' | 'talking';

const faces = {
  default: '[ ^ - ^ ]',
  thinking: '[ ? - ? ]',
  talking: ['[ ^ o ^ ]', '[ ^ - ^ ]'],
  happy: '[ ^ - ^ ]',
  sideEye: '[ < . < ]',
  crying: '[ T - T ]',
  surprised: '[ O - O ]',
  love: '[ ♥ - ♥ ]',
  confused: '[ @ - @ ]',
  sleeping: '[ - . - ]zzz',
  winking: '[ ^ - ~ ]',
};

interface AIAvatarProps {
    state: FaceState;
    mood?: FaceMood;
    className?: string;
  }

export default function AIAvatar({ state = 'idle', mood = 'happy', className = '' }: AIAvatarProps) {
  const [talkFrame, setTalkFrame] = useState(0);
  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (state === 'talking') {
      interval = setInterval(() => {
        setTalkFrame(prev => (prev === 0 ? 1 : 0));
      }, 500); // Adjust timing for faster/slower animation
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state]);

  const getFace = () => {
    switch (state) {
      case 'thinking':
        return faces.thinking;
      case 'talking':
        return faces.talking[talkFrame];
      default:
        return faces[mood] || faces.default;
    }
  };

  return (
    <div className={`font-mono text-lg ${className} ${
      state === 'thinking' ? 'animate-pulse' : ''
    }`}>
      {getFace()}
      {state === 'thinking' && (
        <div className="mt-2 flex justify-center gap-1">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      )}
    </div>
  );
}