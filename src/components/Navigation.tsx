// /src/components/Navigation.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, MessageSquare, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import NotificationBell from '@/components/notifications/NotificationBell'
import UserAvatar from '@/components/UserAvatar';
import Mascot from '@/components/Mascot';
import { useAuth } from '@/components/providers/AuthProvider';
import { auth } from '@/lib/api/auth';
import NavigationSkeleton from './NavigationSkeleton';

const Navigation = () => {
  const { user, status } = useAuth();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Show skeleton while loading
  if (status === 'loading') {
    return <NavigationSkeleton />;
  }

  const isActive = (path: string) => pathname === path;

  const handleSignOut = async () => {
    try {
      // Call our backend logout endpoint with special flag for Google
      const response = await fetch('/api/auth/logout?provider=google', {
        method: 'POST',
        credentials: 'include'
      });
  
      if (!response.ok) {
        throw new Error('Logout failed');
      }
  
      // Clear any local auth state
      await auth.logout();
  
      // Hard redirect to login page
      window.location.href = '/login';
    } catch (error) {
      console.error('Sign out error:', error);
      // Fallback to simple redirect if something fails
      window.location.href = '/login';
    }
  };

  return (
    <nav className={`bg-white fixed top-0 left-1/2 -translate-x-1/2 right-0 z-[99] w-screen transition-shadow duration-200
      ${isScrolled ? 'shadow-md' : 'shadow-sm'}`}>      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link href="/" className="flex items-end text-gray-900 hover:text-blue-600 transition-colors duration-200">
              <span className={`text-3xl font-play font-bold`}>H2H</span>
              <span className={`text-base font-play -translate-y-[1px]`}>.bot</span>
            </Link>
            <Mascot />
          </div>

          {/* Desktop Navigation */}
          <div className="hidden sm:flex sm:items-center sm:space-x-8">
            {status === 'authenticated' && user ? (
              <>
                <NotificationBell />
                <Link
                  href="/chat"
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    isActive('/chat')
                      ? 'text-blue-600 bg-blue-50 shadow-sm'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Chats
                </Link>
                <div className="flex items-center space-x-4">
                  {/* Profile Section */}
                  <Link 
                    href={`/profile/${user.id}`}
                    className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <UserAvatar 
                      name={user.name || 'User'} 
                      userId={parseInt(user.id)}
                      size="sm"
                      showInitials={true}
                      parentIsLink={true}
                    />
                    <span className="text-sm text-gray-700 group-hover:text-blue-600 transition-colors">
                      {user.name}
                    </span>
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    isActive('/login')
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>

          {/* Mobile Navigation Controls */}
          {status === 'authenticated' && (
            <div className="sm:hidden flex items-center gap-2">
              <NotificationBell />
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200 transform active:scale-95"
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          )}

          {/* Mobile menu button (only for non-authenticated users) */}
          {status !== 'authenticated' && (
            <div className="sm:hidden flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200 transform active:scale-95"
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="sm:hidden bg-white border-t">
          <div className="px-2 pt-2 pb-3 space-y-1 animate-slideDown">
            {status === 'authenticated' && user ? (
              <>
                <Link
                  href="/chat"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    isActive('/chat')
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-center">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Chats
                  </div>
                </Link>
                {/* Mobile Profile Section */}
                <Link
                  href={`/profile/${user.id}`}
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50"
                >
                  <div className="flex items-center gap-2">
                    <UserAvatar 
                      name={user.name || 'User'} 
                      userId={parseInt(user.id)}
                      size="sm"
                      showInitials={true}
                      parentIsLink={true}
                    />
                    <span>Profile</span>
                  </div>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50"
                >
                  <div className="flex items-center">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                  </div>
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    isActive('/login')
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="block px-3 py-2 rounded-md text-base font-medium bg-blue-600 text-white hover:bg-blue-700"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;