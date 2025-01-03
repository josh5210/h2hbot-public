// /src/components/chat/AutoResizeTextarea.tsx
import React, { useEffect, useRef, ChangeEvent, KeyboardEvent, useCallback } from 'react';
import { CHAT_CONSTANTS } from '@/lib/constants/chat';

interface AutoResizeTextareaProps {
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: {
    mobile: string;
    desktop: string;
  };
  disabled?: boolean;
  maxHeight?: number;
  onSubmit: () => void;
  maxLength?: number;
  currentLength?: number;
  showCharacterCount?: boolean;
}

const AutoResizeTextarea = ({
  value,
  onChange,
  placeholder = {
    mobile: "Type here (try @bot)",
    desktop: "Type your message... (Use @bot to get H2Hbot's assistance)"
  },
  disabled,
  maxHeight = 200,
  onSubmit,
  maxLength = CHAT_CONSTANTS.MESSAGE_LENGTH.MAX,
  showCharacterCount = true,
}: AutoResizeTextareaProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
  
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [maxHeight]);

  useEffect(() => {
    adjustHeight();
  }, [value, maxHeight, adjustHeight]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [adjustHeight]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (!e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    // Only allow input if we're under the maxLength
    if (e.target.value.length <= maxLength) {
      onChange(e);
    }
  };

  // Calculate remaining characters
  const remainingChars = maxLength - value.length;
  const isNearLimit = remainingChars <= CHAT_CONSTANTS.MESSAGE_LENGTH.WARNING_THRESHOLD;
  const isAtLimit = remainingChars === 0;

  return (
    <div className="relative flex-1">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        maxLength={maxLength}
        rows={1}
        className={`
          w-full rounded-md border px-3 py-2 text-gray-900 shadow-sm 
          focus:outline-none focus:ring-2 resize-none overflow-hidden
          ${isAtLimit 
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          }
        `}
        placeholder={`${window.innerWidth < 640 ? placeholder.mobile : placeholder.desktop}`}
        style={{
          minHeight: '42px',
          maxHeight: `${maxHeight}px`
        }}
      />
      
      {showCharacterCount && isNearLimit && (
        <div 
          className={`absolute bottom-1 right-2 text-xs transition-colors ${
            isAtLimit 
              ? 'text-red-500 font-medium' 
              : 'text-amber-500'
          }`}
        >
          {remainingChars} characters remaining
        </div>
      )}
    </div>
  );
};

export default AutoResizeTextarea;