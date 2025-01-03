// /src/components/ChatAvatarGroup.tsx
import React from 'react';
import UserAvatar from '@/components/UserAvatar';

interface BotAvatarProps {
  size?: 'sm' | 'md' | 'lg';
}

const BotUserAvatar: React.FC<BotAvatarProps> = ({ size = 'md' }) => {
  const getRandomColor = () => {
    const colors = [
      'bg-pink-500',
      'bg-purple-500',
      'bg-indigo-500',
      'bg-blue-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-teal-500'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-16 h-16 text-2xl'
  };

  return (
    <div
      className={`relative ${sizeClasses[size]} rounded-full overflow-hidden transform hover:scale-110 transition-transform duration-300`}
    >
      <div className={`absolute inset-0 ${getRandomColor()} flex items-center justify-center text-white font-bold`}>
        {'<3'}
      </div>
    </div>
  );
};

interface ChatAvatarGroupProps {
  participant1Name: string;
  participant2Name: string;
}

const ChatAvatarGroup: React.FC<ChatAvatarGroupProps> = ({
  participant1Name,
  participant2Name,
}) => {
  return (
    <div className="absolute -top-6 left-8 flex items-center">
      <div className="relative flex items-center gap-2">
        <div className="z-30">
          <UserAvatar 
            name={participant1Name}
            size="md"
            showInitials={true}
          />
        </div>
        <div className="z-20">
          <BotUserAvatar size="md" />
        </div>
        <div className="z-10">
          <UserAvatar 
            name={participant2Name}
            size="md"
            showInitials={true}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatAvatarGroup;