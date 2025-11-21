export type User = {
    id: number
    name: string | null
    surname: string | null
    bio?: string | null
    email: string
    phone: string | null
    avatar?: string | null
    password?: string | null
    isPremium?: boolean
    coins?: number
    createdAt?: Date
    updatedAt?: Date
  }
  
  export type SafeUser = Omit<User, 'password'> & {
    password?: never
  }
  
  export type UserCreateInput = {
    name: string
    surname: string
    email: string
    phone: string
    password: string
    isPremium?: boolean
  }
  
  export type UserUpdateInput = Partial<Omit<UserCreateInput, 'email'>> & {
    isPremium?: boolean
  }
  
  export type LoginCredentials = {
    email: string
    password: string
  }
  
  export type RegisterData = {
    name: string
    surname: string
    email: string
    phone: string
    password: string
    confirmPassword: string
  }

  export type Chat = {
    id: number
    name: string | null
    type: 'PRIVATE' | 'GROUP'
    isChannel: boolean
    avatar: string | null
    createdAt: Date
    updatedAt: Date
    members: ChatMember[]
    lastMessage?: Message
    unreadCount?: number
  }
  
  export type ChatMember = {
    id: number
    userId: number | null
    chatId: number
    role: 'MEMBER' | 'ADMIN' | 'OWNER'
    user: User
  }
  
  export interface Message {
    id: number;
    content: string;
    userId: number | null;
    botId: number | null;
    chatId: number;
    messageId: number | null;
    imageUrl: string | null;
    fileUrl: string | null;
    isEdited: boolean;
    isShared: boolean;
    createdAt: Date;
    updatedAt: Date;
    user: User;
    bot?: Bot | null
    replyTo?: Message;
    
    // Update these to match your actual data structure
    fileUrls?: string[];
    reactions?: Record<string, User[]>;
    readBy?: Array<{
      id: number;
      userId: number;
      messageId: number;
      readAt: Date;
      user: User;
    }>;
    readCount?: number;
    totalMembers?: number;
    readStatus?: 'sent' | 'read' | 'unread';
    isReadByCurrentUser?: boolean;
    originalMessage?: Message;
    originalMessageId?: number | null;
    pollId?: number | null;
  }
  
  export type ChatWithDetails = Chat & {
    members: (ChatMember & { user: User })[]
    _count?: {
      messages: number
    }
    lastMessage?: Message
  }

export interface Contact {
  id: number
  ownerId: number
  contactId: number
  name: string | null
  notes: string | null
  contact: User
  createdAt: string
  updatedAt: string
}

export interface Reaction {
  id: number
  messageId: number
  userId: number
  emoji: string
  user: User
  createdAt: string
}

export type Bot = {
  id: number
  name: string
  description?: string | null
  avatar?: string | null
  isActive: boolean
  token: string
  createdAt: Date
  updatedAt: Date
}