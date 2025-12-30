'use client'

import { useState } from 'react'
import { addForumComment } from '@/app/lib/api/forum'
import CommentItem from './CommentItem'

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
  user: {
    id: number
    name: string | null
    username: string | null
  }
}

interface Comment {
  id: number
  content: string
  authorId: number
  author: CommentAuthor
  replies: Comment[]
  reactions: CommentReaction[]
  createdAt: Date
  isEdited?: boolean
  parentId?: number | null
}

interface CommentSectionProps {
  postId: number
  initialComments: any[] // Используем any для гибкости
}

export default function CommentSection({ postId, initialComments }: CommentSectionProps) {
  // Приводим initialComments к правильному типу
  const typedComments: Comment[] = initialComments.map(comment => ({
    ...comment,
    replies: comment.replies || [],
    reactions: comment.reactions || []
  }))

  const [comments, setComments] = useState<Comment[]>(typedComments)
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setIsSubmitting(true)
    
    try {
      const result = await addForumComment({
        postId,
        content: newComment,
        parentId: replyingTo || undefined
      })

      if (result.success && result.comment) {
        const newCommentObj: Comment = {
          id: result.comment.id,
          content: result.comment.content,
          authorId: result.comment.authorId,
          author: {
            id: result.comment.authorId,
            name: null,
            username: null,
            avatar: null,
            isPremium: false
          },
          replies: [],
          reactions: [],
          createdAt: result.comment.createdAt,
          parentId: replyingTo || null
        }

        if (replyingTo) {
          // Добавляем ответ к родительскому комментарию
          setComments(prev => 
            prev.map(comment => {
              if (comment.id === replyingTo) {
                return {
                  ...comment,
                  replies: [...(comment.replies || []), newCommentObj]
                }
              }
              return comment
            })
          )
        } else {
          // Добавляем новый комментарий
          setComments(prev => [newCommentObj, ...prev])
        }

        setNewComment('')
        setReplyingTo(null)
      }
    } catch (error) {
      console.error('Error adding comment:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReply = (commentId: number) => {
    setReplyingTo(commentId)
    // Прокрутка к форме комментария
    document.getElementById('comment-form')?.scrollIntoView({ behavior: 'smooth' })
  }

  const sortedComments = [...comments].sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    } else {
      // Сортировка по популярности (количество реакций + ответов)
      const aPopularity = (a.reactions?.length || 0) + (a.replies?.length || 0)
      const bPopularity = (b.reactions?.length || 0) + (b.replies?.length || 0)
      return bPopularity - aPopularity
    }
  })

  return (
    <div className="bg-white rounded-xl border p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">
          Комментарии ({comments.length})
        </h2>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Сортировать:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'popular')}
            className="text-sm border rounded px-3 py-1"
          >
            <option value="newest">Сначала новые</option>
            <option value="popular">По популярности</option>
          </select>
        </div>
      </div>

      {/* Форма комментария */}
      <form id="comment-form" onSubmit={handleSubmit} className="mb-6">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={replyingTo ? "Ваш ответ..." : "Напишите комментарий..."}
          className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          rows={3}
          disabled={isSubmitting}
        />
        
        <div className="flex justify-between items-center mt-3">
          {replyingTo && (
            <div className="text-sm text-gray-600">
              Ответ на комментарий #{replyingTo}
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="ml-2 text-red-600 hover:text-red-800"
              >
                ✕ Отмена
              </button>
            </div>
          )}
          
          <button
            type="submit"
            disabled={isSubmitting || !newComment.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                Отправка...
              </>
            ) : (
              replyingTo ? 'Ответить' : 'Отправить'
            )}
          </button>
        </div>
      </form>

      {/* Список комментариев */}
      {sortedComments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-4">💬</div>
          <p className="text-lg mb-2">Пока нет комментариев</p>
          <p className="text-sm">Будьте первым, кто оставит комментарий!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedComments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onReply={handleReply}
              depth={0}
            />
          ))}
        </div>
      )}
    </div>
  )
}