// /src/components/NavigationSkeleton.tsx
import React from 'react';
import { Loader2, MessageSquare } from 'lucide-react';

const NavigationSkeleton = () => {
  return (
    <nav className="bg-white fixed top-0 left-1/2 -translate-x-1/2 right-0 z-[99] w-screen shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <div className="flex items-end">
              <span className="text-3xl font-play font-bold text-gray-900">H2H</span>
              <span className="text-base font-play -translate-y-[1px] text-gray-900">.bot</span>
            </div>
            {/* Mascot placeholder */}
            <div className="ml-2 flex items-center justify-center">
              <div className="animate-pulse font-mono text-lg text-gray-400 whitespace-nowrap">
                [ ^ - ^ ]
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden sm:flex sm:items-center sm:space-x-8">
            {/* Loading indicators */}
            <div className="flex items-center gap-6">
              {/* Notification bell skeleton */}
              <div className="w-6 h-6 bg-gray-200 rounded-full animate-pulse" />
              
              {/* Chat button skeleton */}
              <div className="flex items-center px-3 py-2 rounded-md bg-gray-100 animate-pulse">
                <MessageSquare className="w-4 h-4 mr-2 text-gray-400" />
                <div className="w-12 h-4 bg-gray-200 rounded" />
              </div>

              {/* Profile section skeleton */}
              <div className="flex items-center gap-2 px-2 py-1 rounded-lg">
                <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
                <div className="w-20 h-4 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="sm:hidden flex items-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavigationSkeleton;