import { NextRequest, NextResponse } from 'next/server'
import { pusherServer } from '@/app/lib/pusher-server'
import { getCurrentUser } from '@/app/lib/api/user'

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { socket_id, channel_name } = body

    // Авторизуем приватные каналы пользователя
    if (channel_name.startsWith('private-user-')) {
      const userId = parseInt(channel_name.replace('private-user-', ''))
      if (userId === currentUser.id) {
        const authResponse = pusherServer.authorizeChannel(socket_id, channel_name, {
          user_id: currentUser.id.toString(),
          user_info: {
            id: currentUser.id,
            name: currentUser.name,
            surname: currentUser.surname
          }
        })
        return NextResponse.json(authResponse)
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    
    // Авторизуем каналы звонков
    if (channel_name.startsWith('call-')) {
      const authResponse = pusherServer.authorizeChannel(socket_id, channel_name, {
        user_id: currentUser.id.toString(),
        user_info: {
          id: currentUser.id,
          name: currentUser.name,
          surname: currentUser.surname
        }
      })
      return NextResponse.json(authResponse)
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  } catch (error) {
    console.error('Pusher auth error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}