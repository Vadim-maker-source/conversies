'use server'

import { prisma } from '@/app/lib/prisma'
import { getCurrentUser } from '@/app/lib/api/user'
import type { Chat, ChatWithDetails, Message } from '@/app/lib/types'
import { put } from '@vercel/blob'

// Поиск пользователей для чата
export async function searchUsers(query: string) {
  if (!query.trim()) return []

  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  try {
    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { surname: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } }
            ]
          },
          { id: { not: currentUser.id } } // Исключаем текущего пользователя
        ]
      },
      select: {
        id: true,
        name: true,
        surname: true,
        bio: true,
        email: true,
        phone: true,
        avatar: true,
        isPremium: true,
        createdAt: true,
        updatedAt: true
      },
      take: 20
    })

    return users
  } catch (error) {
    console.error('Error searching users:', error)
    return []
  }
}

export async function searchAll(query: string) {
  if (!query.trim()) return { users: [], chats: [] }

  const currentUser = await getCurrentUser()
  if (!currentUser) return { users: [], chats: [] }

  try {
    // Поиск пользователей
    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { surname: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } }
            ]
          },
          { id: { not: currentUser.id } }
        ]
      },
      select: {
        id: true,
        name: true,
        surname: true,
        email: true,
        phone: true,
        avatar: true,
        isPremium: true,
        createdAt: true,
        updatedAt: true
      },
      take: 10
    })

    // Поиск публичных чатов и каналов (только те, у которых isPrivate = false)
    const publicChats = await prisma.chat.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } }
            ]
          },
          { isPrivate: false }, // Только публичные
          {
            OR: [
              // Чаты, где пользователь является участником
              {
                members: {
                  some: {
                    userId: currentUser.id
                  }
                }
              },
              // Или публичные каналы, где пользователь не участник
              {
                isChannel: true,
                members: {
                  none: {
                    userId: currentUser.id
                  }
                }
              }
            ]
          }
        ]
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true,
                email: true,
                phone: true,
                avatar: true,
                isPremium: true
              }
            }
          }
        },
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          include: {
            user: true
          }
        },
        _count: {
          select: {
            members: true,
            messages: true
          }
        }
      },
      take: 10
    })

    return {
      users,
      chats: publicChats.map(chat => ({
        ...chat,
        lastMessage: chat.messages[0] || null,
        memberCount: chat._count.members,
        messageCount: chat._count.messages,
        isUserMember: chat.members.some(member => member.userId === currentUser.id)
      }))
    }
  } catch (error) {
    console.error('Error searching all:', error)
    return { users: [], chats: [] }
  }
}

export async function createPrivateChat(otherUserId: number) {
    const currentUser = await getCurrentUser()
    if (!currentUser) throw new Error('Не авторизован')
  
    // Проверяем, существует ли уже приватный чат
    const existingChat = await prisma.chat.findFirst({
      where: {
        type: 'PRIVATE',
        members: {
          every: {
            userId: {
              in: [currentUser.id, otherUserId]
            }
          }
        }
      },
      include: {
        members: {
          include: {
            user: true
          }
        }
      }
    })
  
    if (existingChat) return existingChat
  
    // Создаем новый приватный чат
    const chat = await prisma.chat.create({
      data: {
        type: 'PRIVATE',
        members: {
          create: [
            { userId: currentUser.id, role: 'MEMBER' },
            { userId: otherUserId, role: 'MEMBER' }
          ]
        }
      },
      include: {
        members: {
          include: {
            user: true
          }
        }
      }
    })
  
    return chat
  }

// Создание группового чата
export async function createGroupChat(name: string, userIds: number[], isChannel: boolean = false, isPrivate: boolean = false) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  const allUserIds = [...userIds, currentUser.id]

  const chat = await prisma.chat.create({
    data: {
      name,
      type: 'GROUP',
      isChannel,
      isPrivate,
      members: {
        create: allUserIds.map(userId => ({
          userId,
          role: userId === currentUser.id ? 'OWNER' : 'MEMBER'
        }))
      }
    },
    include: {
      members: {
        include: {
          user: true
        }
      }
    }
  })

  return chat
}

// Получение списка чатов пользователя
export async function getUserChats(): Promise<ChatWithDetails[]> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  try {
    const chats = await prisma.chat.findMany({
      where: {
        members: {
          some: {
            userId: currentUser.id
          }
        }
      },
      include: {
        members: {
          include: {
            user: true
          }
        },
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          include: {
            user: true
          }
        },
        pinnedMessage: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true,
                avatar: true
              }
            }
          }
        },
        _count: {
          select: {
            messages: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    return chats.map(chat => ({
      ...chat,
      lastMessage: chat.messages[0] || undefined
    }))
  } catch (error) {
    console.error('Error fetching user chats:', error)
    return []
  }
}

