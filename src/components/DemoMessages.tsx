// /src/components/DemoMessages.tsx
import React, { useState, useEffect } from 'react';
import UserAvatar from '@/components/UserAvatar';
import AIAvatar from '@/components/AIAvatar';
import { CHAT_CONSTANTS } from '@/lib/constants/chat';

interface Message {
  id: number;
  content: string;
  sender: 'User' | 'Friend' | 'H2Hbot';
  is_ai?: boolean;
}

const DemoMessages = () => {
  const messages: Message[] = [
    {
      id: 1,
      content: "Hey, I've been feeling overwhelmed lately...",
      sender: 'User'
    },
    {
      id: 2,
      content: "I hear you. Would you like to talk about what's been causing this feeling?",
      sender: 'Friend'
    },
    {
      id: 3,
      content: "@bot Can you help us have a productive conversation about stress management?",
      sender: 'User'
    },
    {
      id: 4,
      content: "I'd be happy to help facilitate this conversation. Let's start by identifying specific stressors and then work together to develop coping strategies. Remember to:\n\n1) Listen actively\n2) Share openly\n3) Focus on solutions",
      sender: 'H2Hbot',
      is_ai: true
    }
  ];

  const [visibleMessages, setVisibleMessages] = useState(0);
  const [typingMessageId, setTypingMessageId] = useState<number | null>(null);
  const [displayedContent, setDisplayedContent] = useState<Record<number, string>>({});

  // Function to animate typing for AI messages
  const animateTyping = (message: Message) => {
    if (!message.is_ai) return;
    
    let currentLength = 0;
    setTypingMessageId(message.id);
    
    const animate = () => {
      const charsToAdd = CHAT_CONSTANTS.TYPING_SPEED.CHARS_PER_FRAME;
      currentLength = Math.min(currentLength + charsToAdd, message.content.length);
  
      setDisplayedContent(prev => ({
        ...prev,
        [message.id]: message.content.slice(0, currentLength)
      }));
  
      if (currentLength < message.content.length) {
        requestAnimationFrame(animate);
      } else {
        setTypingMessageId(null);
      }
    };
  
    requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (visibleMessages < messages.length) {
      const timer = setTimeout(() => {
        const nextMessage = messages[visibleMessages];
        if (nextMessage.is_ai) {
          animateTyping(nextMessage);
        }
        setVisibleMessages(prev => prev + 1);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [visibleMessages]);

  return (
    <div className="bg-white/75 backdrop-blur-sm rounded-xl p-4 h-[670px] sm:h-[640px] md:h-[520px] flex flex-col">
      <div className="space-y-3">
        {messages.slice(0, visibleMessages).map((msg) => (
        <div
          key={msg.id}
          className={`flex flex-col ${
            msg.sender === 'User'
              ? 'items-end'
              : msg.sender === 'H2Hbot'
              ? 'items-center px-0'
              : 'items-start'
          }`}
        >
          <div className={`relative group p-4 rounded-xl shadow-sm flex-shrink-0 break-words whitespace-pre-wrap ${
            msg.sender === 'H2Hbot'
              ? 'w-full max-w-[80%] bg-gray-700 text-white'
              : msg.sender === 'User'
              ? 'max-w-[70%] bg-blue-600 text-white'
              : 'max-w-[70%] bg-gray-700 text-white'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {msg.sender === 'H2Hbot' ? (
                <AIAvatar 
                  state={typingMessageId === msg.id ? 'talking' : 'idle'}
                  mood="happy"
                  className="text-sm text-white whitespace-nowrap"
                />
              ) : (
                <UserAvatar 
                  name={msg.sender} 
                  size="sm"
                  showInitials={true}
                />
              )}
              <span className="text-sm font-medium text-white">
                {msg.sender}
              </span>
            </div>
            <p className="text-sm">
              {msg.is_ai && typingMessageId === msg.id
                ? displayedContent[msg.id] || ''
                : msg.content}
            </p>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
};

export default DemoMessages;