'use server'

import { prisma } from '@/app/lib/prisma'
import { getCurrentUser } from '@/app/lib/api/user'
import { pusherServer } from '../pusher-server'

export interface CallParticipant {
  userId: number
  isVideoEnabled: boolean
  isAudioEnabled: boolean
  isSpeaking: boolean
  connectionState: 'connected' | 'connecting' | 'disconnected'
}

// app/lib/api/calls.ts
export interface CallData {
  id: number
  chatId: number
  initiatorId: number
  type: 'audio' | 'video'
  status: 'ringing' | 'active' | 'ended' | 'missed' | 'declined'
  startTime: Date
  endTime?: Date
  duration?: number
  initiator: {
    id: number
    name: string | null
    surname: string | null
    avatar: string | null
  }
  participants: Array<{
    id: number
    userId: number
    callId: number
    joinedAt: Date
    leftAt: Date | null
    user: {
      phone: string
      email: string
      id: number
      name: string | null
      surname: string | null
      avatar: string | null
    }
  }>
}

// Функция для преобразования данных Prisma в CallData
function transformPrismaCallToCallData(prismaCall: any): CallData {
  return {
    id: prismaCall.id,
    chatId: prismaCall.chatId,
    initiatorId: prismaCall.initiatorId,
    type: prismaCall.type,
    status: prismaCall.status,
    startTime: prismaCall.startTime,
    endTime: prismaCall.endTime,
    duration: prismaCall.duration,
    initiator: {
      id: prismaCall.initiator.id,
      name: prismaCall.initiator.name,
      surname: prismaCall.initiator.surname,
      avatar: prismaCall.initiator.avatar
    },
    participants: prismaCall.participants.map((p: any) => ({
      id: p.id,
      userId: p.userId,
      callId: p.callId,
      joinedAt: p.joinedAt,
      leftAt: p.leftAt,
      user: {
        id: p.user.id,
        name: p.user.name,
        surname: p.user.surname,
        avatar: p.user.avatar
      }
    }))
  }
}

// Создание нового звонка с Pusher
export async function initiateCall(chatId: number, type: 'audio' | 'video') {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: { members: true }
  })

  if (!chat) throw new Error('Чат не найден')

  // Проверяем, есть ли активный звонок
  const activeCall = await prisma.call.findFirst({
    where: {
      chatId,
      status: { in: ['ringing', 'active'] }
    }
  })

  if (activeCall) {
    throw new Error('В этом чате уже есть активный звонок')
  }

  // Создаем звонок в базе данных
  const call = await prisma.call.create({
    data: {
      chatId,
      initiatorId: currentUser.id,
      type,
      status: 'ringing',
      participants: {
        create: {
          userId: currentUser.id,
          joinedAt: new Date()
        }
      }
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
    }
  })

  // Преобразуем данные Prisma в CallData
  const callData = transformPrismaCallToCallData(call)

  // Отправляем уведомление через Pusher всем участникам чата
  const participants = chat.members
    .filter(member => member.userId !== currentUser.id)
    .map(member => member.userId)

  // Проверяем доступность Pusher сервера
  if (!pusherServer) {
    console.error('Pusher server not available')
    throw new Error('Сервер уведомлений недоступен')
  }

  try {
    await Promise.all(
      participants.map(userId =>
        pusherServer.trigger(`user-${userId}`, 'call-incoming', {
          callId: call.id,  // число
          chatId,           // число
          initiatorId: call.initiatorId, // число
          initiator: call.initiator,
          type,
          status: 'ringing',
          participants: call.participants,
          startTime: call.startTime.toISOString()
        })
      )
    );
  } catch (pusherError) {
    console.error('Pusher notification failed:', pusherError)
    // Не прерываем процесс создания звонка из-за ошибки уведомления
  }

  return callData
}

// Принятие звонка