export async function sendMessage(
  chatId: number, 
  content: string, 
  fileUrl?: string, 
  imageUrl?: string, 
  fileUrls?: string[], 
  replyToId?: number
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  try {
    const chatMember = await prisma.chatMember.findUnique({
      where: {
        userId_chatId: {
          userId: currentUser.id,
          chatId
        }
      }
    })

    if (!chatMember) throw new Error('Не участник чата')

    const chat = await prisma.chat.findUnique({
      where: { id: chatId }
    })

    if (chat?.isChannel && !['ADMIN', 'OWNER'].includes(chatMember.role)) {
      throw new Error('В этом канале могут писать только администраторы')
    }

    // Определяем, является ли это стикером
    const isSticker = imageUrl && imageUrl.includes('/stickers/')
    
    // Для файлов: определяем imageUrl и fileUrl
    let finalImageUrl = imageUrl || null
    let finalFileUrl = fileUrl || null

    // Если есть fileUrls, используем первый файл для определения типа
    if (fileUrls && fileUrls.length > 0) {
      const firstFile = fileUrls[0]
      if (firstFile.match(/\.(jpg|jpeg|png|gif|webp|avif)$/i)) {
        // Первый файл - изображение
        finalImageUrl = firstFile
        finalFileUrl = firstFile
      } else {
        // Первый файл - не изображение
        finalFileUrl = firstFile
      }
    } else if (fileUrl) {
      // Один файл
      if (fileUrl.match(/\.(jpg|jpeg|png|gif|webp|avif)$/i)) {
        finalImageUrl = fileUrl
        finalFileUrl = fileUrl
      } else {
        finalFileUrl = fileUrl
      }
    }

    const message = await prisma.message.create({
      data: {
        content,
        userId: currentUser.id,
        chatId,
        imageUrl: isSticker ? imageUrl : finalImageUrl, // Для стикеров используем imageUrl, для файлов - finalImageUrl
        fileUrl: finalFileUrl,
        messageId: replyToId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            surname: true,
            email: true
          }
        },
        replyTo: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true
              }
            }
          }
        }
      }
    })

    // Добавляем fileUrls к сообщению для клиента
    const messageWithFiles = {
      ...message,
      fileUrls: fileUrls || (fileUrl ? [fileUrl] : [])
    }

    await prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() }
    })

    return messageWithFiles
  } catch (error) {
    console.error('Error sending message:', error)
    throw error
  }
}

// Получение сообщений чата
// Получение сообщений чата
export async function getChatMessages(chatId: number, page: number = 1, limit: number = 50) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  const chatMember = await prisma.chatMember.findUnique({
    where: {
      userId_chatId: {
        userId: currentUser.id,
        chatId
      }
    }
  })

  if (!chatMember) return []

  try {
    const messages = await prisma.message.findMany({
      where: {
        chatId
      },
      include: {
        user: true,
        bot: true, // Добавляем включение данных о боте
        replyTo: {
          include: {
            user: true,
            bot: true // Добавляем для ответов
          }
        },
        Reaction: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true,
                avatar: true
              }
            }
          }
        },
        readBy: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true,
                avatar: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    })

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
          where: {
            userId: { not: currentUser.id }
          }
        }
      }
    })

    const totalMembers = chat?.members.length || 0

    const messagesWithReactions = messages.map(message => {
      const fileUrls = message.fileUrl ? [message.fileUrl] : []
      
      const reactions = message.Reaction.reduce((acc, reaction) => {
        if (!acc[reaction.emoji]) {
          acc[reaction.emoji] = []
        }
        acc[reaction.emoji].push(reaction.user)
        return acc
      }, {} as Record<string, any[]>)

      let imageUrl = message.imageUrl
      if (!imageUrl && message.fileUrl && message.fileUrl.match(/\.(jpg|jpeg|png|gif|webp|avif)$/i)) {
        imageUrl = message.fileUrl
      }

      const readBy = message.readBy || []
      const readCount = readBy.length
      const isReadByCurrentUser = readBy.some(read => read.userId === currentUser.id)
      
      const isOwnMessage = message.userId === currentUser.id
      const readStatus = isOwnMessage ? 
        (readCount > 0 ? 'read' : 'sent') : 
        (isReadByCurrentUser ? 'read' : 'unread')

      return {
        ...message,
        fileUrls,
        imageUrl,
        reactions,
        readBy,
        readCount,
        totalMembers,
        readStatus,
        isReadByCurrentUser
      }
    })

    return messagesWithReactions.reverse()
  } catch (error) {
    console.error('Error fetching messages:', error)
    return []
  }
}

export async function getChatInfo(chatId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  try {
    // Проверяем, является ли пользователь участником чата
    const chatMember = await prisma.chatMember.findUnique({
      where: {
        userId_chatId: {
          userId: currentUser.id,
          chatId
        }
      }
    })

    if (!chatMember) return null

    // Получаем информацию о чате
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true,
                email: true,
                phone: true,
                isPremium: true,
                avatar: true
              }
            }
          }
        },
        pinnedMessage: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true,
                avatar: true
              }
            }
          }
        }
      }
    })

    return chat
  } catch (error) {
    console.error('Error fetching chat info:', error)
    return null
  }
}

