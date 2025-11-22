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
  bot?: Bot | null;
  replyTo?: Message;
  pollId?: number | null;
  
  // Дополнительные поля для клиента
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
  isVoiceMessage?: boolean;
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

// Упрощенный тип для сообщений с файлами
export type MessageWithFiles = Message & {
fileUrls?: string[];
isVoiceMessage?: boolean;
}

// Вспомогательный тип для создания временных сообщений
export type TemporaryMessage = Omit<Message, 'id'> & {
id: number | string;
fileUrls?: string[];
isVoiceMessage?: boolean;
}