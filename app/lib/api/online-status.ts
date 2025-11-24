// app/lib/api/online-status.ts
'use server'

import { prisma } from '@/app/lib/prisma'
import { getCurrentUser } from '@/app/lib/api/user'

// Обновление статуса "в сети"
export async function updateOnlineStatus(isOnline: boolean) {
    try {
      const currentUser = await getCurrentUser()
      if (!currentUser) throw new Error('Не авторизован')
  
      await prisma.user.update({
        where: { id: currentUser.id },
        data: {
          isOnline: isOnline, // Используйте переданный параметр, а не всегда true
          lastSeen: new Date()
        }
      })
  
      return { success: true }
    } catch (error) {
      console.error('Error updating online status:', error)
      return { error: 'Ошибка обновления статуса' }
    }
  }

// Получение статуса пользователя
export async function getUserStatus(userId: number) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isOnline: true,
        lastSeen: true
      }
    })

    if (!user) return null

    // Обеспечиваем значения по умолчанию
    const lastSeen = user.lastSeen || new Date()
    const isOnline = user.isOnline ?? false

    return {
      isOnline,
      lastSeen,
      isRecentlyOnline: !isOnline && new Date().getTime() - lastSeen.getTime() < 5 * 60 * 1000 // 5 минут
    }
  } catch (error) {
    console.error('Error getting user status:', error)
    return null
  }
}

// Получение статусов всех участников чата
export async function getChatUsersStatus(chatId: number) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) return []

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
                isOnline: true,
                lastSeen: true
              }
            }
          }
        }
      }
    })

    if (!chat) return []

    // Исключаем текущего пользователя и обрабатываем null значения
    return chat.members
      .filter(member => member.userId !== currentUser.id && member.user)
      .map(member => {
        const user = member.user!
        const lastSeen = user.lastSeen || new Date()
        const isOnline = user.isOnline ?? false
        
        return {
          userId: user.id,
          name: user.name,
          surname: user.surname,
          isOnline,
          lastSeen,
          isRecentlyOnline: !isOnline && new Date().getTime() - lastSeen.getTime() < 5 * 60 * 1000
        }
      })
  } catch (error) {
    console.error('Error getting chat users status:', error)
    return []
  }
}