export async function uploadFile(formData: FormData) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    throw new Error('Не авторизован')
  }

  const file = formData.get('file') as File
  if (!file) {
    throw new Error('Файл не найден')
  }

  try {
    // Сохраняем оригинальное имя файла без шифрования
    const originalFileName = file.name
    const blob = await put(`files/${originalFileName}`, file, {
      access: 'public',
      addRandomSuffix: true
    })

    return {
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      pathname: blob.pathname,
    }
  } catch (error) {
    console.error('Upload error:', error)
    throw new Error('Ошибка загрузки файла')
  }
}

// Функция для удаления файла
export async function deleteFile(url: string) {
  try {
    // Vercel Blob автоматически управляет файлами
    // В бесплатной версии файлы хранятся 2 часа
    console.log('File scheduled for deletion:', url)
    return { success: true }
  } catch (error) {
    console.error('Delete error:', error)
    throw new Error('Ошибка удаления файла')
  }
}

export async function createChannel(name: string, userIds: number[], isPrivate: boolean = false) {
  return createGroupChat(name, userIds, true, isPrivate)
}

export async function getChatDetails(chatId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  try {
    // Проверяем, является ли пользователь участником чата
    const chatMember = await prisma.chatMember.findUnique({
      where: {
        userId_chatId: {
          userId: currentUser.id,
          chatId
        }
      }
    })

    // Получаем детальную информацию о чате
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true,
                email: true,
                avatar: true,
                isPremium: true
              }
            }
          }
        },
        messages: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1,
          include: {
            user: true
          }
        },
        pinnedMessage: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true,
                avatar: true
              }
            }
          }
        },
        _count: {
          select: {
            messages: true,
            members: true
          }
        }
      }
    })

    if (!chat) return null

    return {
      ...chat,
      lastMessage: chat.messages[0] || null,
      messageCount: chat._count.messages,
      memberCount: chat._count.members
    }
  } catch (error) {
    console.error('Error fetching chat details:', error)
    return null
  }
}

// Обновление информации о чате
export async function updateChat(chatId: number, data: { name?: string; avatar?: string }) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  try {
    // Проверяем, является ли пользователь владельцем или администратором
    const chatMember = await prisma.chatMember.findUnique({
      where: {
        userId_chatId: {
          userId: currentUser.id,
          chatId
        }
      }
    })

    if (!chatMember || !['OWNER', 'ADMIN'].includes(chatMember.role)) {
      throw new Error('Недостаточно прав для редактирования чата')
    }

    const chat = await prisma.chat.update({
      where: { id: chatId },
      data,
      include: {
        members: {
          include: {
            user: true
          }
        }
      }
    })

    return chat
  } catch (error) {
    console.error('Error updating chat:', error)
    throw error
  }
}

updateMessage

// Добавление участников в чат
export async function addUsersToChat(chatId: number, userIds: number[]) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  try {
    // Проверяем права текущего пользователя
    const currentMember = await prisma.chatMember.findUnique({
      where: {
        userId_chatId: {
          userId: currentUser.id,
          chatId
        }
      }
    })

    if (!currentMember || !['OWNER', 'ADMIN'].includes(currentMember.role)) {
      throw new Error('Недостаточно прав для добавления участников')
    }

    // Исключаем текущего пользователя из добавляемых
    const filteredUserIds = userIds.filter(id => id !== currentUser.id)

    // Исключаем уже добавленных пользователей
    const existingMembers = await prisma.chatMember.findMany({
      where: {
        chatId,
        userId: { in: filteredUserIds }
      }
    })

    const existingUserIds = existingMembers.map(member => member.userId)
    const newUserIds = filteredUserIds.filter(id => !existingUserIds.includes(id))

    if (newUserIds.length === 0) {
      throw new Error('Все выбранные пользователи уже добавлены в чат')
    }

    // Добавляем новых участников
    await prisma.chatMember.createMany({
      data: newUserIds.map(userId => ({
        userId,
        chatId,
        role: 'MEMBER'
      }))
    })

    // Обновляем время изменения чата
    await prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() }
    })

    return await getChatDetails(chatId)
  } catch (error) {
    console.error('Error adding users to chat:', error)
    throw error
  }
}

// Удаление участника из чата
export async function removeUserFromChat(chatId: number, userId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  try {
    // Проверяем права текущего пользователя
    const currentMember = await prisma.chatMember.findUnique({
      where: {
        userId_chatId: {
          userId: currentUser.id,
          chatId
        }
      }
    })

    if (!currentMember || !['OWNER', 'ADMIN'].includes(currentMember.role)) {
      throw new Error('Недостаточно прав для удаления участников')
    }

    // Не позволяем удалить владельца
    const targetMember = await prisma.chatMember.findUnique({
      where: {
        userId_chatId: {
          userId,
          chatId
        }
      }
    })

    if (targetMember?.role === 'OWNER') {
      throw new Error('Нельзя удалить владельца чата')
    }

    // Не позволяем удалить самого себя через эту функцию
    if (userId === currentUser.id) {
      throw new Error('Для выхода из чата используйте функцию leaveChat')
    }

    await prisma.chatMember.delete({
      where: {
        userId_chatId: {
          userId,
          chatId
        }
      }
    })

    // Обновляем время изменения чата
    await prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() }
    })

    return await getChatDetails(chatId)
  } catch (error) {
    console.error('Error removing user from chat:', error)
    throw error
  }
}

