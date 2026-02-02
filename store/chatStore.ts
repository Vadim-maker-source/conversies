// store/chatStore.ts
import { create } from 'zustand'
import { getUserChats } from '@/app/lib/api/chat'
import { ChatWithDetails } from '@/app/lib/types'

type ChatState = {
  chats: ChatWithDetails[]
  loading: boolean
  unreadCounts: Record<number, number> // chatId -> количество непрочитанных
  totalUnreadCount: number // Общее количество непрочитанных сообщений
  fetchChats: () => Promise<void>
  setChats: (chats: ChatWithDetails[]) => void
  updateUnreadCount: (chatId: number, count: number) => void
  markChatAsRead: (chatId: number) => void
  incrementUnreadCount: (chatId: number) => void
  decrementUnreadCount: (chatId: number) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  loading: true,
  unreadCounts: {},
  totalUnreadCount: 0,

  fetchChats: async () => {
    set({ loading: true })
    try {
      const chats = await getUserChats()
      
      // Вычисляем общее количество непрочитанных сообщений
      const unreadCounts: Record<number, number> = {}
      let totalUnread = 0
      
      chats.forEach(chat => {
        const unread = chat.unreadCount || 0
        unreadCounts[chat.id] = unread
        totalUnread += unread
      })
      
      set({ 
        chats, 
        unreadCounts,
        totalUnreadCount: totalUnread
      })
    } catch (error) {
      console.error('Error fetching chats:', error)
    } finally {
      set({ loading: false })
    }
  },

  setChats: (chats) => {
    // При установке новых чатов пересчитываем непрочитанные
    const unreadCounts: Record<number, number> = {}
    let totalUnread = 0
    
    chats.forEach(chat => {
      const unread = chat.unreadCount || 0
      unreadCounts[chat.id] = unread
      totalUnread += unread
    })
    
    set({ 
      chats, 
      unreadCounts,
      totalUnreadCount: totalUnread
    })
  },

  updateUnreadCount: (chatId, count) => {
    set((state) => {
      const oldCount = state.unreadCounts[chatId] || 0
      const newTotal = state.totalUnreadCount - oldCount + count
      
      return {
        unreadCounts: {
          ...state.unreadCounts,
          [chatId]: count
        },
        totalUnreadCount: newTotal
      }
    })
  },

  markChatAsRead: (chatId) => {
    set((state) => {
      const oldCount = state.unreadCounts[chatId] || 0
      
      return {
        unreadCounts: {
          ...state.unreadCounts,
          [chatId]: 0
        },
        totalUnreadCount: state.totalUnreadCount - oldCount
      }
    })
  },

  incrementUnreadCount: (chatId) => {
    set((state) => {
      const currentCount = state.unreadCounts[chatId] || 0
      const newCount = currentCount + 1
      
      return {
        unreadCounts: {
          ...state.unreadCounts,
          [chatId]: newCount
        },
        totalUnreadCount: state.totalUnreadCount + 1
      }
    })
  },

  decrementUnreadCount: (chatId) => {
    set((state) => {
      const currentCount = state.unreadCounts[chatId] || 0
      if (currentCount === 0) return state
      
      const newCount = Math.max(0, currentCount - 1)
      
      return {
        unreadCounts: {
          ...state.unreadCounts,
          [chatId]: newCount
        },
        totalUnreadCount: state.totalUnreadCount - (currentCount - newCount)
      }
    })
  }
}))