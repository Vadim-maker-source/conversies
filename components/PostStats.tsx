'use client'

import { useState, useEffect } from 'react'
import { toggleForumReaction, togglePostSubscription, checkPostSubscription } from '@/app/lib/api/forum'
import { getCurrentUser } from '@/app/lib/api/user'
import { User, SubscriptionResponse, PostSubscriptionCheck } from '@/app/lib/types'

interface PostStatsProps {
  postId: number
  postData: {
    viewsCount: number
    commentsCount: number
    reactionsCount: number
    content: string
    title: string
    authorId: number
  }
  userReaction?: { emoji: string } | null
  initialReactions?: Array<{
    emoji: string
    count: number
  }>
}

interface ReactionType {
  emoji: string
  count: number
  label: string
  color: string
}

const REACTION_TYPES: ReactionType[] = [
  { emoji: '👍', label: 'Нравится', count: 0, color: 'blue' },
  { emoji: '❤️', label: 'Любовь', count: 0, color: 'red' },
  { emoji: '🔥', label: 'Горячо', count: 0, color: 'orange' },
  { emoji: '😮', label: 'Удивление', count: 0, color: 'yellow' },
  { emoji: '👏', label: 'Аплодисменты', count: 0, color: 'green' }
]

export default function PostStats({ 
  postId, 
  postData,
  userReaction = null,
  initialReactions = []
}: PostStatsProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [reactions, setReactions] = useState<ReactionType[]>([])
  const [currentUserReaction, setCurrentUserReaction] = useState<string | null>(null)
  const [views, setViews] = useState(postData.viewsCount || 0)
  const [comments, setComments] = useState(postData.commentsCount || 0)
  const [totalReactions, setTotalReactions] = useState(postData.reactionsCount || 0)

  // Инициализация данных - все сразу
  useEffect(() => {
    const initializeData = async () => {
      console.log('Initializing PostStats with data:', {
        postId,
        initialReactions,
        userReaction,
        postData
      })
      
      setIsCheckingSubscription(true)
      
      try {
        // 1. Инициализируем реакции из пропсов
        const initializedReactions = REACTION_TYPES.map(reaction => {
          const found = initialReactions.find(r => r.emoji === reaction.emoji)
          return {
            ...reaction,
            count: found?.count || 0
          }
        })
        
        const total = initializedReactions.reduce((sum, r) => sum + r.count, 0)
        
        setReactions(initializedReactions)
        setTotalReactions(total)
        
        // 2. Устанавливаем реакцию пользователя
        if (userReaction?.emoji) {
          setCurrentUserReaction(userReaction.emoji)
        }
        
        // 3. Получаем текущего пользователя и проверяем подписку
        const currentUser = await getCurrentUser()
        if (currentUser) {
          setUser(currentUser)
          
          if (currentUser.id !== postData.authorId) {
            const subscriptionResult = await checkPostSubscription(postId)
            if (subscriptionResult && !('error' in subscriptionResult)) {
              setIsSubscribed(subscriptionResult.subscribed || false)
            }
          }
        }
        
        console.log('Data initialized:', {
          reactions: initializedReactions,
          totalReactions: total,
          currentUserReaction: userReaction?.emoji,
          user: currentUser ? 'yes' : 'no',
          isSubscribed
        })
      } catch (error) {
        console.error('Error initializing PostStats:', error)
      } finally {
        setIsCheckingSubscription(false)
      }
    }

    initializeData()
  }, [postId, postData.authorId, initialReactions, userReaction]) // Все зависимости

  // Обработчик реакции - с обновлением локального состояния
  const handleReaction = async (emoji: string) => {
    if (!user?.id) {
      alert('Войдите, чтобы ставить реакции')
      return
    }
  
    setIsLoading(true)
    
    try {
      const result = await toggleForumReaction({
        emoji,
        postId
      })
  
      if (result.success) {
        // Обновляем локальное состояние на основе ответа сервера
        setReactions(prev => {
          const newReactions = [...prev]
          
          if (result.action === 'removed') {
            // Убираем реакцию
            const reactionIndex = newReactions.findIndex(r => r.emoji === emoji)
            if (reactionIndex !== -1) {
              newReactions[reactionIndex] = {
                ...newReactions[reactionIndex],
                count: Math.max(0, newReactions[reactionIndex].count - 1)
              }
            }
            setCurrentUserReaction(null)
            setTotalReactions(prevTotal => Math.max(0, prevTotal - 1))
          } 
          else if (result.action === 'replaced') {
            // Заменяем реакцию
            // Убираем старую реакцию
            const oldReactionIndex = newReactions.findIndex(r => r.emoji === result.previousEmoji)
            if (oldReactionIndex !== -1) {
              newReactions[oldReactionIndex] = {
                ...newReactions[oldReactionIndex],
                count: Math.max(0, newReactions[oldReactionIndex].count - 1)
              }
            }
            
            // Добавляем новую реакцию
            const newReactionIndex = newReactions.findIndex(r => r.emoji === emoji)
            if (newReactionIndex !== -1) {
              newReactions[newReactionIndex] = {
                ...newReactions[newReactionIndex],
                count: newReactions[newReactionIndex].count + 1
              }
            }
            
            setCurrentUserReaction(emoji)
            // Общее количество реакций не меняется при замене
          }
          else if (result.action === 'added') {
            // Добавляем новую реакцию
            const reactionIndex = newReactions.findIndex(r => r.emoji === emoji)
            if (reactionIndex !== -1) {
              newReactions[reactionIndex] = {
                ...newReactions[reactionIndex],
                count: newReactions[reactionIndex].count + 1
              }
            }
            setCurrentUserReaction(emoji)
            setTotalReactions(prevTotal => prevTotal + 1)
          }
          
          return newReactions
        })
      }
    } catch (error) {
      console.error('Error toggling reaction:', error)
      alert('Ошибка при изменении реакции')
    } finally {
      setIsLoading(false)
    }
  }

  // Подписка/отписка на пост
  const handleSubscribe = async () => {
    if (!user?.id) {
      alert('Войдите, чтобы подписаться на пост')
      return
    }

    setIsLoading(true)
    try {
      const result: SubscriptionResponse = await togglePostSubscription(postId)
      
      if ('success' in result && result.success) {
        setIsSubscribed(result.subscribed || false)
        
        if (result.subscribed) {
          alert(`✅ Вы подписались на пост "${postData.title}". Вы будете получать уведомления о новых комментариях.`)
        } else {
          alert('Вы отписались от поста')
        }
      } else if ('error' in result && result.error) {
        alert(result.error)
      }
    } catch (error) {
      console.error('Error toggling subscription:', error)
      alert('Ошибка при изменении подписки')
    } finally {
      setIsLoading(false)
    }
  }

  // Шаринг
  const handleShare = () => {
    const shareData = {
      title: postData.title || 'Пост на форуме',
      text: postData.content?.substring(0, 100) || 'Интересный пост на форуме',
      url: window.location.href,
    }

    if (navigator.share && navigator.canShare?.(shareData)) {
      navigator.share(shareData)
    } else {
      navigator.clipboard.writeText(window.location.href)
      alert('Ссылка скопирована в буфер обмена!')
    }
  }

  // Копирование ссылки
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    alert('Ссылка скопирована!')
  }

  // Расчет времени чтения
  const calculateReadingTime = () => {
    const contentLength = postData.content?.length || 0
    const words = Math.ceil(contentLength / 5)
    const wordsPerMinute = 200
    const minutes = Math.ceil(words / wordsPerMinute)
    return minutes <= 1 ? 'Менее минуты' : `${minutes} мин`
  }

  // Форматирование чисел
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  // Проценты вовлеченности
  const getEngagementPercentage = (): string => {
    if (views === 0) return '0'
    const percentage = ((comments + totalReactions) / views * 100)
    return percentage.toFixed(1)
  }

  const getCommentPercentage = (): string => {
    if (views === 0) return '0'
    const percentage = (comments / views * 100)
    return percentage.toFixed(1)
  }

  const getReactionPercentage = (): string => {
    if (views === 0) return '0'
    const percentage = (totalReactions / views * 100)
    return percentage.toFixed(1)
  }

  // Самая популярная реакция
  const mostPopularReaction = reactions.length > 0 
    ? reactions.reduce((prev, current) => 
        prev.count > current.count ? prev : current
      )
    : null

  // Цвета для статистики
  const getColorClass = (type: 'views' | 'comments' | 'reactions' | 'time' | 'subscription') => {
    switch(type) {
      case 'views': return { bg: 'from-blue-50 to-blue-100', border: 'border-blue-200', icon: 'text-blue-600', gradient: 'from-blue-400 to-blue-500' }
      case 'comments': return { bg: 'from-green-50 to-green-100', border: 'border-green-200', icon: 'text-green-600', gradient: 'from-green-400 to-green-500' }
      case 'reactions': return { bg: 'from-red-50 to-red-100', border: 'border-red-200', icon: 'text-red-600', gradient: 'from-red-400 to-red-500' }
      case 'time': return { bg: 'from-purple-50 to-purple-100', border: 'border-purple-200', icon: 'text-purple-600', gradient: 'from-purple-400 to-purple-500' }
      case 'subscription': return { bg: 'from-yellow-50 to-yellow-100', border: 'border-yellow-200', icon: 'text-yellow-600', gradient: 'from-yellow-400 to-yellow-500' }
      default: return { bg: 'from-gray-50 to-gray-100', border: 'border-gray-200', icon: 'text-gray-600', gradient: 'from-gray-400 to-gray-500' }
    }
  }

  // Преобразуем строку в число для стилей
  const parsePercentage = (percentageStr: string): number => {
    const num = parseFloat(percentageStr)
    return isNaN(num) ? 0 : Math.min(num, 100)
  }

  // Проверяем, может ли пользователь подписаться
  const canSubscribe = user?.id && user.id !== postData.authorId

  return (
    <div className="space-y-6">
      {/* Основная статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Просмотры */}
        <div className={`bg-gradient-to-br ${getColorClass('views').bg} rounded-xl p-4 border ${getColorClass('views').border} shadow-sm`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${getColorClass('views').gradient} flex items-center justify-center shadow-sm`}>
              <span className="text-white text-lg">👁️</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{formatNumber(views)}</div>
              <div className="text-sm text-gray-600 font-medium">просмотров</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {views > 100 ? `${Math.round(views / 30)} в день` : 'Новый пост'}
          </div>
        </div>

        {/* Комментарии */}
        <div className={`bg-gradient-to-br ${getColorClass('comments').bg} rounded-xl p-4 border ${getColorClass('comments').border} shadow-sm`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${getColorClass('comments').gradient} flex items-center justify-center shadow-sm`}>
              <span className="text-white text-lg">💬</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{formatNumber(comments)}</div>
              <div className="text-sm text-gray-600 font-medium">комментариев</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {getCommentPercentage()}% от просмотров
          </div>
        </div>

        {/* Реакции */}
        <div className={`bg-gradient-to-br ${getColorClass('reactions').bg} rounded-xl p-4 border ${getColorClass('reactions').border} shadow-sm`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${getColorClass('reactions').gradient} flex items-center justify-center shadow-sm`}>
              <span className="text-white text-lg">❤️</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{formatNumber(totalReactions)}</div>
              <div className="text-sm text-gray-600 font-medium">реакций</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {mostPopularReaction && mostPopularReaction.count > 0 
              ? `Популярно: ${mostPopularReaction.emoji} (${mostPopularReaction.count})`
              : 'Пока нет реакций'
            }
          </div>
        </div>

        {/* Время чтения */}
        <div className={`bg-gradient-to-br ${getColorClass('time').bg} rounded-xl p-4 border ${getColorClass('time').border} shadow-sm`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${getColorClass('time').gradient} flex items-center justify-center shadow-sm`}>
              <span className="text-white text-lg">⏱️</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{calculateReadingTime()}</div>
              <div className="text-sm text-gray-600 font-medium">чтения</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {getReactionPercentage()}% реакций
          </div>
        </div>

        {/* Подписка
        <div className={`bg-gradient-to-br ${getColorClass('subscription').bg} rounded-xl p-4 border ${getColorClass('subscription').border} shadow-sm`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${getColorClass('subscription').gradient} flex items-center justify-center shadow-sm`}>
              <span className="text-white text-lg">🔔</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {isCheckingSubscription ? '...' : (isSubscribed ? 'Да' : 'Нет')}
              </div>
              <div className="text-sm text-gray-600 font-medium">подписка</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {isSubscribed ? 'Вы подписаны' : 'Не подписаны'}
          </div>
        </div> */}
      </div>

      {/* Реакции с количеством */}
      <div className="bg-white border rounded-xl p-4 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="text-xl">💖</span>
          <span>Реакции</span>
          {totalReactions > 0 && (
            <span className="text-sm font-normal text-gray-500">
              · {totalReactions} {totalReactions === 1 ? 'реакция' : totalReactions < 5 ? 'реакции' : 'реакций'}
            </span>
          )}
        </h3>
        
        <div className="flex flex-wrap items-center gap-3">
          {reactions.map(({ emoji, label, count }) => {
            const isUserReaction = currentUserReaction === emoji
            
            return (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                disabled={isLoading || !user}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200
                  relative group min-w-[100px]
                  ${isUserReaction 
                    ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 shadow-md' 
                    : 'bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300'
                  }
                  ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 hover:shadow-sm'}
                  ${!user ? 'opacity-70 cursor-not-allowed' : ''}
                `}
                title={user ? `${label} (${count})` : 'Войдите, чтобы ставить реакции'}
              >
                <span className="text-2xl">{emoji}</span>
                <span className={`
                  text-base font-bold px-2 py-1 rounded-lg
                  ${isUserReaction 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-800'
                  }
                `}>
                  {count}
                </span>
                
                {/* Подсказка */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-10">
                  <div className="font-medium">{label}</div>
                  <div className="text-xs text-gray-300 mt-1">
                    {count} {count === 1 ? 'человек' : 'людей'} поставил{count === 1 ? '' : 'о'}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-600">
            {currentUserReaction 
              ? `Вы поставили реакцию ${currentUserReaction}. Нажмите ещё раз, чтобы убрать.`
              : user 
                ? 'Выберите реакцию. Можно поставить только одну.'
                : 'Войдите, чтобы ставить реакции'
            }
          </p>
        </div>
      </div>

      {/* Действия */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSubscribe}
              disabled={isLoading || isCheckingSubscription || !canSubscribe}
              className={`
                px-5 py-2.5 rounded-xl flex items-center gap-3 transition-all font-medium
                ${isSubscribed 
                  ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md hover:from-green-600 hover:to-green-700' 
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 hover:shadow-sm'
                }
                ${(!canSubscribe || isLoading || isCheckingSubscription) ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              title={!user ? 'Войдите, чтобы подписаться' : user.id === postData.authorId ? 'Нельзя подписаться на свой пост' : ''}
            >
              <span className="text-lg">
                {isCheckingSubscription ? '⏳' : (isSubscribed ? '🔔' : '🔕')}
              </span>
              <span>
                {isCheckingSubscription ? 'Проверка...' : 
                 isLoading ? 'Загрузка...' : 
                 isSubscribed ? 'Вы подписаны' : 'Подписаться'}
              </span>
            </button>
            
            <div className="text-sm text-gray-500">
              {isSubscribed 
                ? 'Вы будете получать уведомления о новых комментариях' 
                : user?.id === postData.authorId 
                  ? 'Вы автор этого поста'
                  : 'Получайте уведомления о новых комментариях'
              }
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleShare}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 flex items-center gap-3 font-medium shadow-md hover:shadow-lg transition-all"
            >
              <span className="text-lg">↗️</span>
              <span>Поделиться</span>
            </button>
            
            <button
              onClick={handleCopyLink}
              className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:shadow-sm flex items-center gap-3 font-medium transition-all"
            >
              <span className="text-lg">📋</span>
              <span>Копировать</span>
            </button>
          </div>
        </div>
      </div>

      {/* Детальная статистика */}
      <div className="bg-white border rounded-xl p-4 shadow-sm">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 text-lg">
          <span>📊</span>
          Детальная статистика
        </h3>
        
        <div className="space-y-6">
          {/* Общая вовлеченность */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <div>
                <span className="text-sm font-medium text-gray-700">Общая вовлеченность</span>
                <div className="text-xs text-gray-500">комментарии + реакции</div>
              </div>
              <span className="text-lg font-bold text-green-600">
                {getEngagementPercentage()}%
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-500"
                style={{ 
                  width: `${parsePercentage(getEngagementPercentage())}%` 
                }}
              />
            </div>
          </div>

          {/* Распределение реакций */}
          {totalReactions > 0 && (
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-4">Распределение реакций</h4>
              <div className="space-y-3">
                {reactions
                  .filter(r => r.count > 0)
                  .sort((a, b) => b.count - a.count)
                  .map((reaction) => {
                    const percentage = totalReactions > 0 ? (reaction.count / totalReactions) * 100 : 0
                    const isUserReaction = currentUserReaction === reaction.emoji
                    
                    return (
                      <div key={reaction.emoji} className="flex items-center gap-4">
                        <div className={`text-2xl ${isUserReaction ? 'scale-110' : ''}`}>
                          {reaction.emoji}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{reaction.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">{reaction.count}</span>
                              <span className="text-gray-500 text-xs">({percentage.toFixed(1)}%)</span>
                            </div>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })
                }
              </div>
            </div>
          )}

          {/* Показатели эффективности */}
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-4">Показатели эффективности</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Среднее время</div>
                <div className="text-lg font-bold text-gray-900">{calculateReadingTime()}</div>
                <div className="text-xs text-gray-500 mt-1">чтения поста</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-500 mb-1">Взаимодействие</div>
                <div className="text-lg font-bold text-gray-900">
                  {comments + totalReactions}
                </div>
                <div className="text-xs text-gray-500 mt-1">комментарии + реакции</div>
              </div>
            </div>
          </div>

          {/* Статус подписки */}
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Уведомления</h4>
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-blue-800">Подписка на уведомления</div>
                  <div className="text-sm text-blue-600 mt-1">
                    {isSubscribed 
                      ? 'Вы получаете уведомления о новых комментариях на email'
                      : 'Подпишитесь, чтобы получать уведомления о новых комментариях'
                    }
                  </div>
                </div>
                <div className="text-lg">
                  {isSubscribed ? '🔔' : '🔕'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}