// Выход из чата
export async function leaveChat(chatId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  try {
    const chatMember = await prisma.chatMember.findUnique({
      where: {
        userId_chatId: {
          userId: currentUser.id,
          chatId
        }
      }
    })

    if (!chatMember) {
      throw new Error('Вы не являетесь участником этого чата')
    }

    // Проверяем, не является ли пользователь владельцем
    if (chatMember.role === 'OWNER') {
      throw new Error('Владелец не может покинуть чат. Сначала передайте права владения.')
    }

    await prisma.chatMember.delete({
      where: {
        userId_chatId: {
          userId: currentUser.id,
          chatId
        }
      }
    })

    return { success: true }
  } catch (error) {
    console.error('Error leaving chat:', error)
    throw error
  }
}

// Удаление чата
export async function deleteChat(chatId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  try {
    // Проверяем, является ли пользователь владельцем
    const chatMember = await prisma.chatMember.findUnique({
      where: {
        userId_chatId: {
          userId: currentUser.id,
          chatId
        }
      }
    })

    if (!chatMember || chatMember.role !== 'OWNER') {
      throw new Error('Только владелец может удалить чат')
    }

    await prisma.chat.delete({
      where: { id: chatId }
    })

    return { success: true }
  } catch (error) {
    console.error('Error deleting chat:', error)
    throw error
  }
}

export async function updateMessage(messageId: number, content: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  try {
    // Проверяем, является ли пользователь автором сообщения
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { user: true }
    })

    if (!message) throw new Error('Сообщение не найдено')
    if (message.userId !== currentUser.id) throw new Error('Недостаточно прав для редактирования сообщения')

    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: {
        content,
        isEdited: true
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            surname: true,
            email: true
          }
        },
        replyTo: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true
              }
            }
          }
        },
        Reaction: { // Добавляем реакции
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true,
                avatar: true
              }
            }
          }
        }
      }
    })

    // Преобразуем реакции в нужный формат
    const reactions = updatedMessage.Reaction.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = []
      }
      acc[reaction.emoji].push(reaction.user)
      return acc
    }, {} as Record<string, any[]>)

    return {
      ...updatedMessage,
      reactions
    }
  } catch (error) {
    console.error('Error updating message:', error)
    throw error
  }
}

// Удаление сообщения
export async function deleteMessage(messageId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  try {
    // Проверяем, является ли пользователь автором сообщения
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { user: true }
    })

    if (!message) throw new Error('Сообщение не найдено')
    if (message.userId !== currentUser.id) throw new Error('Недостаточно прав для удаления сообщения')

    await prisma.message.delete({
      where: { id: messageId }
    })

    return { success: true }
  } catch (error) {
    console.error('Error deleting message:', error)
    throw error
  }
}

// Пересылка сообщения
export async function forwardMessage(messageId: number, targetChatId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  try {
    // Проверяем, является ли пользователь участником целевого чата
    const targetChatMember = await prisma.chatMember.findUnique({
      where: {
        userId_chatId: {
          userId: currentUser.id,
          chatId: targetChatId
        }
      }
    })

    if (!targetChatMember) throw new Error('Вы не участник целевого чата')

    // Получаем исходное сообщение
    const originalMessage = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        user: true,
        replyTo: true,
        Reaction: { // Добавляем реакции
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true,
                avatar: true
              }
            }
          }
        }
      }
    })

    if (!originalMessage) throw new Error('Сообщение не найдено')

    // Создаем новое сообщение в целевом чате
    const forwardedMessage = await prisma.message.create({
      data: {
        content: originalMessage.content,
        userId: currentUser.id,
        chatId: targetChatId,
        imageUrl: originalMessage.imageUrl,
        fileUrl: originalMessage.fileUrl,
        originalMessageId: originalMessage.id, // Ссылка на исходное сообщение
        isShared: true
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            surname: true,
            email: true
          }
        },
        originalMessage: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true
              }
            }
          }
        },
        Reaction: { // Добавляем реакции
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true,
                avatar: true
              }
            }
          }
        }
      }
    })

    // Преобразуем реакции в нужный формат
    const reactions = forwardedMessage.Reaction.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = []
      }
      acc[reaction.emoji].push(reaction.user)
      return acc
    }, {} as Record<string, any[]>)

    // Обновляем время изменения целевого чата
    await prisma.chat.update({
      where: { id: targetChatId },
      data: { updatedAt: new Date() }
    })

    return {
      ...forwardedMessage,
      reactions
    }
  } catch (error) {
    console.error('Error forwarding message:', error)
    throw error
  }
}

