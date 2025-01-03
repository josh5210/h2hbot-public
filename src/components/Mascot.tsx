// /src/components/Mascot.tsx
import { useState, useEffect } from 'react';
import { useIdleTimer } from 'react-idle-timer';

const faces = {
  default: '[ ^ - ^ ]',
  happy: '[ ^ - ^ ]',
  sideEye: '[ < . < ]',
  crying: '[ T - T ]',
  surprised: '[ O - O ]!!!',
  love: '[ ♥ - ♥ ]',
  confused: '[ @ - @ ]',
  winking: '[ ^ - ~ ]',
  sleeping: '[ - . - ]',
  sleepingOpen: '[ - o - ]'
};

const zzzStates = ['zzz', 'Zzz', 'zZz', 'zzZ'];

const colors = [
  'text-blue-500',
  'text-green-500',
  'text-purple-500',
  'text-red-500',
  'text-yellow-500',
  'text-pink-500',
  'text-indigo-500',
  'text-teal-500',
];

type FaceType = keyof typeof faces;

const getRandomFace = (currentFace: FaceType): FaceType => {
  const availableFaces = Object.keys(faces).filter(face => 
    face !== currentFace && 
    face !== 'sleeping' && 
    face !== 'sleepingOpen' && 
    face !== 'default' &&
    face !== 'surprised'
  ) as FaceType[];
  
  return availableFaces[Math.floor(Math.random() * availableFaces.length)];
};

const getRandomColor = (currentColor: string): string => {
  const availableColors = colors.filter(color => color !== currentColor);
  return availableColors[Math.floor(Math.random() * availableColors.length)];
};

export default function Mascot() {
  const [currentFace, setCurrentFace] = useState<FaceType>('default');
  const [currentColor, setCurrentColor] = useState<string>('text-gray-900');
  const [isIdle, setIsIdle] = useState(false);
  const [isWakingUp, setIsWakingUp] = useState(false);
  const [isSleepingOpen, setIsSleepingOpen] = useState(false);
  const [zzzIndex, setZzzIndex] = useState(0);
  const [previousFace, setPreviousFace] = useState<FaceType>('default');
  const [previousColor, setPreviousColor] = useState('text-gray-900');
  const [clickCount, setClickCount] = useState(0);
  const [showHint, setShowHint] = useState(false);

  const onIdle = () => {
    setPreviousFace(currentFace);
    setPreviousColor(currentColor);
    setIsIdle(true);
  };

  const handleWakeUp = () => {
    setIsIdle(false);
    setIsWakingUp(true);

    // After 1 second, return to previous state
    setTimeout(() => {
      setIsWakingUp(false);
      setCurrentFace(previousFace);
      setCurrentColor(previousColor);
    }, 1000);
  };

  const onActive = () => {
    if (isIdle && !isWakingUp) {
      handleWakeUp();
    }
  };

  useIdleTimer({
    onIdle,
    onActive,
    timeout: 30000, // 30 seconds
    throttle: 500
  });

  // Handle sleeping animation (both mouth and Zzz)
  useEffect(() => {
    let mouthInterval: NodeJS.Timeout;
    let zzzInterval: NodeJS.Timeout;
    
    if (isIdle) {
      // Mouth animation
      mouthInterval = setInterval(() => {
        setIsSleepingOpen(prev => !prev);
      }, 2000);

      // Zzz animation
      zzzInterval = setInterval(() => {
        setZzzIndex(prev => (prev + 1) % zzzStates.length);
      }, 1000);
    } else {
      setZzzIndex(0);
    }

    return () => {
      if (mouthInterval) clearInterval(mouthInterval);
      if (zzzInterval) clearInterval(zzzInterval);
    };
  }, [isIdle]);

  // Handle click count and hint
  useEffect(() => {
    if (clickCount === 100) {
      setShowHint(true);
      // Hide hint after 10 seconds
      const timeout = setTimeout(() => {
        setShowHint(false);
        setClickCount(0); // Reset count
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [clickCount]);

  const handleClick = () => {
    setClickCount(prev => prev + 1);

    if (isIdle) {
      handleWakeUp();
    } else if (!isWakingUp) {
      setCurrentFace(prevFace => getRandomFace(prevFace));
      setCurrentColor(prevColor => getRandomColor(prevColor));
    }
  };

  const getFace = () => {
    if (isWakingUp) {
      return faces.surprised;
    }
    if (isIdle) {
      const sleepingFace = isSleepingOpen ? faces.sleepingOpen : faces.sleeping;
      return `${sleepingFace}${zzzStates[zzzIndex]}`;
    }
    return faces[currentFace];
  };

  return (
    <div className="relative flex flex-col items-center">
    <button 
      onClick={handleClick}
      className={`font-mono text-lg px-2 py-1 hover:bg-gray-100 rounded-md transition-all duration-500 ${
        isIdle ? 'text-gray-400' : 
        isWakingUp ? 'text-gray-900' :
        currentColor
      }`}
    >
      {getFace()}
    </button>

      {/* Secret hint */}
      {showHint && (
        <div 
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-gray-400 animate-pulse"
        >
          I want to /dance
        </div>
      )}
    </div>
  );
}