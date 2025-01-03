// /src/app/dance/page.tsx
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

const DancePage = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Simple synthesizer setup
  const playNote = (frequency: number, duration: number, time: number, audioContext: AudioContext) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, time);
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + duration);
    
    oscillator.start(time);
    oscillator.stop(time + duration);
  };

  const playMelody = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    
    const now = audioContextRef.current.currentTime;
    
    // Simple happy melody
    const notes = [
      { freq: 392, time: 0 },    // G4
      { freq: 440, time: 0.2 },  // A4
      { freq: 494, time: 0.4 },  // B4
      { freq: 440, time: 0.6 },  // A4
      { freq: 392, time: 0.8 },  // G4
      { freq: 440, time: 1.0 },  // A4
      { freq: 494, time: 1.2 },  // B4
      { freq: 440, time: 1.4 }   // A4
    ];

    notes.forEach(note => {
      playNote(note.freq, 0.2, now + note.time, audioContextRef.current!);
    });

    // Loop the melody
    timeoutRef.current = setTimeout(() => {
      if (isPlaying) playMelody();
    }, 1600);
  }, [isPlaying]);

  const stopMusic = useCallback(() => {
    // Clear the timeout to stop scheduling new notes
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Close and remove the audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const toggleMusic = () => {
    if (isPlaying) {
      stopMusic();
    }
    setIsPlaying(!isPlaying);
  };

  // Start playing when isPlaying becomes true
  useEffect(() => {
    if (isPlaying) {
      playMelody();
    } else {
      stopMusic();
    }

    // Cleanup on component unmount or when isPlaying changes
    return () => {
      stopMusic();
    };
  }, [isPlaying, playMelody, stopMusic]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopMusic();
    };
  }, [stopMusic]);
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-100 to-purple-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 space-y-8">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" className="w-full h-64">
          <defs>
            <radialGradient id="glow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
              <stop offset="0%" style={{stopColor: 'rgb(255,220,255)', stopOpacity: 0.3}}/>
              <stop offset="100%" style={{stopColor: 'rgb(255,255,255)', stopOpacity: 0}}/>
            </radialGradient>
          </defs>
          
          <circle cx="100" cy="50" r="40" fill="url(#glow)">
            <animate attributeName="r" values="35;40;35" dur="2s" repeatCount="indefinite"/>
          </circle>

          <g fill="gold">
            <circle cx="70" cy="30" r="2">
              <animate attributeName="cy" values="30;25;30" dur="1s" repeatCount="indefinite"/>
            </circle>
            <circle cx="130" cy="30" r="2">
              <animate attributeName="cy" values="30;25;30" dur="1s" repeatCount="indefinite"/>
            </circle>
          </g>

          <g transform="translate(100 50)">
            <animateTransform
              attributeName="transform"
              type="translate"
              values="100,50; 100,45; 100,50"
              dur="0.5s"
              repeatCount="indefinite"/>
            
            <text x="-40" y="7" fontFamily="monospace" fontSize="24" fill="#333">
              [
              <animate attributeName="fill" values="#333;#666;#333" dur="2s" repeatCount="indefinite"/>
            </text>
            
            <text x="-25" y="7" fontFamily="monospace" fontSize="24" fill="#333">
              ^
              <animate attributeName="y" values="7;5;7" dur="0.5s" repeatCount="indefinite"/>
            </text>
            
            <text x="-10" y="7" fontFamily="monospace" fontSize="24" fill="#333">
              -
            </text>
            
            <text x="5" y="7" fontFamily="monospace" fontSize="24" fill="#333">
              ^
              <animate attributeName="y" values="7;5;7" dur="0.5s" repeatCount="indefinite"/>
            </text>
            
            <text x="20" y="7" fontFamily="monospace" fontSize="24" fill="#333">
              ]
              <animate attributeName="fill" values="#333;#666;#333" dur="2s" repeatCount="indefinite"/>
            </text>
          </g>

          <g fill="pink" opacity="0.6">
            <text x="60" y="70" fontSize="12">♥
              <animate attributeName="y" values="70;40;10" dur="3s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.6;0;0.6" dur="3s" repeatCount="indefinite"/>
            </text>
            <text x="140" y="60" fontSize="12">♥
              <animate attributeName="y" values="60;30;0" dur="2.5s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.6;0;0.6" dur="2.5s" repeatCount="indefinite"/>
            </text>
          </g>
        </svg>

        <div className="flex justify-center">
          <button
            onClick={toggleMusic}
            className={`
              px-6 py-3 rounded-full font-medium text-white shadow-lg
              transform transition-all duration-200
              ${isPlaying 
                ? 'bg-pink-500 hover:bg-pink-600 scale-95' 
                : 'bg-purple-500 hover:bg-purple-600 scale-100'
              }
              hover:scale-105 active:scale-95
            `}
          >
            {isPlaying ? 'Stop Music' : 'Play Music'}
          </button>
        </div>

        <p className="text-center text-gray-500 text-sm">
          You found the secret dance party! 🎉
        </p>
      </div>
    </div>
  );
};

export default DancePage;