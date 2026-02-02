'use server'

import { prisma } from '@/app/lib/prisma'
import { getCurrentUser } from '@/app/lib/api/user'
import { AccessToken } from 'livekit-server-sdk'

// Инициализация LiveKit сервера
import { RoomServiceClient } from 'livekit-server-sdk'
import { livekitConfig } from './livekit-config'
import { User } from '../types'

const roomService = new RoomServiceClient(
  String(livekitConfig.wsUrl),
  livekitConfig.apiKey,
  livekitConfig.apiSecret
)

// Интерфейс для типизации
export interface CallData {
  id: number
  chatId: number
  initiatorId: number
  type: 'audio' | 'video'
  status: 'ringing' | 'active' | 'ended' | 'declined' | 'missed'
  startTime: Date
  endTime: Date | null
  duration: number | null
  liveKitRoom: string | null // Добавлено это поле
  initiator: {
    id: number
    name: string
    surname: string
    avatar: string | null
  }
  participants: Array<{
    id: number
    userId: number
    callId: number
    joinedAt: Date
    leftAt: Date | null
    user: {
      id: number
      name: string
      surname: string
      avatar: string | null
      email?: string
      phone?: string
    }
  }>
}

export interface CallInterfaceProps {
  callId: string
  currentUser: User
  participantsFromDB: Array<{
    userId: number
    user: User
  }>
  callType: 'audio' | 'video'
  onToggleAudio: () => void
  onToggleVideo: () => void
  onEndCall: () => void
  onToggleScreenShare?: () => void
  isScreenSharing?: boolean
  localStream: MediaStream | null
  remoteStreams: Map<number, MediaStream>
  remoteScreenStreams?: Map<number, MediaStream>
  isAudioEnabled: boolean
  isVideoEnabled: boolean
  webRTCParticipants?: number[] // Изменено с RemoteParticipant[] на number[]
  peerConnections?: Map<string, RTCPeerConnection>
  onRetryConnection?: (userId: number) => void
  chatId: number
  isLiveKit?: boolean
  liveKitConnected?: boolean
}

// Генерация токена для клиента
export async function generateLiveKitToken(
  roomName: string, 
  identity: string, 
  metadata?: string
) {
  const token = new AccessToken(
    livekitConfig.apiKey,
    livekitConfig.apiSecret,
    {
      identity,
      name: identity,
      metadata
    }
  )
  
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true
  })
  
  return token.toJwt()
}

// Создание комнаты в LiveKit
async function createLiveKitRoom(roomName: string, maxParticipants: number = 10) {
  try {
    const room = await roomService.createRoom({
      name: roomName,
      emptyTimeout: 60,
      maxParticipants
    })
    return room
  } catch (error) {
    console.error('Error creating LiveKit room:', error)
    throw error
  }
}

// Удаление комнаты
async function deleteLiveKitRoom(roomName: string) {
  try {
    await roomService.deleteRoom(roomName)
  } catch (error) {
    console.error('Error deleting LiveKit room:', error)
  }
}

// Получение участников комнаты
export async function createCallData(data: Partial<CallData> & { 
  id: number; 
  chatId: number; 
  initiatorId: number; 
  type: 'audio' | 'video';
  initiator: CallData['initiator']
}): Promise<CallData> {
  return {
    id: data.id,
    chatId: data.chatId,
    initiatorId: data.initiatorId,
    type: data.type,
    status: data.status || 'ringing',
    startTime: data.startTime || new Date(),
    endTime: data.endTime || null,
    duration: data.duration || null,
    liveKitRoom: data.liveKitRoom || null,
    initiator: data.initiator,
    participants: data.participants || []
  }
}

// Основная функция создания звонка
export async function initiateCall(chatId: number, type: 'audio' | 'video'): Promise<CallData> {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: { members: { include: { user: true } } }
  })

  if (!chat) throw new Error('Чат не найден')

  // Проверяем активный звонок
  const activeCall = await prisma.call.findFirst({
    where: {
      chatId,
      status: { in: ['ringing', 'active'] }
    }
  })

  if (activeCall) {
    throw new Error('В этом чате уже есть активный звонок')
  }

  // Создаем уникальное имя комнаты
  const roomName = `chat-${chatId}-${Date.now()}`

  // Создаем звонок в базе данных
  const call = await prisma.call.create({
    data: {
      chatId,
      initiatorId: currentUser.id,
      type,
      status: 'ringing',
      liveKitRoom: roomName,
      participants: {
        create: {
          userId: currentUser.id,
          joinedAt: new Date()
        }
      }
    },
    include: {
      initiator: {
        select: { id: true, name: true, surname: true, avatar: true }
      },
      participants: {
        include: {
          user: {
            select: { id: true, name: true, surname: true, avatar: true }
          }
        }
      }
    }
  })

  // Создаем комнату в LiveKit
  try {
    await createLiveKitRoom(roomName)
    console.log(`LiveKit room created: ${roomName}`)
  } catch (error) {
    console.error('Failed to create LiveKit room, rolling back call creation')
    await prisma.call.delete({ where: { id: call.id } })
    throw new Error('Не удалось создать звонок')
  }

  return transformPrismaCallToCallData(call)
}

