import { NextRequest, NextResponse } from 'next/server'
import { pusherServer } from '@/app/lib/pusher-server'
import { getCurrentUser } from '@/app/lib/api/user'

// Типы для данных аутентификации
interface AuthRequestBody {
  socket_id: string
  channel_name: string
}

interface PusherUserData {
  user_id: string
  user_info: {
    id: number
    name: string | null
    surname: string | null
    email?: string
  }
}

export async function POST(request: NextRequest) {
  try {
    // Получаем текущего пользователя
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized - User not found' },
        { status: 401 }
      )
    }

    // Валидация тела запроса
    let body: AuthRequestBody
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const { socket_id, channel_name } = body

    // Проверка обязательных полей
    if (!socket_id || !channel_name) {
      return NextResponse.json(
        { error: 'Missing required fields: socket_id or channel_name' },
        { status: 400 }
      )
    }

    // Подготавливаем данные пользователя
    const userData: PusherUserData = {
      user_id: currentUser.id.toString(),
      user_info: {
        id: currentUser.id,
        name: String(currentUser.name),
        surname: String(currentUser.surname),
        email: currentUser.email || undefined
      }
    }

    // Авторизация для различных типов каналов
    let isAuthorized = false

    // 1. Приватные пользовательские каналы
    if (channel_name.startsWith('private-user-')) {
      const userId = parseInt(channel_name.replace('private-user-', ''))
      if (userId === currentUser.id) {
        isAuthorized = true
      }
    }
    // 2. Каналы звонков
    else if (channel_name.startsWith('call-')) {
      // Дополнительная проверка для звонков (можно добавить логику проверки участников звонка)
      isAuthorized = true
    }
    // 3. Публичные каналы (если нужны)
    else if (channel_name.startsWith('public-')) {
      isAuthorized = true
    }
    // 4. Приватные каналы чатов
    else if (channel_name.startsWith('private-chat-')) {
      const chatId = channel_name.replace('private-chat-', '')
      // Здесь можно добавить проверку, является ли пользователь участником чата
      // Пример: const isChatMember = await checkChatMembership(currentUser.id, chatId)
      // isAuthorized = isChatMember
      isAuthorized = true // Временное решение
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: `Forbidden - Access denied to channel: ${channel_name}` },
        { status: 403 }
      )
    }

    // Авторизуем канал
    const authResponse = pusherServer.authorizeChannel(
      socket_id,
      channel_name,
      userData
    )

    // Логирование успешной авторизации (только в dev режиме)
    if (process.env.NODE_ENV === 'development') {
      console.log(`Pusher auth successful for user ${currentUser.id} on channel ${channel_name}`)
    }

    return NextResponse.json(authResponse)

  } catch (error) {
    console.error('Pusher auth error:', error)
    
    // Разные ответы в зависимости от типа ошибки
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          error: 'Authentication failed',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 