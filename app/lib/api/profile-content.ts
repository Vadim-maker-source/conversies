// app/lib/api/profile-content.ts
'use server'

import { prisma } from '@/app/lib/prisma'
import { getCurrentUser } from '@/app/lib/api/user'

// Получение всех медиафайлов (изображения/видео) из чата с пользователем
export async function getMediaFiles(userId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  try {
    // Находим приватный чат между текущим пользователем и целевым пользователем
    const chat = await prisma.chat.findFirst({
      where: {
        type: 'PRIVATE',
        members: {
          every: {
            userId: {
              in: [currentUser.id, userId]
            }
          }
        }
      },
      select: {
        id: true
      }
    })

    if (!chat) return []

    // Получаем все сообщения с изображениями или видео
    const messages = await prisma.message.findMany({
      where: {
        chatId: chat.id,
        OR: [
          {
            // Проверяем, что массив imageUrls не пустой
            imageUrls: {
              isEmpty: false
            }
          },
          {
            // Проверяем, что массив fileUrls не пустой
            fileUrls: {
              isEmpty: false
            }
          }
        ]
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Фильтруем только медиафайлы (изображения и видео)
    const mediaFiles = messages
      .flatMap(message => {
        // Собираем все файлы из массивов
        const files:any = []
        
        // Добавляем изображения
        if (message.imageUrls && message.imageUrls.length > 0) {
          message.imageUrls.forEach(url => {
            if (url && (url.match(/\.(jpg|jpeg|png|gif|webp|avif)$/i) || url.match(/\.(mp4|webm|mov|avi|mkv)$/i))) {
              files.push({
                id: message.id,
                url,
                type: url.match(/\.(mp4|webm|mov|avi|mkv)$/i) ? 'video' : 'image',
                createdAt: message.createdAt,
                user: message.user
              })
            }
          })
        }
        
        // Добавляем файлы
        if (message.fileUrls && message.fileUrls.length > 0) {
          message.fileUrls.forEach(url => {
            if (url && (url.match(/\.(jpg|jpeg|png|gif|webp|avif)$/i) || url.match(/\.(mp4|webm|mov|avi|mkv)$/i))) {
              files.push({
                id: message.id,
                url,
                type: url.match(/\.(mp4|webm|mov|avi|mkv)$/i) ? 'video' : 'image',
                createdAt: message.createdAt,
                user: message.user
              })
            }
          })
        }
        
        return files
      })
      // Удаляем дубликаты по URL
      .filter((file, index, self) => 
        index === self.findIndex(f => f.url === file.url)
      )

    return mediaFiles
  } catch (error) {
    console.error('Error getting media files:', error)
    return []
  }
}

// Получение аудиосообщений из чата
export async function getAudioFiles(userId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  try {
    // Находим приватный чат
    const chat = await prisma.chat.findFirst({
      where: {
        type: 'PRIVATE',
        members: {
          every: {
            userId: {
              in: [currentUser.id, userId]
            }
          }
        }
      },
      select: {
        id: true
      }
    })

    if (!chat) return []

    // Получаем все сообщения с файлами
    const messages = await prisma.message.findMany({
      where: {
        chatId: chat.id,
        fileUrls: {
          isEmpty: false
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
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Фильтруем только аудиофайлы
    const audioMessages = messages.flatMap(message => {
      if (!message.fileUrls || message.fileUrls.length === 0) return []
      
      return message.fileUrls
        .filter(url => {
          const lowerUrl = url.toLowerCase()
          return lowerUrl.match(/\.(mp3|wav|ogg|webm|m4a|aac|flac)$/)
        })
        .map(url => ({
          id: message.id,
          url,
          duration: 0,
          createdAt: message.createdAt,
          user: message.user
        }))
    })

    return audioMessages
  } catch (error) {
    console.error('Error getting audio files:', error)
    return []
  }
}

// Получение документов из чата
export async function getDocumentFiles(userId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  try {
    // Находим приватный чат
    const chat = await prisma.chat.findFirst({
      where: {
        type: 'PRIVATE',
        members: {
          every: {
            userId: {
              in: [currentUser.id, userId]
            }
          }
        }
      },
      select: {
        id: true
      }
    })

    if (!chat) return []

    // Получаем все сообщения с файлами
    const messages = await prisma.message.findMany({
      where: {
        chatId: chat.id,
        fileUrls: {
          isEmpty: false
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
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Фильтруем только документы
    const documentMessages = messages.flatMap(message => {
      if (!message.fileUrls || message.fileUrls.length === 0) return []
      
      return message.fileUrls
        .filter(url => {
          const lowerUrl = url.toLowerCase()
          return lowerUrl.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf|csv|zip|rar|7z|tar|gz)$/)
        })
        .map(url => ({
          id: message.id,
          url,
          filename: url.split('/').pop() || 'Документ',
          size: 0,
          createdAt: message.createdAt,
          user: message.user
        }))
    })

    return documentMessages
  } catch (error) {
    console.error('Error getting document files:', error)
    return []
  }
}

// Получение истории звонков с пользователем
export async function getCallHistory(userId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) return []

  try {
    // Находим приватный чат
    const chat = await prisma.chat.findFirst({
      where: {
        type: 'PRIVATE',
        members: {
          every: {
            userId: {
              in: [currentUser.id, userId]
            }
          }
        }
      },
      select: {
        id: true
      }
    })

    if (!chat) return []

    // Получаем историю звонков
    const calls = await prisma.call.findMany({
      where: {
        chatId: chat.id,
        OR: [
          { initiatorId: currentUser.id },
          { initiatorId: userId }
        ]
      },
      include: {
        initiator: {
          select: {
            id: true,
            name: true,
            surname: true,
            avatar: true
          }
        },
        participants: {
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
        startTime: 'desc'
      }
    })

    return calls.map(call => ({
      id: call.id,
      type: call.type,
      status: call.status,
      duration: call.duration,
      startTime: call.startTime,
      endTime: call.endTime,
      initiator: call.initiator,
      participants: call.participants.map(p => p.user)
    }))
  } catch (error) {
    console.error('Error getting call history:', error)
    return []
  }
}