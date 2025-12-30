// store/chatStore.ts
import { create } from 'zustand'
import { getUserChats } from '@/app/lib/api/chat'
import { ChatWithDetails } from '@/app/lib/types'

type ChatState = {
  chats: ChatWithDetails[]
  loading: boolean
  fetchChats: () => Promise<void>
  setChats: (chats: ChatWithDetails[]) => void
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  loading: true,
  fetchChats: async () => {
    set({ loading: true })
    try {
      const chats = await getUserChats()
      set({ chats })
    } catch (error) {
      console.error('Error fetching chats:', error)
    } finally {
      set({ loading: false })
    }
  },
  setChats: (chats) => set({ chats }),
}))
