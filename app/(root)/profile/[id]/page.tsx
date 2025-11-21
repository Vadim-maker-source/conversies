'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getUserById } from '@/app/lib/api/user'
import { addContact, isUserInContacts, removeContact } from '@/app/lib/api/contacts'
import { createPrivateChat } from '@/app/lib/api/chat'
import { getCurrentUser } from '@/app/lib/api/user'
import { User } from '@/app/lib/types'
import { AnimateIcon } from '@/components/animate-ui/icons/icon'
import { MessageSquareMore } from '@/components/animate-ui/icons/message-square-more'
import { Plus } from '@/components/animate-ui/icons/plus'
import { Trash2 } from '@/components/animate-ui/icons/trash-2'

export default function ProfilePage() {
  const params = useParams()
  const router = useRouter()
  const userId = Number(params.id)

  const [user, setUser] = useState<User | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isContact, setIsContact] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const [userData, currentUserData] = await Promise.all([
          getUserById(userId),
          getCurrentUser()
        ])

        if (!userData) {
          setError('Пользователь не найден')
          return
        }

        setUser(userData)
        setCurrentUser(currentUserData)

        if (currentUserData) {
          const inContacts = await isUserInContacts(userId)
          setIsContact(inContacts)
        }
      } catch (error) {
        console.error('Error loading profile:', error)
        setError('Ошибка загрузки профиля')
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      loadData()
    }
  }, [userId])

  const handleAddContact = async () => {
    if (!user) return
  
    if (currentUser && currentUser.id === user.id) {
      setError('Нельзя добавить самого себя в контакты')
      return
    }
  
    setActionLoading(true)
    try {
      await addContact(user.id)
      setIsContact(true)
    } catch (error) {
      console.error('Error adding contact:', error)
      setError(error instanceof Error ? error.message : 'Ошибка при добавлении в контакты')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveContact = async () => {
    if (!user) return

    setActionLoading(true)
    try {
      await removeContact(user.id)
      setIsContact(false)
    } catch (error) {
      console.error('Error removing contact:', error)
      setError('Ошибка при удалении из контактов')
    } finally {
      setActionLoading(false)
    }
  }

  const handleStartChat = async () => {
    if (!user) return

    setActionLoading(true)
    try {
      const chat = await createPrivateChat(user.id)
      router.push(`/chat/${chat.id}`)
    } catch (error) {
      console.error('Error creating chat:', error)
      setError('Ошибка при создании чата')
      setActionLoading(false)
    }
  }

  const getDisplayName = (user: User) => {
    if (user.name && user.surname) {
      return `${user.name} ${user.surname}`
    }
    return user.name || user.surname || user.email
  }

  const getUserInitials = (user: User) => {
    const first = user.name?.[0]?.toUpperCase() || ''
    const second = user.surname?.[0]?.toUpperCase() || ''
    return first + second || user.email[0].toUpperCase()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) || "Неизвестно"
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black/40 w-full flex items-center justify-center">
        <div className="text-white text-xl">Загрузка...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black/40 w-full flex items-center justify-center">
        <div className="text-white text-xl">{error}</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black/40 w-full flex items-center justify-center">
        <div className="text-white text-xl">Пользователь не найден</div>
      </div>
    )
  }

  const isOwnProfile = currentUser && currentUser.id === user.id

  return (
    <div className="min-h-screen bg-black/40 w-full p-4">
      <div className="w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 text-white hover:text-gray-300 transition-colors"
          >
            <span>←</span>
            <span>Назад</span>
          </button>
          <h1 className="text-2xl font-bold text-white">Профиль</h1>
          <div className="w-10"></div>
        </div>

        {/* Карточка профиля */}
        <div className="bg-black/40 rounded-xl p-6 backdrop-blur-sm">
          {error && (
            <div className="p-3 bg-red-500/20 text-red-300 rounded-lg mb-4">
              {error}
            </div>
          )}

          {/* Аватар и основная информация */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4">
              <img src={String(user.avatar)} alt={String(user.name)} className="rounded-full" />
            </div>
            <h2 className="text-2xl font-bold text-white text-center">
              {getDisplayName(user)}
            </h2>
            <p className="text-gray-400 mt-1">{user.email}</p>
            
            {user.isPremium && (
              <div className="mt-2 px-3 py-1 bg-yellow-500 text-yellow-900 rounded-full text-xs font-bold">
                PREMIUM
              </div>
            )}
          </div>

          <div className="flex flex-col text-white mb-6 py-3 px-5 bg-gray-500/40 rounded-2xl">
            <span className="text-blue-300 font-semibold">О себе:</span>
            <p>{user.bio}</p>
          </div>

          {/* Дополнительная информация */}
          <div className="space-y-4 mb-6">
            <div className="bg-gray-700/30 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">Информация</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Телефон:</span>
                  <span className="text-white">{user.phone || 'Не указан'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Статус:</span>
                  <span className="text-white">
                    {user.isPremium ? 'Premium' : 'Обычный'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Зарегистрирован:</span>
                  <span className="text-white">{formatDate(String(user.createdAt))}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Кнопки действий */}
          {!isOwnProfile && currentUser && (
            <div className="gap-3">
              {isContact ? (
                <AnimateIcon animateOnHover>
                <button
                  onClick={handleRemoveContact}
                  disabled={actionLoading}
                  className="w-full bg-purple-500 text-white py-3 px-4 rounded-lg hover:bg-purple-400 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {actionLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Trash2 />
                      <span>Удалить из контактов</span>
                    </>
                  )}
                </button>
                </AnimateIcon>
              ) : (
                <AnimateIcon animateOnHover>
                <button
                  onClick={handleAddContact}
                  disabled={actionLoading}
                  className="w-full bg-purple-500 text-white py-3 px-4 rounded-lg hover:bg-purple-400 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {actionLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                        <Plus />
                      <span>Добавить в контакты</span>
                    </>
                  )}
                </button>
                </AnimateIcon>
              )}
              
              <AnimateIcon animateOnHover>
              <button
                onClick={handleStartChat}
                disabled={actionLoading}
                className="w-full bg-red-500 mt-3.5 text-white py-3 px-4 rounded-lg hover:bg-red-400 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {actionLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                      <span><MessageSquareMore /></span>
                      <span>Написать сообщение</span>
                  </>
                )}
              </button>
              </AnimateIcon>
            </div>
          )}

          {isOwnProfile && (
            <div className="text-center text-gray-400 py-4">
              Это ваш профиль
            </div>
          )}

          {!currentUser && (
            <div className="text-center text-gray-400 py-4">
              Войдите в аккаунт, чтобы добавить в контакты или написать сообщение
            </div>
          )}
        </div>
      </div>
    </div>
  )
}