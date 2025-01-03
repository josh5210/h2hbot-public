export interface User {
    id: number;
    email: string;
    name: string | null;
}

export interface Message {
    id: number;
    content: string;
    userId: number;
    isAi: boolean;
    createdAt: Date;
}

export interface Conversation {
    id: number;
    participants: User[];
    messages: Message[];
    createdAt: Date;
    updatedAt: Date;
}