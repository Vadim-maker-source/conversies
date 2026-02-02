'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getPusherClient } from '@/app/lib/pusher-client'
import { getCurrentUser } from '@/app/lib/api/user'
import { User } from '@/app/lib/types'

export function GlobalNotifications() {

    const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
        const currentUser = await getCurrentUser()
        if(currentUser){
            setUser(currentUser)
        }
    }

    checkAuth()
  }, [])

  useEffect(() => {
    if (!user?.id) return

    let pusher: any = null
    let notificationsChannel: any = null

    const initializePusher = async () => {
      try {
        pusher = getPusherClient()
        if (!pusher) return

        // Подписываемся на канал уведомлений пользователя
        notificationsChannel = pusher.subscribe(`user-${user.id}-notifications`)

        // Обработчик входящих сообщений
        notificationsChannel.bind('new-message', (data: any) => {
          // Проверяем, находится ли пользователь на странице этого чата
          const isOnChatPage = window.location.pathname.includes(`/chat/${data.chatId}`)
          
          if (!isOnChatPage) {
            toast.info(`Новое сообщение от ${data.senderName}`, {
              description: data.content || '📎 Файл',
              action: {
                label: 'Открыть',
                onClick: () => {
                  window.location.href = `/chat/${data.chatId}`
                }
              },
              duration: 5000,
            })
          }
        })

        // Обработчик входящих звонков
        notificationsChannel.bind('incoming-call', (data: any) => {
          toast.info(`Входящий звонок от ${data.callerName}`, {
            description: data.type === 'video' ? 'Видеозвонок' : 'Аудиозвонок',
            action: data.type === 'video' ? {
              label: 'Принять',
              onClick: () => {
                window.location.href = `/chat/${data.chatId}?call=${data.callId}`
              }
            } : undefined,
            duration: 10000,
          })
        })

        // Обработчик новых участников в чате
        notificationsChannel.bind('user-joined', (data: any) => {
          toast.success('Новый участник', {
            description: `${data.userName} присоединился к чату "${data.chatName}"`,
            duration: 3000,
          })
        })

        // Обработчик реакций на сообщения
        notificationsChannel.bind('message-reaction', (data: any) => {
          const isOnChatPage = window.location.pathname.includes(`/chat/${data.chatId}`)
          
          if (!isOnChatPage) {
            toast.info('Новая реакция', {
              description: `${data.userName} ${data.emoji} на ваше сообщение`,
              duration: 3000,
            })
          }
        })

      } catch (error) {
        console.error('Error initializing notifications:', error)
      }
    }

    initializePusher()

    return () => {
      if (notificationsChannel) {
        notificationsChannel.unbind_all()
        notificationsChannel.unsubscribe()
      }
    }
  }, [user?.id])

  return null // Этот компонент не рендерит ничего видимого
}