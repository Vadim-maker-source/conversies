'use server'

import { prisma } from '@/app/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth'
import { revalidatePath } from 'next/cache'
import { sendGift } from './gifts'

// Получить прогресс по ивенту
export async function getEventProgress(eventType: string = 'winter_2024') {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { points: 0, claimedMilestones: [] }
    }

    const progress = await prisma.eventProgress.findUnique({
      where: {
        userId_eventType: {
          userId: Number(session.user.id),
          eventType
        }
      }
    })

    return {
      points: progress?.points || 0,
      claimedMilestones: progress?.claimedMilestones ? JSON.parse(progress.claimedMilestones) : []
    }
  } catch (error) {
    console.error('Error fetching event progress:', error)
    return { points: 0, claimedMilestones: [] }
  }
}

// Обновить очки ивента
export async function updateEventPoints(points: number, eventType: string = 'winter_2024') {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: 'Не авторизован' }
    }

    const userId = Number(session.user.id)

    // Сначала получаем текущий прогресс
    const currentProgress = await prisma.eventProgress.findUnique({
      where: {
        userId_eventType: {
          userId,
          eventType
        }
      }
    })

    const currentPoints = currentProgress?.points || 0
    
    // Рассчитываем новые очки с защитой от ухода в глубокий минус
    let newPoints = currentPoints + points
    
    // Гарантируем, что очки не станут меньше 0 (или можно установить другой минимум)
    newPoints = Math.max(newPoints, 0)

    const progress = await prisma.eventProgress.upsert({
      where: {
        userId_eventType: {
          userId,
          eventType
        }
      },
      update: {
        points: newPoints
      },
      create: {
        userId,
        eventType,
        points: newPoints
      }
    })

    revalidatePath('/')
    return { 
      success: true, 
      points: progress.points,
      pointsChange: points,
      totalPoints: progress.points
    }
  } catch (error) {
    console.error('Error updating event points:', error)
    return { error: 'Ошибка при обновлении очков' }
  }
}

// Получить награду за milestone
export async function claimEventMilestone(milestonePoints: number, giftId: number, eventType: string = 'winter_2024') {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: 'Не авторизован' }
    }

    const userId = Number(session.user.id)

    // Проверяем прогресс пользователя
    const progress = await prisma.eventProgress.findUnique({
      where: {
        userId_eventType: {
          userId,
          eventType
        }
      },
      select: {
        points: true,
        claimedMilestones: true
      }
    })

    if (!progress || progress.points < milestonePoints) {
      return { error: 'Недостаточно очков для получения награды' }
    }

    // Проверяем, не получена ли уже награда
    const claimedMilestones = progress.claimedMilestones ? JSON.parse(progress.claimedMilestones) : []
    if (claimedMilestones.includes(milestonePoints)) {
      return { error: 'Награда уже получена' }
    }

    // Дарим подарок от имени системного пользователя (ID 1)
    const giftResult = await sendGift(userId, giftId, `🎁 Награда за достижение ${milestonePoints} очков в зимнем ивенте!`)

    if (giftResult.error) {
      return { error: giftResult.error }
    }

    // Обновляем список полученных наград
    const updatedMilestones = [...claimedMilestones, milestonePoints]
    await prisma.eventProgress.update({
      where: {
        userId_eventType: {
          userId,
          eventType
        }
      },
      data: {
        claimedMilestones: JSON.stringify(updatedMilestones)
      }
    })

    revalidatePath('/')
    return { 
      success: true, 
      message: `Награда получена! Вам подарен подарок.`,
      gift: giftResult.gift
    }
  } catch (error) {
    console.error('Error claiming milestone:', error)
    return { error: 'Ошибка при получении награды' }
  }
}