// Получение сообщения по ID
export async function getMessage(messageId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        user: true,
        replyTo: {
          include: {
            user: true
          }
        },
        originalMessage: {
          include: {
            user: true
          }
        },
        Reaction: { // Добавляем реакции
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true,
                avatar: true
              }
            }
          }
        }
      }
    })

    if (!message) return null

    // Преобразуем реакции в нужный формат
    const reactions = message.Reaction.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = []
      }
      acc[reaction.emoji].push(reaction.user)
      return acc
    }, {} as Record<string, any[]>)

    return {
      ...message,
      reactions
    }
  } catch (error) {
    console.error('Error fetching message:', error)
    return null
  }
}

export async function updateChatMemberRole(chatId: number, userId: number, role: 'ADMIN' | 'MEMBER') {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  try {
    // Проверяем, является ли текущий пользователь владельцем
    const currentMember = await prisma.chatMember.findUnique({
      where: {
        userId_chatId: {
          userId: currentUser.id,
          chatId
        }
      }
    })

    if (!currentMember || currentMember.role !== 'OWNER') {
      throw new Error('Только владелец может изменять роли участников')
    }

    // Не позволяем изменять роль владельца
    const targetMember = await prisma.chatMember.findUnique({
      where: {
        userId_chatId: {
          userId,
          chatId
        }
      }
    })

    if (!targetMember) {
      throw new Error('Участник не найден')
    }

    if (targetMember.role === 'OWNER') {
      throw new Error('Нельзя изменить роль владельца')
    }

    // Обновляем роль
    const updatedMember = await prisma.chatMember.update({
      where: {
        userId_chatId: {
          userId,
          chatId
        }
      },
      data: {
        role
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            surname: true,
            email: true,
            avatar: true,
            isPremium: true
          }
        }
      }
    })

    return await getChatDetails(chatId)
  } catch (error) {
    console.error('Error updating member role:', error)
    throw error
  }
}

export async function updateChatAvatar(chatId: number, avatarUrl: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  try {
    // Проверяем права пользователя
    const chatMember = await prisma.chatMember.findUnique({
      where: {
        userId_chatId: {
          userId: currentUser.id,
          chatId
        }
      }
    })

    if (!chatMember || !['OWNER', 'ADMIN'].includes(chatMember.role)) {
      throw new Error('Недостаточно прав для изменения аватара')
    }

    const chat = await prisma.chat.update({
      where: { id: chatId },
      data: { avatar: avatarUrl },
      include: {
        members: {
          include: {
            user: true
          }
        }
      }
    })

    return chat
  } catch (error) {
    console.error('Error updating chat avatar:', error)
    throw error
  }
}

// app/lib/api/chat.ts

// Обновленная функция для загрузки аватара
export async function uploadAvatar(file: File) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    throw new Error('Не авторизован')
  }

  if (!file) {
    throw new Error('Файл не найден')
  }

  // Проверяем тип файла
  if (!file.type.startsWith('image/')) {
    throw new Error('Можно загружать только изображения')
  }

  // Проверяем размер файла (максимум 5MB)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Размер файла не должен превышать 5MB')
  }

  try {
    // Создаем уникальное имя файла
    const timestamp = Date.now()
    const fileExtension = file.name.split('.').pop()
    const fileName = `avatars/chat-avatar-${timestamp}.${fileExtension}`

    const blob = await put(fileName, file, {
      access: 'public',
    })

    return {
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      pathname: blob.pathname,
    }
  } catch (error) {
    console.error('Upload error:', error)
    throw new Error('Ошибка загрузки аватара')
  }
}

export async function addReaction(messageId: number, emoji: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  try {
    // Проверяем, существует ли сообщение
    const message = await prisma.message.findUnique({
      where: { id: messageId }
    })

    if (!message) throw new Error('Сообщение не найдено')

    // Проверяем, является ли пользователь участником чата
    const chatMember = await prisma.chatMember.findUnique({
      where: {
        userId_chatId: {
          userId: currentUser.id,
          chatId: message.chatId
        }
      }
    })

    if (!chatMember) throw new Error('Вы не участник этого чата')

    // Удаляем все существующие реакции пользователя для этого сообщения
    await prisma.reaction.deleteMany({
      where: {
        messageId,
        userId: currentUser.id
      }
    })

    // Создаем новую реакцию
    const reaction = await prisma.reaction.create({
      data: {
        messageId,
        userId: currentUser.id,
        emoji
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            surname: true,
            avatar: true
          }
        }
      }
    })

    // Получаем обновленные реакции для сообщения
    const updatedReactions = await prisma.reaction.findMany({
      where: { messageId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            surname: true,
            avatar: true
          }
        }
      }
    })

    // Группируем реакции по эмодзи
    const groupedReactions = updatedReactions.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = []
      }
      acc[reaction.emoji].push(reaction.user)
      return acc
    }, {} as Record<string, any[]>)

    return groupedReactions
  } catch (error) {
    console.error('Error adding reaction:', error)
    throw error
  }
}

