'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toggleForumReaction } from '@/app/lib/api/forum'
import ContentWithLinks from './ContentWithLinks'

// Определяем типы
interface CommentAuthor {
  id: number
  name: string | null
  username: string | null
  avatar: string | null
  isPremium: boolean
}

interface CommentReaction {
  id: number
  emoji: string
  userId: number
}

interface Comment {
  id: number
  content: string
  author: CommentAuthor
  replies?: Comment[]
  reactions?: CommentReaction[]
  createdAt: Date
  isEdited?: boolean
  postId?: number // Добавляем postId в комментарий
}

interface CommentItemProps {
  comment: Comment
  onReply: (id: number) => void
  depth: number
}

export default function CommentItem({ comment, onReply, depth }: CommentItemProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [reactions, setReactions] = useState<CommentReaction[]>(comment.reactions || [])
  const [userReaction, setUserReaction] = useState<string | null>(null)

  const handleReaction = async (emoji: string) => {
    try {
      const result = await toggleForumReaction({
        emoji,
        commentId: comment.id,
        postId: comment.postId // Используем postId из комментария
      })

      if (result.success) {
        if (userReaction === emoji) {
          // Удаляем реакцию
          setReactions(reactions.filter(r => r.emoji !== emoji))
          setUserReaction(null)
        } else {
          // Добавляем реакцию
          setReactions([...reactions, { 
            id: Date.now(), 
            emoji, 
            userId: 0
          }])
          setUserReaction(emoji)
        }
      }
    } catch (error) {
      console.error('Error toggling reaction:', error)
    }
  }

  const reactionEmojis = ['👍', '❤️', '🔥', '👏']
  
  const formatTime = (date: Date) => {
    const now = new Date()
    const commentDate = new Date(date)
    const diffMs = now.getTime() - commentDate.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) {
      return `${diffMins} мин. назад`
    } else if (diffHours < 24) {
      return `${diffHours} ч. назад`
    } else if (diffDays < 7) {
      return `${diffDays} дн. назад`
    } else {
      return commentDate.toLocaleDateString('ru-RU')
    }
  }

  const replies = comment.replies || []

  return (
    <div 
      className={`relative ${depth > 0 ? 'ml-4 md:ml-8 pl-4 border-l-2 border-gray-200' : ''}`}
      style={{ maxWidth: `calc(100% - ${depth * 1}rem)` }}
    >
      {/* Аватар и информация */}
      <div className="flex items-start gap-3">
        <Link 
          href={`/forum/profile/${comment.author.username}`}
          className="flex-shrink-0"
        >
          {comment.author.avatar ? (
            <img 
              src={comment.author.avatar} 
              alt={comment.author.username || ''}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold">
              {comment.author.name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
        </Link>

        <div className="flex-1 min-w-0">
          {/* Информация об авторе */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Link 
              href={`/forum/profile/${comment.author.username}`}
              className="font-semibold text-sm hover:text-blue-600"
            >
              {comment.author.username || comment.author.name}
            </Link>
            
            {comment.author.isPremium && (
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                PRO
              </span>
            )}
            
            <span className="text-xs text-gray-500">
              {formatTime(comment.createdAt)}
            </span>
            
            {comment.isEdited && (
              <span className="text-xs text-gray-500">(ред.)</span>
            )}
          </div>

          {/* Контент комментария */}
          <div className="text-gray-700 text-sm mb-3">
            <ContentWithLinks content={comment.content} />
          </div>

          {/* Действия */}
          <div className="flex items-center gap-4">
            {/* Реакции */}
            <div className="flex items-center gap-1">
              {reactionEmojis.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className={`p-1 text-lg hover:scale-110 transition-transform ${
                    reactions.some(r => r.emoji === emoji) ? 'opacity-100' : 'opacity-50 hover:opacity-75'
                  }`}
                >
                  {emoji}
                </button>
              ))}
              
              {reactions.length > 0 && (
                <span className="text-xs text-gray-500 ml-2">
                  {reactions.length}
                </span>
              )}
            </div>

            {/* Ответ */}
            <button
              onClick={() => onReply(comment.id)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Ответить
            </button>

            {/* Развернуть/свернуть ответы */}
            {replies.length > 0 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                {isExpanded ? 'Скрыть ответы' : `Показать ${replies.length} ответов`}
              </button>
            )}
          </div>

          {/* Ответы */}
          {isExpanded && replies.length > 0 && (
            <div className="mt-4 space-y-4">
              {replies.map(reply => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  onReply={onReply}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}