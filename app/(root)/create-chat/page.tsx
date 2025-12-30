'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { searchUsers, createGroupChat, createChannel } from '@/app/lib/api/chat'
import { getUserContacts } from '@/app/lib/api/contacts'
import { User, Contact } from '@/app/lib/types'

export default function CreateChatPage() {
  const [chatType, setChatType] = useState<'GROUP' | 'CHANNEL'>('GROUP')
  const [name, setName] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [searching, setSearching] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (isModalOpen) {
      loadContacts()
    }
  }, [isModalOpen])

  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([])
        return
      }

      setSearching(true)
      try {
        const results = await searchUsers(searchQuery)
        const filteredResults = results.filter(user => 
          !selectedUsers.find(selected => selected.id === user.id)
        )
        setSearchResults(filteredResults)
      } catch (error) {
        console.error('Error searching users:', error)
      } finally {
        setSearching(false)
      }
    }

    const timeoutId = setTimeout(performSearch, 300)
    return () => clearTimeout(timeoutId)
  }, [searchQuery, selectedUsers])

  const loadContacts = async () => {
    try {
      const userContacts = await getUserContacts()
      setContacts(userContacts)
    } catch (error) {
      console.error('Error loading contacts:', error)
    }
  }

  const openModal = () => {
    setIsModalOpen(true)
    setSearchQuery('')
    setSearchResults([])
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSearchQuery('')
    setSearchResults([])
  }

  const handleUserSelect = (user: User) => {
    if (!selectedUsers.find(selected => selected.id === user.id)) {
      setSelectedUsers(prev => [...prev, user])
    }
  }

  const removeUser = (userId: number) => {
    setSelectedUsers(prev => prev.filter(user => user.id !== userId))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!name.trim()) {
        throw new Error('Введите название')
      }

      if (selectedUsers.length === 0) {
        throw new Error('Добавьте хотя бы одного участника')
      }

      const userIds = selectedUsers.map(user => user.id)
      
      let chat
      if (chatType === 'CHANNEL') {
        chat = await createChannel(name, userIds, isPrivate)
      } else {
        chat = await createGroupChat(name, userIds, false, isPrivate)
      }

      router.push(`/chat/${chat.id}`)
    } catch (error) {
      console.error('Error creating chat:', error)
      setError(error instanceof Error ? error.message : 'Ошибка при создании чата')
    } finally {
      setLoading(false)
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
    if(!user.email) return null
    return first + second || user.email[0].toUpperCase()
  }

  const getContactDisplayName = (contact: Contact) => {
    return contact.name || getDisplayName(contact.contact)
  }

  return (
    <div className="min-h-screen w-full p-4">
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
          <h1 className="text-2xl font-bold text-white">
            Создать {chatType === 'CHANNEL' ? 'канал' : 'чат'}
          </h1>
          <div className="w-10"></div>
        </div>

        {/* Форма */}
        <div className="bg-black/40 rounded-xl p-6 backdrop-blur-sm">
          {error && (
            <div className="p-3 bg-red-500/20 text-red-300 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Выбор типа */}
            <div>
              <label className="block text-white text-sm font-medium mb-3">
                Тип
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setChatType('GROUP')}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    chatType === 'GROUP'
                      ? 'border-blue-500 bg-blue-500/20 text-white'
                      : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <div className="text-2xl mb-2">👥</div>
                  <div className="font-medium">Групповой чат</div>
                  <div className="text-xs mt-1">Все участники могут писать</div>
                </button>
                
                <button
                  type="button"
                  onClick={() => setChatType('CHANNEL')}
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    chatType === 'CHANNEL'
                      ? 'border-purple-500 bg-purple-500/20 text-white'
                      : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <div className="text-2xl mb-2">📢</div>
                  <div className="font-medium">Канал</div>
                  <div className="text-xs mt-1">Только админы пишут</div>
                </button>
              </div>
            </div>

            {/* Название */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Название {chatType === 'CHANNEL' ? 'канала' : 'чата'} *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`Введите название ${chatType === 'CHANNEL' ? 'канала' : 'чата'}`}
                required
              />
            </div>

            {/* Настройка приватности (видимости в поиске) */}
            <div className="bg-gray-700/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-white text-sm font-medium mb-1">
                    Публичный {chatType === 'CHANNEL' ? 'канал' : 'чат'}
                  </label>
                  <p className="text-gray-400 text-xs">
                    {isPrivate 
                      ? 'Приватный - нельзя найти в поиске' 
                      : 'Публичный - можно найти в поиске'
                    }
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPrivate(!isPrivate)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isPrivate ? 'bg-gray-600' : 'bg-green-500'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isPrivate ? 'translate-x-1' : 'translate-x-6'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Участники */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Участники *
              </label>
              
              {/* Кнопка выбора участников */}
              <button
                type="button"
                onClick={openModal}
                className="w-full px-3 py-3 bg-gray-700 rounded-lg text-white hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 text-left"
              >
                <div className="flex items-center justify-between">
                  <span>Выбрать участников</span>
                  <span className="text-gray-400">→</span>
                </div>
              </button>

              {/* Выбранные пользователи */}
              {selectedUsers.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-gray-400">Выбранные участники:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center space-x-2 bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full"
                      >
                        <span className="text-sm">
                          {getDisplayName(user)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeUser(user.id)}
                          className="text-blue-400 hover:text-blue-200 text-lg"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Кнопка создания */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Создание...' : `Создать ${chatType === 'CHANNEL' ? 'канал' : 'чат'}`}
            </button>
          </form>

          {/* Информация */}
          <div className="mt-6 p-4 bg-gray-700/30 rounded-lg">
            <h3 className="text-white font-medium mb-2">Информация:</h3>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• <strong>{chatType === 'CHANNEL' ? 'Канал' : 'Групповой чат'}:</strong> {chatType === 'CHANNEL' ? 'только администраторы могут писать' : 'все участники могут писать'}</li>
              <li>• <strong>Видимость:</strong> {isPrivate ? 'приватный (не виден в поиске)' : 'публичный (виден в поиске)'}</li>
              <li>• Вы будете владельцем созданного {chatType === 'CHANNEL' ? 'канала' : 'чата'}</li>
              <li>• Минимум 1 участник кроме вас</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Модальное окно выбора участников */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl w-full max-w-md max-h-[80vh] flex flex-col">
            {/* Заголовок */}
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Выберите участников</h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              
              {/* Поиск */}
              <div className="relative mt-3">
                <input
                  type="text"
                  placeholder="Поиск пользователей..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {searching && (
                  <div className="absolute right-3 top-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Список пользователей */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Результаты поиска */}
              {searchQuery && searchResults.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-gray-400 text-sm font-medium mb-2">Результаты поиска</h3>
                  <div className="space-y-2">
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleUserSelect(user)}
                        disabled={selectedUsers.some(selected => selected.id === user.id)}
                        className="w-full p-3 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3"
                      >
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {getUserInitials(user)}
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-white">
                            {getDisplayName(user)}
                          </p>
                          <p className="text-xs text-gray-400">{user.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Контакты */}
              {!searchQuery && (
                <div>
                  <h3 className="text-gray-400 text-sm font-medium mb-2">Мои контакты</h3>
                  <div className="space-y-2">
                    {contacts.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => handleUserSelect(contact.contact)}
                        disabled={selectedUsers.some(selected => selected.id === contact.contact.id)}
                        className="w-full p-3 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3"
                      >
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {getUserInitials(contact.contact)}
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-white">
                            {getContactDisplayName(contact)}
                          </p>
                          <p className="text-xs text-gray-400">{contact.contact.email}</p>
                        </div>
                      </button>
                    ))}
                    
                    {contacts.length === 0 && (
                      <p className="text-gray-400 text-center py-4">
                        У вас пока нет контактов
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Сообщение, если ничего не найдено */}
              {searchQuery && searchResults.length === 0 && !searching && (
                <p className="text-gray-400 text-center py-4">
                  Пользователи не найдены
                </p>
              )}
            </div>

            {/* Футер модального окна */}
            <div className="p-4 border-t border-gray-700">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">
                  Выбрано: {selectedUsers.length}
                </span>
                <button
                  onClick={closeModal}
                  className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Готово
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}