import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getChatMessages, sendMessage, markMessageAsRead, sendVoiceMessage } from '@/app/lib/api/chat'
import { Message, User, ChatWithDetails, MessageWithFiles, TemporaryMessage } from '@/app/lib/types'
import { useEffect } from 'react'

interface UseChatMessagesProps {
  chatId: number
  currentUser: User
  chatInfo?: ChatWithDetails
}

export function useChatMessages({ chatId, currentUser, chatInfo }: UseChatMessagesProps) {
  const queryClient = useQueryClient()

  const { data: messages, isLoading, error } = useQuery({
    queryKey: ['chat-messages', chatId],
    queryFn: () => getChatMessages(chatId),
    refetchInterval: 300,
    staleTime: 1000,
  })

  // Функция для отметки сообщения как прочитанного
  const markAsRead = async (messageId: number) => {
    try {
      await markMessageAsRead(messageId)
      // Обновляем состояние сообщения
      queryClient.setQueryData(['chat-messages', chatId], (old: MessageWithFiles[] = []) => {
        return old.map(msg => {
          if (msg.id === messageId && msg.userId !== currentUser.id) {
            return {
              ...msg,
              isReadByCurrentUser: true,
              readStatus: 'read',
              readCount: (msg.readCount || 0) + 1
            }
          }
          return msg
        })
      })
    } catch (error) {
      console.error('Error marking message as read:', error)
    }
  }

  // Автоматическая отметка сообщений при их появлении в viewport
  useEffect(() => {
    if (!messages) return

    const handleMessageRead = () => {
      messages.forEach(message => {
        if (message.userId !== currentUser.id && !message.isReadByCurrentUser) {
          const element = document.getElementById(`message-${message.id}`)
          if (element) {
            const rect = element.getBoundingClientRect()
            if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
              markAsRead(message.id)
            }
          }
        }
      })
    }

    handleMessageRead()

    const messagesContainer = document.getElementById('messages-container')
    if (messagesContainer) {
      messagesContainer.addEventListener('scroll', handleMessageRead)
    }

    window.addEventListener('resize', handleMessageRead)

    return () => {
      if (messagesContainer) {
        messagesContainer.removeEventListener('scroll', handleMessageRead)
      }
      window.removeEventListener('resize', handleMessageRead)
    }
  }, [messages, currentUser.id, chatId])

  const addMessage = (message: Message) => {
    queryClient.setQueryData(['chat-messages', chatId], (old: Message[] = []) => {
      return [...old, message]
    })
  }

  const updateMessageReactions = (messageId: number, reactions: Record<string, User[]>) => {
    queryClient.setQueryData(['chat-messages', chatId], (old: MessageWithFiles[] = []) => {
      return old.map(msg => 
        msg.id === messageId 
          ? { ...msg, reactions }
          : msg
      )
    })
  }

  const sendMessageOptimistic = async (
    content: string, 
    fileUrl?: string, 
    fileUrls?: string[], 
    imageUrl?: string,
    replyToId?: number
  ) => {
    const tempId = Date.now()
    
    // Определяем imageUrl для изображений
    let finalImageUrl = imageUrl || null
    if (!imageUrl && fileUrls && fileUrls.length > 0) {
      const firstFile = fileUrls[0]
      if (firstFile && firstFile.match(/\.(jpg|jpeg|png|gif|webp|avif)$/i)) {
        finalImageUrl = firstFile
      }
    } else if (!imageUrl && fileUrl && fileUrl.match(/\.(jpg|jpeg|png|gif|webp|avif)$/i)) {
      finalImageUrl = fileUrl
    }

    // Определяем, является ли это голосовым сообщением
    const isVoiceMessage = Boolean(!content && fileUrl && fileUrl.match(/\.(mp3|wav|ogg|webm)$/i))

    // Создаем временное сообщение
    const tempMessage: TemporaryMessage = {
      id: tempId,
      content: isVoiceMessage ? '' : content,
      userId: currentUser.id,
      chatId,
      messageId: replyToId || null,
      imageUrl: finalImageUrl,
      fileUrl: fileUrl || null,
      fileUrls: fileUrls || [],
      isEdited: false,
      isShared: false,
      user: currentUser,
      createdAt: new Date(),
      updatedAt: new Date(),
      botId: null,
      pollId: null,
      // Добавляем поля для прочтения
      readStatus: 'sent',
      readCount: 0,
      totalMembers: chatInfo?.members.length ? chatInfo.members.length - 1 : 0,
      isReadByCurrentUser: true,
      // Добавляем флаг голосового сообщения
      isVoiceMessage,
      reactions: {},
      readBy: []
    }

    // Оптимистичное обновление
    queryClient.setQueryData(['chat-messages', chatId], (old: MessageWithFiles[] = []) => {
      return [...old, tempMessage as MessageWithFiles]
    })

    try {
      let result
      if (isVoiceMessage) {
        // Отправляем голосовое сообщение
        result = await sendVoiceMessage(chatId, fileUrl!)
      } else {
        // Отправляем обычное сообщение
        result = await sendMessage(chatId, content, fileUrl, imageUrl, fileUrls, replyToId)
      }
      
      // Сохраняем fileUrls и добавляем данные прочтения
      queryClient.setQueryData(['chat-messages', chatId], (old: MessageWithFiles[] = []) => {
        return old.map(msg => {
          if (msg.id === tempId) {
            return { 
              ...result, 
              fileUrls: msg.fileUrls || result.fileUrls || [],
              imageUrl: msg.imageUrl || result.imageUrl,
              readStatus: 'sent',
              readCount: 0,
              totalMembers: chatInfo?.members.length ? chatInfo.members.length - 1 : 0,
              isReadByCurrentUser: true,
              isVoiceMessage: msg.isVoiceMessage || false
            } as MessageWithFiles
          }
          return msg
        })
      })
    } catch (error) {
      queryClient.setQueryData(['chat-messages', chatId], (old: MessageWithFiles[] = []) => {
        return old.filter(msg => msg.id !== tempId)
      })
      throw error
    }
  }

  // Новая функция для отправки голосового сообщения
  const sendVoiceMessageOptimistic = async (voiceFileUrl: string, replyToId?: number) => {
    const tempId = Date.now()
    
    // Создаем временное голосовое сообщение
    const tempMessage: TemporaryMessage = {
      id: tempId,
      content: '', // Пустой контент для голосовых сообщений
      userId: currentUser.id,
      chatId,
      messageId: replyToId || null,
      imageUrl: null,
      fileUrl: voiceFileUrl,
      fileUrls: [voiceFileUrl],
      isEdited: false,
      isShared: false,
      user: currentUser,
      createdAt: new Date(),
      updatedAt: new Date(),
      botId: null,
      pollId: null,
      readStatus: 'sent',
      readCount: 0,
      totalMembers: chatInfo?.members.length ? chatInfo.members.length - 1 : 0,
      isReadByCurrentUser: true,
      isVoiceMessage: true,
      reactions: {},
      readBy: []
    }

    // Оптимистичное обновление
    queryClient.setQueryData(['chat-messages', chatId], (old: MessageWithFiles[] = []) => {
      return [...old, tempMessage as MessageWithFiles]
    })

    try {
      const result = await sendVoiceMessage(chatId, voiceFileUrl)
      
      // Обновляем сообщение с данными с сервера
      queryClient.setQueryData(['chat-messages', chatId], (old: MessageWithFiles[] = []) => {
        return old.map(msg => {
          if (msg.id === tempId) {
            return {
              ...result,
              fileUrls: msg.fileUrls || result.fileUrls || [],
              readStatus: 'sent',
              readCount: 0,
              totalMembers: chatInfo?.members.length ? chatInfo.members.length - 1 : 0,
              isReadByCurrentUser: true,
              isVoiceMessage: true
            } as unknown as MessageWithFiles
          }
          return msg
        })
      })
    } catch (error) {
      queryClient.setQueryData(['chat-messages', chatId], (old: MessageWithFiles[] = []) => {
        return old.filter(msg => msg.id !== tempId)
      })
      throw error
    }
  }

  return {
    messages: messages || [],
    isLoading,
    error,
    addMessage,
    sendMessageOptimistic,
    sendVoiceMessageOptimistic,
    markAsRead,
    updateMessageReactions
  }
}