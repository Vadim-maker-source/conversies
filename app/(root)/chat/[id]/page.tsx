import { getCurrentUser } from '@/app/lib/api/user'
import { notFound } from 'next/navigation'
import ChatClient from '@/components/ChatClient'
import { getChatInfo, getChatMessages } from '@/app/lib/api/chat'

interface ChatPageProps {
    params: Promise<{
      id: string
    }>
  }
  
  export default async function ChatPage({ params }: ChatPageProps) {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      notFound()
    }
  
    const { id } = await params
    const chatId = parseInt(id)
    const [messages, chatInfo] = await Promise.all([
      getChatMessages(chatId),
      getChatInfo(chatId)
    ])
  
    if (!chatInfo) {
      notFound()
    }
  
    return (
      <ChatClient 
        currentUser={currentUser}
        chatInfo={chatInfo}
      />
    )
  }