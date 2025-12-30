'use client'

import { useState, useEffect } from 'react'
import { toggleUserSubscription, checkUserSubscription } from '@/app/lib/api/forum'
import { getCurrentUser } from '@/app/lib/api/user'
import { User } from '@/app/lib/types'

interface UserSubscribeButtonProps {
  authorId: number
  authorName: string
  userId: number | null
}

export default function UserSubscribeButton({ 
  authorId, 
  authorName,
  userId 
}: UserSubscribeButtonProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  // Инициализация данных
  useEffect(() => {
    const initializeData = async () => {
      setIsCheckingSubscription(true)
      
      try {
        // Получаем текущего пользователя
        const currentUser = await getCurrentUser()
        if (currentUser) {
          setUser(currentUser)
          
          // Проверяем подписку на пользователя только если пользователь не автор
          if (currentUser.id !== authorId) {
            const subscriptionResult = await checkUserSubscription(authorId)
            if (subscriptionResult && !('error' in subscriptionResult)) {
              setIsSubscribed(subscriptionResult.subscribed || false)
            }
          } else {
            // Пользователь не может подписаться на себя
            setIsSubscribed(false)
          }
        }
      } catch (error) {
        console.error('Error checking user subscription:', error)
      } finally {
        setIsCheckingSubscription(false)
      }
    }

    initializeData()
  }, [authorId])

  // Подписка/отписка от пользователя
  const handleSubscribe = async () => {
    if (!user?.id) {
      alert('Войдите, чтобы подписаться на пользователя')
      return
    }

    // Проверяем, что пользователь не пытается подписаться на себя
    if (user.id === authorId) {
      alert('Нельзя подписаться на себя')
      return
    }

    setIsLoading(true)
    try {
      const result = await toggleUserSubscription(authorId)
      
      if ('success' in result && result.success) {
        setIsSubscribed(result.subscribed || false)
        
        // Показываем уведомление
        if (result.subscribed) {
          alert(`✅ Вы подписались на ${authorName}. Вы будете получать уведомления о новых постах на email.`)
        } else {
          alert(`Вы отписались от ${authorName}`)
        }
      } else if ('error' in result && result.error) {
        alert(result.error)
      }
    } catch (error) {
      console.error('Error toggling user subscription:', error)
      alert('Ошибка при изменении подписки')
    } finally {
      setIsLoading(false)
    }
  }

  // Проверяем, может ли пользователь подписаться
  const canSubscribe = user?.id && user.id !== authorId

  if (isCheckingSubscription) {
    return (
      <button
        disabled
        className="w-full px-4 py-3 bg-gray-100 text-gray-400 font-medium rounded-xl cursor-not-allowed"
      >
        ⏳ Проверка подписки...
      </button>
    )
  }

  if (!canSubscribe) {
    if (!user) {
      return (
        <button
          disabled
          className="w-full px-4 py-3 bg-gray-100 text-gray-500 font-medium rounded-xl"
          title="Войдите, чтобы подписаться"
        >
          🔒 Войдите, чтобы подписаться
        </button>
      )
    }
    
    return (
      <button
        disabled
        className="w-full px-4 py-3 bg-gray-100 text-gray-500 font-medium rounded-xl"
        title="Нельзя подписаться на себя"
      >
        👤 Вы автор
      </button>
    )
  }

  return (
    <button
      onClick={handleSubscribe}
      disabled={isLoading}
      className={`
        w-full px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2
        ${isSubscribed 
          ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md hover:from-green-600 hover:to-green-700' 
          : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md hover:from-blue-600 hover:to-blue-700'
        }
        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <span className="text-lg">
        {isSubscribed ? '🔔' : '👤'}
      </span>
      <span>
        {isLoading ? 'Загрузка...' : 
         isSubscribed ? 'Вы подписаны' : 'Подписаться на автора'}
      </span>
    </button>
  )
}