export async function acceptCall(callId: number) {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error('Не авторизован');

  // ВАЖНО: Проверяем, что callId является числом
  if (typeof callId !== 'number' || isNaN(callId) || callId <= 0) {
    throw new Error(`Неверный идентификатор звонка: ${callId}`);
  }

  console.log('[acceptCall] Attempting to accept call with ID:', callId, 'for user:', currentUser.id);

  try {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        chat: { 
          include: { members: true } 
        },
        participants: { 
          include: { user: true } 
        }
      }
    });

    if (!call) {
      console.error('[acceptCall] Call not found with ID:', callId);
      throw new Error('Звонок не найден');
    }
    
    console.log('[acceptCall] Call found:', {
      id: call.id,
      status: call.status,
      participants: call.participants.map(p => p.userId)
    });
    
    // Проверяем, является ли пользователь участником чата
    const isChatMember = call.chat.members.some(m => m.userId === currentUser.id);
    if (!isChatMember) {
      throw new Error('Вы не участник этого чата');
    }
    
    // Проверяем статус звонка
    if (call.status !== 'ringing' && call.status !== 'active') {
      throw new Error('Звонок уже завершен');
    }

    // Проверяем, является ли пользователь уже участником
    const isParticipant = call.participants.some(p => p.userId === currentUser.id);
    
    if (isParticipant && call.status === 'active') {
      console.log('[acceptCall] User already participant, returning call data');
      return transformPrismaCallToCallData(call);
    }

    // Если звонок еще звонит, добавляем пользователя
    if (call.status === 'ringing') {
      console.log('[acceptCall] Adding user to call');
      
      // Добавляем пользователя в участники
      await prisma.callParticipant.create({
        data: {
          callId,
          userId: currentUser.id,
          joinedAt: new Date()
        }
      });

      // Обновляем статус звонка на активный
      const updatedCall = await prisma.call.update({
        where: { id: callId },
        data: { status: 'active' },
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
        }
      });

      const callData = transformPrismaCallToCallData(updatedCall);
      
      console.log('[acceptCall] Call accepted successfully, notifying participants');

      // Уведомляем инициатора
      await pusherServer.trigger(`user-${call.initiatorId}`, 'call-accepted', {
        callId,
        userId: currentUser.id,
        user: {
          id: currentUser.id,
          name: currentUser.name,
          surname: currentUser.surname,
          avatar: currentUser.avatar
        },
        participants: updatedCall.participants
      });

      // Уведомляем всех участников канала звонка
      await pusherServer.trigger(`call-${callId}`, 'call-accepted', {
        callId,
        userId: currentUser.id,
        user: {
          id: currentUser.id,
          name: currentUser.name,
          surname: currentUser.surname,
          avatar: currentUser.avatar
        }
      });

      // Уведомляем всех в чате
      await pusherServer.trigger(`chat-${call.chatId}`, 'call-accepted', {
        callId,
        userId: currentUser.id
      });

      await pusherServer.trigger(`call-${callId}`, 'participant-joined', {
        callId,
        userId: currentUser.id,
        user: {
          id: currentUser.id,
          name: currentUser.name,
          surname: currentUser.surname,
          avatar: currentUser.avatar
        },
        participants: updatedCall.participants.map(p => p.userId)
      });

      return callData;
    }

    throw new Error('Не удалось принять звонк');
  } catch (error) {
    console.error('[acceptCall] Error:', error);
    throw error;
  }
}

// Получение активного звонка в чате
export async function getActiveCallInChat(chatId: number) {
  const call = await prisma.call.findFirst({
    where: {
      chatId,
      status: { in: ['ringing', 'active'] }
    },
    include: {
      initiator: true,
      participants: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              surname: true,
              avatar: true,
              email: true, // Добавляем email
              phone: true  // Добавляем phone
            }
          }
        }
      }
    }
  })

  if (!call) return null
  
  // Преобразуем данные Prisma в CallData
  return transformPrismaCallToCallData(call)
}

