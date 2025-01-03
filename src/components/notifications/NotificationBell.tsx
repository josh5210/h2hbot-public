// /src/components/notifications/NotificationBell.tsx
import { useState } from 'react';
import { Bell, Check, CheckSquare } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '@/hooks/useNotifications';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { 
    notifications, 
    totalCount, 
    deleteNotification,
    deleteAllNotifications 
  } = useNotifications();

  const handleDelete = async (notificationId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await deleteNotification(notificationId);
  };

  const handleClearAll = async () => {
    await deleteAllNotifications();
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button className="relative p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transform active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <Bell className="w-6 h-6 text-gray-600" />
          {totalCount > 0 && (
            <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
              {totalCount > 99 ? '99+' : totalCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-80"
        sideOffset={5}
      >
        <div className="p-2 flex justify-between items-center border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <CheckSquare className="w-4 h-4" />
              Clear all
            </button>
          )}
        </div>
        
        <div className="max-h-[calc(100vh-100px)] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No notifications</div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className="relative group"
              >
                <a
                  href={notification.link || '#'}
                  className="block px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-8">
                      <p className="text-sm font-medium text-gray-900">
                        {notification.title}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {notification.content}
                      </p>
                      <span className="text-xs text-gray-500 mt-1 block">
                        {formatDistanceToNow(notification.createdAt, { 
                          addSuffix: true 
                        })}
                      </span>
                    </div>
                  </div>
                </a>
                <button
                  onClick={(e) => handleDelete(notification.id, e)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 transition-opacity text-blue-600 hover:text-blue-800"
                  title="Delete notification"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}