// Удаление реакции
export async function removeReaction(messageId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  try {
    // Удаляем все реакции пользователя для этого сообщения
    await prisma.reaction.deleteMany({
      where: {
        messageId,
        userId: currentUser.id
      }
    })

    // Получаем обновленные реакции для сообщения
    const updatedReactions = await prisma.reaction.findMany({
      where: { messageId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            surname: true,
            avatar: true
          }
        }
      }
    })

    // Группируем реакции по эмодзи
    const groupedReactions = updatedReactions.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = []
      }
      acc[reaction.emoji].push(reaction.user)
      return acc
    }, {} as Record<string, any[]>)

    return groupedReactions
  } catch (error) {
    console.error('Error removing reaction:', error)
    throw error
  }
}

// Получаем все реакции для нескольких сообщений
export async function getMessagesReactions(messageIds: number[]) {
  try {
    const reactions = await prisma.reaction.findMany({
      where: {
        messageId: { in: messageIds }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            surname: true,
            avatar: true
          }
        }
      }
    })

    // Группируем по messageId и затем по emoji
    const groupedReactions = reactions.reduce((acc, reaction) => {
      if (!acc[reaction.messageId]) {
        acc[reaction.messageId] = {}
      }
      if (!acc[reaction.messageId][reaction.emoji]) {
        acc[reaction.messageId][reaction.emoji] = []
      }
      acc[reaction.messageId][reaction.emoji].push(reaction.user)
      return acc
    }, {} as Record<number, Record<string, any[]>>)

    return groupedReactions
  } catch (error) {
    console.error('Error fetching messages reactions:', error)
    return {}
  }
}

export async function joinChat(chatId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  try {
    // Проверяем, не является ли пользователь уже участником
    const existingMember = await prisma.chatMember.findUnique({
      where: {
        userId_chatId: {
          userId: currentUser.id,
          chatId
        }
      }
    })

    if (existingMember) {
      throw new Error('Вы уже являетесь участником этого чата')
    }

    // Проверяем, что чат публичный
    const chat = await prisma.chat.findUnique({
      where: { id: chatId }
    })

    if (!chat) {
      throw new Error('Чат не найден')
    }

    if (chat.isPrivate) {
      throw new Error('Нельзя присоединиться к приватному чату')
    }

    // Добавляем пользователя в чат
    await prisma.chatMember.create({
      data: {
        userId: currentUser.id,
        chatId,
        role: 'MEMBER'
      }
    })

    // Обновляем время изменения чата
    await prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() }
    })

    return await getChatDetails(chatId)
  } catch (error) {
    console.error('Error joining chat:', error)
    throw error
  }
}

export async function pinMessage(chatId: number, messageId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    throw new Error('Пользователь не авторизован')
  }

  // Проверяем, является ли пользователь участником чата
  const chatMember = await prisma.chatMember.findUnique({
    where: {
      userId_chatId: {
        userId: currentUser.id,
        chatId
      }
    },
    include: {
      chat: true
    }
  })

  if (!chatMember) {
    throw new Error('Вы не являетесь участником этого чата')
  }

  // Проверяем существование сообщения
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { chat: true }
  })

  if (!message) {
    throw new Error('Сообщение не найдено')
  }

  // Проверяем, что сообщение принадлежит этому чату
  if (message.chatId !== chatId) {
    throw new Error('Сообщение не принадлежит этому чату')
  }

  // Логика проверки прав для закрепления
  const canPinMessage = () => {
    // В приватных чатах все участники могут закреплять сообщения
    if (chatMember.chat.type === 'PRIVATE') {
      return true
    }
    
    // В групповых чатах и каналах - только OWNER и ADMIN
    return ['OWNER', 'ADMIN'].includes(chatMember.role)
  }

  if (!canPinMessage()) {
    throw new Error('Недостаточно прав для закрепления сообщения')
  }

  try {
    // Сначала открепляем текущее закрепленное сообщение (если есть)
    await prisma.chat.update({
      where: { id: chatId },
      data: { pinnedMessageId: null }
    })

    // Затем закрепляем новое сообщение
    const updatedChat = await prisma.chat.update({
      where: { id: chatId },
      data: { pinnedMessageId: messageId },
      include: {
        pinnedMessage: {
          include: {
            user: true
          }
        }
      }
    })

    return updatedChat.pinnedMessage
  } catch (error) {
    console.error('Error pinning message:', error)
    throw new Error('Ошибка при закреплении сообщения')
  }
}

