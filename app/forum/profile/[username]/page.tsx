'use client'

import { notFound, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getUserByUsername } from '@/app/lib/api/forum'
import { createPrivateChat } from '@/app/lib/api/chat'
import { getCurrentUser } from '@/app/lib/api/user'
import { useEffect, useState } from 'react'
import { User } from '@/app/lib/types'

type Props = {
  params: { username: string }
}

export default function ForumProfilePage({ params }: Props) {
  const [user, setUser] = useState<User | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const [userData, currentUserData] = await Promise.all([
          getUserByUsername(params.username),
          getCurrentUser()
        ])
        
        if (userData) {
          setUser(userData)
        } else {
          notFound()
        }
        
        if (currentUserData) {
          setCurrentUser(currentUserData)
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [params.username])

  const router = useRouter()

  const handleStartChat = async () => {
    if (!user) return

    try {
      const chat = await createPrivateChat(user.id)
      router.push(`/chat/${chat.id}`)
    } catch (error) {
      console.error('Error creating chat:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return notFound()
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header профиля */}
      <section className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center gap-6">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.username || ''}
              className="w-24 h-24 rounded-full border-4 border-white shadow-lg"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold border-4 border-white shadow-lg">
              {user.name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">
                {user.username || `${user.name || ''} ${user.surname || ''}`.trim()}
              </h1>
              {user.isPremium && (
                <span className="px-3 py-1 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white text-xs font-bold rounded-full">
                  PRO
                </span>
              )}
            </div>
            
            <p className="text-gray-600 mb-4">{user.bio || 'Нет описания профиля'}</p>
            
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{user._count?.forumPosts || 0}</span>
                <span className="text-gray-500">Постов</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{user._count?.forumComments || 0}</span>
                <span className="text-gray-500">Комментариев</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{user._count?.forumFollowers || 0}</span>
                <span className="text-gray-500">Подписчиков</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{user._count?.forumFollowing || 0}</span>
                <span className="text-gray-500">Подписок</span>
              </div>
              
              {currentUser && user.id !== currentUser.id && (
                <div className="flex items-center gap-2">
                  <button
                    className="py-3 px-12 rounded-lg bg-purple-400 cursor-pointer text-white hover:bg-purple-500 duration-200"
                    onClick={handleStartChat}
                  >
                    Написать
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Посты пользователя */}
      <section className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Посты пользователя</h2>
          <span className="text-sm text-gray-500">
            Всего: {Array.isArray(user.forumPosts) ? user.forumPosts.length : 0}
          </span>
        </div>

        {!Array.isArray(user.forumPosts) || user.forumPosts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">Пользователь еще не создал ни одного поста</p>
            <Link 
              href="/forum" 
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Перейти к форуму →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {user.forumPosts.map((post: any) => (
              <Link
                key={post.id}
                href={`/forum/post/${post.id}`}
                className="block border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600">
                    {post.title}
                  </h3>
                  {post.category?.slug && (
                    <Link 
                      href={`/forum/category/${post.category.slug}`}
                      className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full"
                    >
                      {post.category?.title || 'Без категории'}
                    </Link>
                  )}
                </div>
                
                <p className="text-gray-600 mb-3 line-clamp-2">
                  {post.content?.replace(/<[^>]*>/g, '').substring(0, 200) || ''}...
                </p>
                
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {post.viewsCount || 0} просмотров
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      {post._count?.comments || 0} комментариев
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905a3.61 3.61 0 01-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                      </svg>
                      {post._count?.reactions || 0} реакций
                    </span>
                  </div>
                  
                  <span className="text-gray-400">
                    {post.createdAt ? new Date(post.createdAt).toLocaleDateString('ru-RU') : ''}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Комментарии пользователя */}
      <section className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold mb-6">Последние комментарии</h2>
        
        {!Array.isArray(user.forumComments) || user.forumComments.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Нет комментариев</p>
        ) : (
          <div className="space-y-4">
            {user.forumComments.map((comment: any) => (
              <div key={comment.id} className="border border-gray-200 rounded-lg p-4">
                <Link 
                  href={`/forum/post/${comment.post?.id}`}
                  className="text-sm font-medium text-gray-900 hover:text-blue-600 mb-2 inline-block"
                >
                  {comment.post?.title || 'Без названия'}
                </Link>
                
                <p className="text-gray-700 mb-2 line-clamp-3">
                  {comment.content?.replace(/<[^>]*>/g, '') || ''}
                </p>
                
                <span className="text-sm text-gray-400">
                  {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}