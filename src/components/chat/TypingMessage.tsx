// /src/components/chat/TypingMessage.tsx
import React, { useState, useEffect, useRef } from 'react';
import AIAvatar from '@/components/AIAvatar';

interface TypingMessageProps {
  content: string;
  isComplete: boolean;
  typingSpeed?: number;
}

export const TypingMessage = ({ 
  content, 
  isComplete, 
  typingSpeed = 60 // milliseconds per character
}: TypingMessageProps) => {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const contentRef = useRef(content);

  useEffect(() => {
    if (content !== contentRef.current) {
      contentRef.current = content;
      setDisplayedContent('');
      setIsTyping(true);
    }
  }, [content]);

  useEffect(() => {
    if (!isComplete || !isTyping || displayedContent === content) return;

    const timeout = setTimeout(() => {
      if (displayedContent.length < content.length) {
        setDisplayedContent(content.slice(0, displayedContent.length + 1));
      } else {
        setIsTyping(false);
      }
    }, typingSpeed);

    return () => clearTimeout(timeout);
  }, [content, displayedContent, isComplete, isTyping, typingSpeed]);

  const getAIState = () => {
    if (!isComplete) return 'thinking';
    if (isTyping) return 'talking';
    return 'idle';
  };

  return (
    <div className="flex flex-col items-center px-12">
      <AIAvatar 
        state={getAIState()}
        mood="happy"
        className="mb-2"
      />
      <div className="p-4 rounded-xl shadow-sm max-w-[80%] bg-gray-700 text-white">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-white">H2Hbot</span>
          {!isComplete && (
            <span className="text-sm text-gray-300 italic">thinking...</span>
          )}
        </div>
        <p className="text-sm whitespace-pre-wrap">
          {isComplete ? displayedContent : ''}
        </p>
        <span className="text-xs text-gray-300 mt-2 block">
          {new Date().toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};