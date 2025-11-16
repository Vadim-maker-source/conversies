'use server'

import { prisma } from '@/app/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth'
import { revalidatePath } from 'next/cache'
import { gifts, getGiftById } from '../gifts-data'

// Подарить подарок
export async function sendGift(receiverId: number, giftId: number, message?: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: 'Не авторизован' }
    }

    const senderId = Number(session.user.id)

    // Получаем данные о подарке
    const giftData = getGiftById(giftId)
    if (!giftData) {
      return { error: 'Подарок не найден' }
    }

    // Проверяем баланс отправителя
    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      select: { coins: true }
    })

    if (!sender) {
      return { error: 'Отправитель не найден' }
    }

    if (sender.coins < giftData.price) {
      return { error: 'Недостаточно монет для покупки подарка' }
    }

    // Проверяем существование получателя
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: { id: true }
    })

    if (!receiver) {
      return { error: 'Получатель не найден' }
    }

    // Создаем подарок в транзакции
    const result = await prisma.$transaction(async (tx) => {
      // Списываем монеты у отправителя
      await tx.user.update({
        where: { id: senderId },
        data: { coins: { decrement: giftData.price } }
      })

      // Создаем запись о подарке
      const gift = await tx.gift.create({
        data: {
          giftId: giftData.id,
          price: giftData.price,
          message: message?.trim() || null,
          senderId,
          receiverId,
          status: 'ACTIVE'
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              surname: true,
              avatar: true
            }
          },
          receiver: {
            select: {
              id: true,
              name: true,
              surname: true,
              avatar: true
            }
          }
        }
      })

      return gift
    })

    revalidatePath('/settings')
    return { 
      success: true, 
      message: 'Подарок успешно отправлен!',
      gift: result
    }
  } catch (error) {
    console.error('Error sending gift:', error)
    return { error: 'Ошибка при отправке подарка' }
  }
}

// Обналичить подарок
export async function redeemGift(giftId: number) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: 'Не авторизован' }
    }

    const userId = Number(session.user.id)

    // Находим подарок
    const gift = await prisma.gift.findFirst({
      where: {
        id: giftId,
        receiverId: userId,
        status: 'ACTIVE'
      }
    })

    if (!gift) {
      return { error: 'Подарок не найден или уже использован' }
    }

    // Обналичиваем подарок в транзакции
    const result = await prisma.$transaction(async (tx) => {
      // Добавляем монеты получателю
      await tx.user.update({
        where: { id: userId },
        data: { coins: { increment: gift.price } }
      })

      // Обновляем статус подарка
      const updatedGift = await tx.gift.update({
        where: { id: giftId },
        data: { status: 'REDEEMED' },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              surname: true,
              avatar: true
            }
          }
        }
      })

      return updatedGift
    })

    revalidatePath('/settings')
    return { 
      success: true, 
      message: `Подарок обналичен! Вы получили ${result.price} монет.`,
      gift: result
    }
  } catch (error) {
    console.error('Error redeeming gift:', error)
    return { error: 'Ошибка при обналичивании подарка' }
  }
}

// Передать подарок
export async function regiftGift(originalGiftId: number, newReceiverId: number, message?: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: 'Не авторизован' }
    }

    const userId = Number(session.user.id)

    // Проверяем, что не дарим самому себе
    if (userId === newReceiverId) {
      return { error: 'Нельзя передарить подарок самому себе' }
    }

    // Находим оригинальный подарок
    const originalGift = await prisma.gift.findFirst({
      where: {
        id: originalGiftId,
        receiverId: userId,
        status: 'ACTIVE'
      }
    })

    if (!originalGift) {
      return { error: 'Подарок не найден или уже использован' }
    }

    // Проверяем существование нового получателя
    const newReceiver = await prisma.user.findUnique({
      where: { id: newReceiverId },
      select: { id: true }
    })

    if (!newReceiver) {
      return { error: 'Получатель не найден' }
    }

    // Передариваем подарок в транзакции
    const result = await prisma.$transaction(async (tx) => {
      // Создаем новый подарок (передаренный)
      const newGift = await tx.gift.create({
        data: {
          giftId: originalGift.giftId,
          price: originalGift.price,
          message: message?.trim() || null,
          senderId: userId,
          receiverId: newReceiverId,
          status: 'ACTIVE',
          originalGiftId: originalGift.id
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              surname: true,
              avatar: true
            }
          },
          receiver: {
            select: {
              id: true,
              name: true,
              surname: true,
              avatar: true
            }
          }
        }
      })

      // Обновляем статус оригинального подарка
      await tx.gift.update({
        where: { id: originalGiftId },
        data: { status: 'REGIFTED' }
      })

      return newGift
    })

    revalidatePath('/settings')
    return { 
      success: true, 
      message: 'Подарок успешно передарен!',
      gift: result
    }
  } catch (error) {
    console.error('Error regifting:', error)
    return { error: 'Ошибка при передарении подарка' }
  }
}

// Получить полученные подарки
export async function getReceivedGifts() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return []
    }

    const userId = Number(session.user.id)

    const gifts = await prisma.gift.findMany({
      where: {
        receiverId: userId,
        status: { in: ['ACTIVE', 'REDEEMED'] }
      },
      include: {
        sender: {
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

    return gifts
  } catch (error) {
    console.error('Error fetching received gifts:', error)
    return []
  }
}

// Получить отправленные подарки
export async function getSentGifts() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return []
    }

    const userId = Number(session.user.id)

    const gifts = await prisma.gift.findMany({
      where: {
        senderId: userId
      },
      include: {
        receiver: {
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

    return gifts
  } catch (error) {
    console.error('Error fetching sent gifts:', error)
    return []
  }
}

// Получить баланс пользователя
export async function getUserCoins() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return 0
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(session.user.id) },
      select: { coins: true }
    })

    return user?.coins || 0
  } catch (error) {
    console.error('Error fetching user coins:', error)
    return 0
  }
}

// Получить список пользователей для дарения (кроме себя)
export async function getUsersForGifting() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return []
    }

    const currentUserId = Number(session.user.id)

    const users = await prisma.user.findMany({
      where: {
        id: { not: currentUserId }
      },
      select: {
        id: true,
        name: true,
        surname: true,
        avatar: true,
        isPremium: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    return users
  } catch (error) {
    console.error('Error fetching users for gifting:', error)
    return []
  }
}