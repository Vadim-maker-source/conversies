import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getChatMessages, sendMessage, markMessageAsRead, sendVoiceMessage } from '@/app/lib/api/chat'
import { Message, User, ChatWithDetails, MessageWithFiles, TemporaryMessage } from '@/app/lib/types'
import { useCallback, useEffect } from 'react'
import { pusherClient } from '@/app/lib/pusher-client'

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
    refetchInterval: false, // Отключить polling
    staleTime: 60000, // 60 секунд
  })

  const markAsRead = useCallback(async (messageId: number) => {
    try {
      await markMessageAsRead(messageId)
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
  }, [chatId, currentUser.id, queryClient])

  useEffect(() => {
    const channel = pusherClient?.subscribe(`chat-${chatId}`)
    
    channel?.bind('message-sent', (data: MessageWithFiles) => {
      queryClient.setQueryData(['chat-messages', chatId], (old: MessageWithFiles[] = []) => {
        // Проверяем, нет ли уже такого сообщения
        if (old.some(msg => msg.id === data.id)) return old
        return [...old, data]
      })
    })
    
    channel?.bind('message-updated', (data: MessageWithFiles) => {
      queryClient.setQueryData(['chat-messages', chatId], (old: MessageWithFiles[] = []) => {
        return old.map(msg => msg.id === data.id ? data : msg)
      })
    })
    
    channel?.bind('message-deleted', (data: { id: number }) => {
      queryClient.setQueryData(['chat-messages', chatId], (old: MessageWithFiles[] = []) => {
        return old.filter(msg => msg.id !== data.id)
      })
    })

    return () => {
      channel?.unsubscribe()
    }
  }, [chatId, queryClient])

  useEffect(() => {
    if (!messages) return
  
    let timeoutId: NodeJS.Timeout
    
    const handleMessageRead = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
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
      }, 500) // Задержка 500ms
    }
  
    handleMessageRead()
    
    const messagesContainer = document.getElementById('messages-container')
    if (messagesContainer) {
      messagesContainer.addEventListener('scroll', handleMessageRead)
    }
  
    window.addEventListener('resize', handleMessageRead)
  
    return () => {
      clearTimeout(timeoutId)
      if (messagesContainer) {
        messagesContainer.removeEventListener('scroll', handleMessageRead)
      }
      window.removeEventListener('resize', handleMessageRead)
    }
  }, [messages, currentUser.id, chatId, markAsRead])

  const sendMessageOptimistic = async (
    content: string, 
    fileUrl?: string, 
    fileUrls?: string[], 
    imageUrl?: string,
    replyToId?: number
  ) => {
    const tempId = Date.now()
    
    // Создаем массивы для изображений и файлов
    const allFileUrls: string[] = []
    const imageUrls: string[] = []
    
    // Обрабатываем отдельные URL
    if (fileUrl) allFileUrls.push(fileUrl)
    if (fileUrls) allFileUrls.push(...fileUrls)
    
    // Определяем, является ли это стикером
    const isSticker = imageUrl?.includes('/stickers/') || false
    
    // Обрабатываем изображения
    if (imageUrl) {
      imageUrls.push(imageUrl)
      if (!allFileUrls.includes(imageUrl)) {
        allFileUrls.push(imageUrl)
      }
    }
    
    // Проверяем файлы на изображения
    allFileUrls.forEach(url => {
      if (url.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)$/i) && !imageUrls.includes(url)) {
        imageUrls.push(url)
      }
    })

    // Определяем типы сообщений
    const isVoiceMessage = Boolean(
      !content && 
      allFileUrls.length > 0 && 
      allFileUrls.some(url => url.match(/\.(mp3|wav|ogg|webm)$/i))
    )
    
    const isVideoMessage = Boolean(
      content === '🎥 Видеосообщение' && 
      allFileUrls.length > 0 && 
      allFileUrls.some(url => url.match(/\.(mp4|webm|mov)$/i))
    )

    // Создаем временное сообщение
    const tempMessage: TemporaryMessage = {
      id: tempId,
      content: isVoiceMessage ? '' : content,
      userId: currentUser.id,
      chatId,
      messageId: replyToId || null,
      // Используем только массивы
      imageUrls: isSticker ? [imageUrl!] : imageUrls,
      fileUrls: allFileUrls,
      isEdited: false,
      isShared: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: currentUser,
      botId: null,
      pollId: null,
      // Дополнительные поля
      readStatus: 'sent',
      readCount: 0,
      totalMembers: chatInfo?.members.length ? chatInfo.members.length - 1 : 0,
      isReadByCurrentUser: true,
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
        result = await sendVoiceMessage(chatId, allFileUrls[0])
      } else {
        result = await sendMessage(
          chatId, 
          content, 
          fileUrl, 
          imageUrl, 
          fileUrls, 
          replyToId
        )
      }
      
      // Преобразуем результат к MessageWithFiles
      const resultWithFiles: MessageWithFiles = {
        ...result,
        imageUrls: result.imageUrls || imageUrls,
        fileUrls: result.fileUrls || allFileUrls,
        readStatus: 'sent',
        readCount: 0,
        totalMembers: chatInfo?.members.length ? chatInfo.members.length - 1 : 0,
        isReadByCurrentUser: true,
        isVoiceMessage
      }

      queryClient.setQueryData(['chat-messages', chatId], (old: MessageWithFiles[] = []) => {
        return old.map(msg => {
          if (msg.id === tempId) {
            return resultWithFiles
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

  const sendVoiceMessageOptimistic = async (voiceFileUrl: string, replyToId?: number) => {
    const tempId = Date.now()
    
    const tempMessage: TemporaryMessage = {
      id: tempId,
      content: '',
      userId: currentUser.id,
      chatId,
      messageId: replyToId || null,
      imageUrls: [],
      fileUrls: [voiceFileUrl],
      isEdited: false,
      isShared: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: currentUser,
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

    queryClient.setQueryData(['chat-messages', chatId], (old: MessageWithFiles[] = []) => {
      return [...old, tempMessage as MessageWithFiles]
    })

    try {
      const result = await sendVoiceMessage(chatId, voiceFileUrl)
      
      const resultWithFiles: MessageWithFiles = {
        ...result,
        imageUrls: result.imageUrls || [],
        fileUrls: result.fileUrls || [voiceFileUrl],
        readStatus: 'sent',
        readCount: 0,
        totalMembers: chatInfo?.members.length ? chatInfo.members.length - 1 : 0,
        isReadByCurrentUser: true,
        isVoiceMessage: true
      }

      queryClient.setQueryData(['chat-messages', chatId], (old: MessageWithFiles[] = []) => {
        return old.map(msg => {
          if (msg.id === tempId) {
            return resultWithFiles
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

  const sendVideoMessageOptimistic = async (videoFileUrl: string, replyToId?: number) => {
    const tempId = Date.now()
    
    const tempMessage: TemporaryMessage = {
      id: tempId,
      content: '🎥 Видеосообщение',
      userId: currentUser.id,
      chatId,
      messageId: replyToId || null,
      imageUrls: [],
      fileUrls: [videoFileUrl],
      isEdited: false,
      isShared: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: currentUser,
      botId: null,
      pollId: null,
      readStatus: 'sent',
      readCount: 0,
      totalMembers: chatInfo?.members.length ? chatInfo.members.length - 1 : 0,
      isReadByCurrentUser: true,
      isVoiceMessage: false,
      reactions: {},
      readBy: []
    }

    queryClient.setQueryData(['chat-messages', chatId], (old: MessageWithFiles[] = []) => {
      return [...old, tempMessage as MessageWithFiles]
    })

    try {
      const result = await sendMessage(
        chatId, 
        '🎥 Видеосообщение', 
        videoFileUrl, 
        undefined, 
        [videoFileUrl], 
        replyToId
      )
      
      const resultWithFiles: MessageWithFiles = {
        ...result,
        imageUrls: result.imageUrls || [],
        fileUrls: result.fileUrls || [videoFileUrl],
        readStatus: 'sent',
        readCount: 0,
        totalMembers: chatInfo?.members.length ? chatInfo.members.length - 1 : 0,
        isReadByCurrentUser: true,
        isVoiceMessage: false
      }

      queryClient.setQueryData(['chat-messages', chatId], (old: MessageWithFiles[] = []) => {
        return old.map(msg => {
          if (msg.id === tempId) {
            return resultWithFiles
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
    sendMessageOptimistic,
    sendVoiceMessageOptimistic,
    sendVideoMessageOptimistic,
    markAsRead
  }
}