// Открепление сообщения
export async function unpinMessage(chatId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    throw new Error('Пользователь не авторизован')
  }

  // Проверяем, является ли пользователь участником чата
  const chatMember = await prisma.chatMember.findUnique({
    where: {
      userId_chatId: {
        userId: currentUser.id,
        chatId
      }
    },
    include: {
      chat: true
    }
  })

  if (!chatMember) {
    throw new Error('Вы не являетесь участником этого чата')
  }

  // Логика проверки прав для открепления
  const canUnpinMessage = () => {
    // В приватных чатах все участники могут откреплять сообщения
    if (chatMember.chat.type === 'PRIVATE') {
      return true
    }
    
    // В групповых чатах и каналах - только OWNER и ADMIN
    return ['OWNER', 'ADMIN'].includes(chatMember.role)
  }

  if (!canUnpinMessage()) {
    throw new Error('Недостаточно прав для открепления сообщения')
  }

  try {
    const updatedChat = await prisma.chat.update({
      where: { id: chatId },
      data: { pinnedMessageId: null }
    })

    return updatedChat
  } catch (error) {
    console.error('Error unpinning message:', error)
    throw new Error('Ошибка при откреплении сообщения')
  }
}

// Получение закрепленного сообщения
export async function getPinnedMessage(chatId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  try {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        pinnedMessage: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true,
                email: true, // Добавлено
                phone: true, // Добавлено
                avatar: true,
                isPremium: true // Добавлено
              }
            },
            readBy: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    surname: true,
                    email: true, // Добавлено
                    phone: true, // Добавлено
                    avatar: true,
                    isPremium: true // Добавлено
                  }
                }
              }
            },
            Reaction: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    surname: true,
                    email: true, // Добавлено
                    phone: true, // Добавлено
                    avatar: true,
                    isPremium: true // Добавлено
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!chat?.pinnedMessage) return null

    // Получаем информацию о чате для подсчета участников
    const chatInfo = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
          where: {
            userId: { not: chat.pinnedMessage.userId }
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true,
                email: true,
                phone: true,
                avatar: true,
                isPremium: true
              }
            }
          }
        }
      }
    })

    const totalMembers = chatInfo?.members.length || 0
    const readCount = chat.pinnedMessage.readBy.length
    const isReadByCurrentUser = chat.pinnedMessage.readBy.some(read => read.userId === currentUser.id)
    const readStatus = chat.pinnedMessage.userId === currentUser.id ? 
      (readCount > 0 ? 'read' : 'sent') : 
      (isReadByCurrentUser ? 'read' : 'unread')

    // Группируем реакции
    const reactions = chat.pinnedMessage.Reaction.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = []
      }
      acc[reaction.emoji].push(reaction.user)
      return acc
    }, {} as Record<string, any[]>)

    return {
      ...chat.pinnedMessage,
      reactions,
      readCount,
      totalMembers,
      readStatus,
      isReadByCurrentUser,
      fileUrls: chat.pinnedMessage.fileUrl ? [chat.pinnedMessage.fileUrl] : []
    }
  } catch (error) {
    console.error('Error fetching pinned message:', error)
    return null
  }
}

// Отметка сообщения как прочитанного
export async function markMessageAsRead(messageId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  try {
    // Получаем сообщение и информацию о чате
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        chat: {
          include: {
            members: {
              select: {
                userId: true
              }
            }
          }
        }
      }
    })

    if (!message) throw new Error('Сообщение не найдено')

    // Проверяем, является ли пользователь участником чата
    const isMember = message.chat.members.some(member => member.userId === currentUser.id)
    if (!isMember) throw new Error('Вы не участник этого чата')

    // Не отмечаем свои сообщения как прочитанные
    if (message.userId === currentUser.id) {
      return { success: true }
    }

    // Создаем или обновляем запись о прочтении
    const messageRead = await prisma.messageRead.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId: currentUser.id
        }
      },
      create: {
        messageId,
        userId: currentUser.id
      },
      update: {
        readAt: new Date()
      }
    })

    return { success: true, messageRead }
  } catch (error) {
    console.error('Error marking message as read:', error)
    throw error
  }
}

// Отметка всех сообщений в чате как прочитанных
export async function markAllMessagesAsRead(chatId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  try {
    // Проверяем, является ли пользователь участником чата
    const chatMember = await prisma.chatMember.findUnique({
      where: {
        userId_chatId: {
          userId: currentUser.id,
          chatId
        }
      }
    })

    if (!chatMember) throw new Error('Вы не участник этого чата')

    // Находим все непрочитанные сообщения в чате (кроме своих)
    const unreadMessages = await prisma.message.findMany({
      where: {
        chatId,
        userId: { not: currentUser.id },
        readBy: {
          none: {
            userId: currentUser.id
          }
        }
      },
      select: {
        id: true
      }
    })

    // Создаем записи о прочтении для всех непрочитанных сообщений
    const readPromises = unreadMessages.map(message =>
      prisma.messageRead.create({
        data: {
          messageId: message.id,
          userId: currentUser.id
        }
      })
    )

    await Promise.all(readPromises)

    return { success: true, readCount: unreadMessages.length }
  } catch (error) {
    console.error('Error marking all messages as read:', error)
    throw error
  }
}