// Принятие звонка с LiveKit
export async function acceptCall(callId: number): Promise<CallData> {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  console.log('[acceptCall] Accepting call:', callId, 'for user:', currentUser.id)

  try {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: {
        chat: { include: { members: true } },
        participants: { include: { user: true } }
      }
    })

    if (!call) throw new Error('Звонок не найден')

    // Проверяем права
    const isChatMember = call.chat.members.some(m => m.userId === currentUser.id)
    if (!isChatMember) throw new Error('Вы не участник этого чата')

    // Проверяем статус
    if (call.status !== 'ringing' && call.status !== 'active') {
      throw new Error('Звонок уже завершен')
    }

    // Если пользователь уже участник
    const isParticipant = call.participants.some(p => p.userId === currentUser.id)
    if (isParticipant && call.status === 'active') {
      return transformPrismaCallToCallData(call)
    }

    // Добавляем пользователя
    if (call.status === 'ringing') {
      console.log('[acceptCall] Adding user to call')

      await prisma.callParticipant.create({
        data: {
          callId,
          userId: currentUser.id,
          joinedAt: new Date()
        }
      })

      // Обновляем статус
      const updatedCall = await prisma.call.update({
        where: { id: callId },
        data: { status: 'active' },
        include: {
          initiator: true,
          participants: { include: { user: true } }
        }
      })

      return transformPrismaCallToCallData(updatedCall)
    }

    throw new Error('Не удалось принять звонк')
  } catch (error) {
    console.error('[acceptCall] Error:', error)
    throw error
  }
}

// Завершение звонка с очисткой LiveKit комнаты
export async function endCall(callId: number): Promise<CallData> {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  const call = await prisma.call.findUnique({
    where: { id: callId }
  })

  if (!call) throw new Error('Звонок не найден')

  // Удаляем комнату LiveKit
  if (call.liveKitRoom) {
    try {
      await deleteLiveKitRoom(call.liveKitRoom)
      console.log(`LiveKit room deleted: ${call.liveKitRoom}`)
    } catch (error) {
      console.error('Error deleting LiveKit room:', error)
    }
  }

  // Обновляем звонок в БД
  const endedCall = await prisma.call.update({
    where: { id: callId },
    data: {
      status: 'ended',
      endTime: new Date(),
      duration: Math.floor((new Date().getTime() - call.startTime.getTime()) / 1000)
    },
    include: {
      participants: { include: { user: true } }
    }
  })

  return transformPrismaCallToCallData(endedCall)
}

// Генерация токена для подключения к LiveKit
export async function getLiveKitToken(roomName: string) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  return generateLiveKitToken(
    roomName,
    `user-${currentUser.id}`,
    JSON.stringify({
      userId: currentUser.id,
      name: currentUser.name,
      surname: currentUser.surname,
      avatar: currentUser.avatar
    })
  )
}

// Получение активного звонка
export async function getActiveCallInChat(chatId: number): Promise<CallData | null> {
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
              email: true,
              phone: true
            }
          }
        }
      }
    }
  })

  if (!call) return null
  
  return transformPrismaCallToCallData(call)
}

// Отклонение звонка
export async function declineCall(callId: number): Promise<CallData> {
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

  // Удаляем комнату LiveKit если нет других участников
  if (call.liveKitRoom && call.participants.length <= 1) {
    await deleteLiveKitRoom(call.liveKitRoom)
  }

  const declinedCall = await prisma.call.update({
    where: { id: callId },
    data: { status: 'declined', endTime: new Date() },
    include: {
      initiator: true,
      participants: { include: { user: true } }
    }
  })

  return transformPrismaCallToCallData(declinedCall)
}

// Хелпер для трансформации данных
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
    liveKitRoom: prismaCall.liveKitRoom || null, // Обрабатываем undefined как null
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
        avatar: p.user.avatar,
        ...(p.user.email && { email: p.user.email }),
        ...(p.user.phone && { phone: p.user.phone })
      }
    }))
  }
}

// Обновление схемы Prisma для добавления поля liveKitRoom
// Добавьте в вашу схему Call:
/*
model Call {
  id           Int           @id @default(autoincrement())
  chatId       Int
  initiatorId  Int
  type         CallType      @default(audio)
  status       CallStatus    @default(ringing)
  startTime    DateTime      @default(now())
  endTime      DateTime?
  duration     Int?          @db.Int
  liveKitRoom  String?       // Добавьте это поле
  chat         Chat          @relation(fields: [chatId], references: [id])
  initiator    User          @relation("CallInitiator", fields: [initiatorId], references: [id])
  participants CallParticipant[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@map("calls")
}
*/