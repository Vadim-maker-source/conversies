'use client'

import { useState } from 'react'
import { togglePostSubscription, togglePinPost } from '@/app/lib/api/forum'
import { useRouter } from 'next/navigation'

interface PostActionsProps {
  postId: number
  isAuthor: boolean
  isPinned: boolean
  isLocked: boolean
}

export default function PostActions({ postId, isAuthor, isPinned, isLocked }: PostActionsProps) {
  const router = useRouter()
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubscribe = async () => {
    setIsLoading(true)
    try {
      const result = await togglePostSubscription(postId)
      if (result.success && result.subscribed !== undefined) {
        setIsSubscribed(result.subscribed)
      }
    } catch (error) {
      console.error('Error toggling subscription:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePin = async () => {
    if (!isAuthor) return
    
    setIsLoading(true)
    try {
      const result = await togglePinPost(postId)
      if (result.success) {
        router.refresh()
      }
    } catch (error) {
      console.error('Error toggling pin:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: document.title,
        text: 'Посмотрите этот пост на форуме',
        url: window.location.href,
      })
    } else {
      navigator.clipboard.writeText(window.location.href)
      alert('Ссылка скопирована в буфер обмена!')
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* Подписка */}
      <button
        onClick={handleSubscribe}
        disabled={isLoading}
        className={`px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all ${
          isSubscribed
            ? 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200'
            : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
        }`}
      >
        {isSubscribed ? '🔔' : '🔕'}
        {isSubscribed ? 'Вы подписаны' : 'Подписаться'}
      </button>

      {/* Поделиться */}
      <button
        onClick={handleShare}
        className="px-4 py-2 bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-medium hover:bg-blue-200 flex items-center gap-2 transition-all"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        Поделиться
      </button>

      {/* Закрепить (только для автора) */}
      {isAuthor && (
        <button
          onClick={handlePin}
          disabled={isLoading}
          className={`px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all ${
            isPinned
              ? 'bg-yellow-100 text-yellow-700 border border-yellow-200 hover:bg-yellow-200'
              : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
          }`}
        >
          {isPinned ? '📌' : '📄'}
          {isPinned ? 'Открепить' : 'Закрепить'}
        </button>
      )}

      {/* Редактировать (только для автора) */}
      {isAuthor && (
        <button
          onClick={() => router.push(`/forum/post/${postId}/edit`)}
          className="px-4 py-2 bg-purple-100 text-purple-700 border border-purple-200 rounded-xl font-medium hover:bg-purple-200 flex items-center gap-2 transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Редактировать
        </button>
      )}
    </div>
  )
}