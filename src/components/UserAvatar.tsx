// src/components/UserAvatar.tsx
import React, { useState } from 'react';
import { User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase();
};

const getRandomColor = (name: string) => {
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
  // Use name to generate consistent color
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
};

interface UserAvatarProps {
  name: string;
  userId?: number;
  size?: 'sm' | 'md' | 'lg';
  showInitials?: boolean;
  disableLink?: boolean;
  className?: string;
  parentIsLink?: boolean; // To handle nested link cases
}

const UserAvatar = ({ 
  name, 
  userId, 
  size = 'md', 
  showInitials = true,
  disableLink = false,
  className = '',
  parentIsLink = false
}: UserAvatarProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-16 h-16 text-2xl'
  };

  const initials = getInitials(name);
  const bgColor = getRandomColor(name);

  const handleClick = (e: React.MouseEvent) => {
    if (userId && !disableLink) {
      e.preventDefault(); // Prevent parent link navigation
      e.stopPropagation(); // Stop event bubbling
      router.push(`/profile/${userId}`);
    }
  };
  
  const AvatarContent = (
    <div
      className={`relative ${sizeClasses[size]} rounded-full overflow-hidden transform transition-transform duration-300 ease-in-out hover:scale-110 ${className} ${
        !disableLink && userId ? 'cursor-pointer' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={parentIsLink ? handleClick : undefined}
    >
      <div
        className={`absolute inset-0 ${bgColor} flex items-center justify-center text-white font-bold transition-opacity duration-300 ${
          isHovered ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {showInitials ? initials : <User className="w-1/2 h-1/2" />}
      </div>
      
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="relative w-full h-full">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-500">
            <div className="absolute inset-0 animate-wave">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-400 to-blue-500 opacity-60" />
            </div>
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center text-white">
            {showInitials ? initials : <User className="w-1/2 h-1/2" />}
          </div>
        </div>
      </div>
    </div>
  );

  // If we're inside a parent link, just return the content with click handler
  if (parentIsLink) {
    return AvatarContent;
  }

  // If no userId or disableLink is true
  if (!userId || disableLink) {
    return AvatarContent;
  }

  // Otherwise, wrap in a link
  return (
    <Link 
      href={`/profile/${userId}`}
      className="hover:opacity-80 transition-opacity"
    >
      {AvatarContent}
    </Link>
  );
};

export default UserAvatar;