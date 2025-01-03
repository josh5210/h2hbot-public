// lib/api.ts
import { 
    Chat, 
    Message, 
    CreateChatRequest, 
    SendMessageRequest,
    GetAIInputRequest 
  } from '../types/chat';
  
  export async function createChat(data: CreateChatRequest): Promise<Chat> {
    const response = await fetch('/api/chats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create chat');
    }
    
    return response.json();
  }
  
  export async function getChats(): Promise<Chat[]> {
    const response = await fetch('/api/chats');
    
    if (!response.ok) {
      throw new Error('Failed to fetch chats');
    }
    
    return response.json();
  }
  
  export async function sendMessage(
    chatId: string,
    data: SendMessageRequest
  ): Promise<Message> {
    const response = await fetch(`/api/chats/${chatId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    
    return response.json();
  }
  
  export async function getMessages(chatId: string): Promise<Message[]> {
    const response = await fetch(`/api/chats/${chatId}/messages`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch messages');
    }
    
    return response.json();
  }
  
  export async function getAIInput(
    chatId: string,
    data: GetAIInputRequest
  ): Promise<Message> {
    const response = await fetch(`/api/chats/${chatId}/ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error('Failed to get AI input');
    }
    
    return response.json();
  }