// Получение информации о прочтении сообщения
export async function getMessageReadInfo(messageId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return null

  try {
    // Сначала получаем сообщение без циклической зависимости
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        readBy: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true,
                email: true,
                phone: true,
                avatar: true,
                isPremium: true
              }
            }
          }
        }
      }
    })

    if (!message) return null

    // Затем отдельно получаем информацию о чате
    const chat = await prisma.chat.findUnique({
      where: { id: message.chatId },
      include: {
        members: {
          where: {
            userId: { not: message.userId } // Исключаем отправителя
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true,
                email: true,
                phone: true,
                avatar: true,
                isPremium: true
              }
            }
          }
        }
      }
    })

    const readBy = message.readBy
    const totalMembers = chat?.members.length || 0
    const readCount = readBy.length

    return {
      readBy,
      readCount,
      totalMembers,
      isReadByAll: readCount === totalMembers,
      isReadByCurrentUser: readBy.some(read => read.userId === currentUser.id)
    }
  } catch (error) {
    console.error('Error fetching message read info:', error)
    return null
  }
}

// Получение количества непрочитанных сообщений в чате
export async function getUnreadCount(chatId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return 0

  try {
    const count = await prisma.message.count({
      where: {
        chatId,
        userId: { not: currentUser.id },
        readBy: {
          none: {
            userId: currentUser.id
          }
        }
      }
    })

    return count
  } catch (error) {
    console.error('Error fetching unread count:', error)
    return 0
  }
}

export async function searchMessagesInChat(chatId: number, query: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  try {
    // Проверяем, является ли пользователь участником чата
    const chatMember = await prisma.chatMember.findUnique({
      where: {
        userId_chatId: {
          userId: currentUser.id,
          chatId
        }
      }
    })

    if (!chatMember) throw new Error('Вы не участник этого чата')

    // Ищем сообщения по содержанию
    const messages = await prisma.message.findMany({
      where: {
        chatId,
        content: {
          contains: query,
          mode: 'insensitive'
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            surname: true,
            avatar: true
          }
        },
        replyTo: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true
              }
            }
          }
        },
        Reaction: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true,
                avatar: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100 // Ограничиваем количество результатов
    })

    // Преобразуем сообщения в нужный формат
    const formattedMessages = messages.map(message => {
      const fileUrls = message.fileUrl ? [message.fileUrl] : []
      
      const reactions = message.Reaction.reduce((acc, reaction) => {
        if (!acc[reaction.emoji]) {
          acc[reaction.emoji] = []
        }
        acc[reaction.emoji].push(reaction.user)
        return acc
      }, {} as Record<string, any[]>)

      let imageUrl = message.imageUrl
      if (!imageUrl && message.fileUrl && message.fileUrl.match(/\.(jpg|jpeg|png|gif|webp|avif)$/i)) {
        imageUrl = message.fileUrl
      }

      return {
        ...message,
        fileUrls,
        imageUrl,
        reactions,
        readCount: 0,
        totalMembers: 0,
        readStatus: 'read' as const,
        isReadByCurrentUser: true
      }
    })

    return formattedMessages
  } catch (error) {
    console.error('Error searching messages:', error)
    throw error
  }
}

export async function getLinkPreview(url: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8'
      },
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const html = await response.text()
    
    // Функция для извлечения мета-тегов
    const getMetaTag = (name: string, html: string) => {
      const regex = new RegExp(`<meta[^>]*(property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i')
      const match = html.match(regex)
      return match ? match[2] : null
    }

    // Извлекаем title
    const ogTitle = getMetaTag('og:title', html)
    const twitterTitle = getMetaTag('twitter:title', html)
    const pageTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]
    const title = ogTitle || twitterTitle || pageTitle || 'Ссылка'

    // Извлекаем description
    const ogDescription = getMetaTag('og:description', html)
    const twitterDescription = getMetaTag('twitter:description', html)
    const metaDescription = getMetaTag('description', html)
    const description = ogDescription || twitterDescription || metaDescription || 'Описание недоступно'

    // Извлекаем изображение
    const ogImage = getMetaTag('og:image', html)
    const twitterImage = getMetaTag('twitter:image', html)
    const image = ogImage || twitterImage

    // Извлекаем favicon для fallback
    const faviconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["']/i)
    const favicon = faviconMatch ? new URL(faviconMatch[1], url).href : null

    return {
      url,
      title: title.trim(),
      description: description.trim().substring(0, 200) + (description.length > 200 ? '...' : ''),
      image: image ? new URL(image, url).href : favicon,
      domain: new URL(url).hostname
    }
  } catch (error) {
    console.error('Error fetching link preview:', error)
    
    // Fallback данные
    const domain = new URL(url).hostname
    return {
      url,
      title: domain,
      description: 'Не удалось загрузить предпросмотр ссылки',
      image: null,
      domain
    }
  }
}