// Отклонение звонка
export async function declineCall(callId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: {
      initiator: true,
      participants: { include: { user: true } }
    }
  })

  if (!call) throw new Error('Звонок не найден')
  if (call.status !== 'ringing') throw new Error('Звонок уже завершен')

  // Обновляем статус звонка на "отклоненный"
  const declinedCall = await prisma.call.update({
    where: { id: callId },
    data: { status: 'declined', endTime: new Date() },
    include: {
      initiator: true,
      participants: { include: { user: true } }
    }
  })

  // Уведомляем инициатора об отклонении звонка
  await pusherServer.trigger(`user-${call.initiatorId}`, 'call-declined', {
    callId,
    declinedBy: currentUser.id,
    user: {
      id: currentUser.id,
      name: currentUser.name,
      surname: currentUser.surname,
      avatar: currentUser.avatar
    }
  })

  // Также уведомляем всех участников канала звонка
  await pusherServer.trigger(`call-${callId}`, 'call-declined', {
    callId,
    declinedBy: currentUser.id
  })

  return declinedCall
}

// Обновление состояния медиа (микрофон/камера)
export async function updateCallMedia(
  callId: number,
  updates: { isAudioEnabled?: boolean; isVideoEnabled?: boolean }
) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  // Проверяем, что пользователь участник звонка
  const participant = await prisma.callParticipant.findUnique({
    where: {
      callId_userId: {
        callId,
        userId: currentUser.id
      }
    }
  })

  if (!participant) throw new Error('Вы не участник этого звонка')

  // Отправляем обновление через Pusher
  await pusherServer.trigger(`call-${callId}`, 'media-updated', {
    callId,
    userId: currentUser.id,
    updates
  })

  return { success: true }
}

// Завершение звонка
export async function endCall(callId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  const call = await prisma.call.findUnique({
    where: { id: callId }
  })

  if (!call) throw new Error('Звонок не найден')

  // Обновляем звонок в базе данных
  const endedCall = await prisma.call.update({
    where: { id: callId },
    data: {
      status: 'ended',
      endTime: new Date(),
      duration: Math.floor((new Date().getTime() - call.startTime.getTime()) / 1000)
    },
    include: {
      participants: {
        include: {
          user: true
        }
      }
    }
  })

  // Уведомляем всех участников о завершении звонка
  await pusherServer.trigger(`call-${callId}`, 'call-ended', {
    callId,
    endedBy: currentUser.id,
    duration: endedCall.duration
  })

  return endedCall
}

// Получение истории звонков
export async function getCallHistory(chatId: number, limit: number = 20) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  const calls = await prisma.call.findMany({
    where: {
      chatId,
      participants: {
        some: {
          userId: currentUser.id
        }
      },
      status: { in: ['ended', 'missed', 'declined'] }
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
    },
    take: limit
  })

  return calls
}

// Автоматическое завершение пропущенных звонков
export async function markMissedCalls() {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)

  const missedCalls = await prisma.call.updateMany({
    where: {
      status: 'ringing',
      startTime: { lt: thirtyMinutesAgo }
    },
    data: {
      status: 'missed',
      endTime: new Date()
    }
  })

  return missedCalls
}

// Выход из звонка (если несколько участников)
export async function leaveCall(callId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: {
      participants: true
    }
  })

  if (!call) throw new Error('Звонок не найден')
  if (call.status !== 'active') throw new Error('Звонок не активен')

  // Отмечаем время выхода пользователя
  await prisma.callParticipant.update({
    where: {
      callId_userId: {
        callId,
        userId: currentUser.id
      }
    },
    data: {
      leftAt: new Date()
    }
  })

  // Проверяем, остались ли участники в звонке
  const activeParticipants = call.participants.filter(
    p => p.userId !== currentUser.id && !p.leftAt
  )

  // Если остался только один участник или никто, завершаем звонок
  if (activeParticipants.length <= 1) {
    await endCall(callId)
    return { action: 'ended' }
  }

  // Уведомляем остальных участников о выходе
  await pusherServer.trigger(`call-${callId}`, 'participant-left', {
    callId,
    userId: currentUser.id,
    remainingParticipants: activeParticipants.length
  })

  return { action: 'left', remainingParticipants: activeParticipants.length }
}