// /src/components/chat/ChatListWithSearch.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { Search, X, MoreVertical } from 'lucide-react';
import Link from 'next/link';
import UserAvatar from '@/components/UserAvatar';
import { useNotifications } from '@/hooks/useNotifications';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { Chat } from '@/types/chat';

interface ChatListWithSearchProps {
  chats: Chat[];
  onChatsUpdate: (newChats: Chat[]) => void;
}

const ChatListWithSearch = ({ chats, onChatsUpdate }: ChatListWithSearchProps) => {
  const { user } = useAuth();
  const { getChatCount } = useNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  // Helper function to highlight matching text - now with proper types
  const highlightMatch = (text: string, searchTerm: string) => {
    if (!searchTerm) return text;

    const searchLower = searchTerm.toLowerCase();
    const textLower = text.toLowerCase();
    const index = textLower.indexOf(searchLower);
    
    if (index === -1) return text;

    return (
      <>
        {text.slice(0, index)}
        <strong className="font-semibold">
          {text.slice(index, index + searchTerm.length)}
        </strong>
        {text.slice(index + searchTerm.length)}
      </>
    );
  };

  // Helper function to get other participant's information
  const getOtherParticipant = useCallback((chat: Chat) => {
    const otherParticipantIndex = chat.participant_ids.findIndex(
      id => id !== Number(user?.id)
    );
    
    return {
      name: chat.participant_names[otherParticipantIndex] || 'Unknown User',
      id: chat.participant_ids[otherParticipantIndex]
    };
  }, [user?.id]);

  // Filter and sort chats based on search term
  const filteredChats = useMemo(() => {
    if (!searchTerm) return chats;
    
    const searchLower = searchTerm.toLowerCase();
    
    const matchingChats = chats.filter(chat => {
      const { name } = getOtherParticipant(chat);
      return name.toLowerCase().includes(searchLower);
    });

    return matchingChats.sort((a, b) => {
      const nameA = getOtherParticipant(a).name.toLowerCase();
      const nameB = getOtherParticipant(b).name.toLowerCase();

      const aStartsWith = nameA.startsWith(searchLower);
      const bStartsWith = nameB.startsWith(searchLower);

      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      return 0;
    });
  }, [chats, searchTerm, getOtherParticipant]);

  const formatLastUpdateTime = (timestamp: string) => {
    // Make date UTC if it's not already
    const date = timestamp.endsWith('Z') ? new Date(timestamp) : new Date(timestamp + 'Z');
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleDeleteChat = async (chatId: number) => {
    try {
      const response = await fetch(`/api/chat/${chatId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete chat');
      }

      // Update chats through the prop function to delete chat
      const newChats = chats.filter(chat => chat.id !== chatId);
      onChatsUpdate(newChats);

    } catch (error) {
      console.error('Error deleting chat:', error);
      // Optionally show an error message to the user
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Section */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search chats..."
            className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-600 text-gray-400 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Chat List */}
      <div className="space-y-4">
        {filteredChats.map(chat => {
          const { name: otherParticipantName, id: otherParticipantId } = getOtherParticipant(chat);
          const isHighlightedResult = searchTerm && 
            otherParticipantName.toLowerCase().startsWith(searchTerm.toLowerCase());
          const unreadCount = getChatCount(chat.id);

            return (
              <div
                key={chat.id}
                className={`block bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition-all ${
                  isHighlightedResult ? 'ring-2 ring-blue-200' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <Link href={`/chat/${chat.id}`} className="flex-1">
                    <div className="flex items-center gap-3">
                      <UserAvatar 
                        name={otherParticipantName} 
                        userId={otherParticipantId}
                        size="md"
                        showInitials={true}
                        parentIsLink={true}
                      />
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">
                          {searchTerm 
                            ? highlightMatch(otherParticipantName, searchTerm)
                            : otherParticipantName
                          }
                        </h3>
                        {unreadCount > 0 && (
                          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                  
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">
                      {formatLastUpdateTime(chat.latest_message_time || chat.updated_at)}
                    </span>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded-md hover:bg-gray-100 transition-colors">
                          <MoreVertical className="w-4 h-4 text-gray-600" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => {
                            setSelectedChatId(chat.id);
                            setShowDeleteConfirmation(true);
                          }}
                        >
                          Delete Chat
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })}

        {filteredChats.length === 0 && (
          <div className="text-center bg-white rounded-xl shadow-md p-8">
            {searchTerm ? (
              <>
                <p className="text-gray-600 mb-2">No chats found matching &quot;{searchTerm}&quot;</p>
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-sm text-blue-600 hover:text-blue-800 focus:outline-none"
                >
                  Clear search
                </button>
              </>
            ) : (
              <p className="text-gray-600">
                No chats available. Share your invite link to start chatting!
              </p>
            )}
          </div>
        )}
      </div>
      <ConfirmationDialog
        isOpen={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        onConfirm={() => {
          if (selectedChatId) {
            handleDeleteChat(selectedChatId);
          }
        }}
        title="Delete Chat"
        message="Are you sure you want to delete this chat? This action cannot be undone."
        confirmButtonText="Delete"
        cancelButtonText="Cancel"
      />
    </div>
  );
};

export default ChatListWithSearch;