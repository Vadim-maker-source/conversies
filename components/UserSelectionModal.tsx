'use client'

import { useState, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faTimes, faCheck } from '@fortawesome/free-solid-svg-icons'
import { searchUsers } from '@/app/lib/api/chat'

interface User {
  id: number
  name: string | null
  surname: string | null
  avatar: string | null
  isPremium: boolean
  email: string
}

interface UserSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (user: User) => void
  currentUserId: number
}

export function UserSelectionModal({ isOpen, onClose, onSelect, currentUserId }: UserSelectionModalProps) {
  const [users, setUsers] = useState<User[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('')
      setSelectedUser(null)
      setUsers([])
    }
  }, [isOpen])

  useEffect(() => {
    if (searchTerm.trim()) {
      // Дебаунс поиска
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }

      searchTimeoutRef.current = setTimeout(async () => {
        setLoading(true)
        try {
          const foundUsers = await searchUsers(searchTerm)
          setUsers(foundUsers)
        } catch (error) {
          console.error('Error searching users:', error)
          setUsers([])
        } finally {
          setLoading(false)
        }
      }, 300)
    } else {
      setUsers([])
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchTerm])

  const handleUserSelect = (user: User) => {
    setSelectedUser(user)
  }

  const handleConfirm = () => {
    if (selectedUser) {
      onSelect(selectedUser)
      onClose()
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
    }
  }

  const getUserAvatar = (user: User) => {
    if (user.avatar) {
      return <img src={user.avatar} alt="Avatar" className="w-10 h-10 rounded-full" />
    }
    return (
      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
        {user.name?.[0]?.toUpperCase()}{user.surname?.[0]?.toUpperCase()}
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-white text-lg font-semibold">Выберите пользователя</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-700">
          <div className="relative">
            <FontAwesomeIcon 
              icon={faSearch} 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" 
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Введите имя, фамилию или email..."
              className="w-full pl-10 pr-4 py-2 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-600"
              autoFocus
            />
          </div>
          <p className="text-gray-400 text-sm mt-2">
            Начните вводить для поиска пользователей
          </p>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            </div>
          ) : searchTerm && users.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              Пользователи не найдены
            </div>
          ) : !searchTerm ? (
            <div className="text-center py-8 text-gray-400">
              Введите имя, фамилию или email для поиска
            </div>
          ) : (
            <div className="p-2">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleUserSelect(user)}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg mb-2 transition-colors ${
                    selectedUser?.id === user.id 
                      ? 'bg-purple-500/20 border-2 border-purple-500' 
                      : 'bg-gray-700/50 hover:bg-gray-600/50 border-2 border-transparent'
                  }`}
                >
                  {getUserAvatar(user)}
                  <div className="flex-1 text-left">
                    <p className="text-white font-medium">
                      {user.name} {user.surname}
                    </p>
                    <p className="text-gray-400 text-sm">
                      {user.email}
                    </p>
                    {user.isPremium && (
                      <p className="text-yellow-400 text-xs">⭐ Premium</p>
                    )}
                  </div>
                  {selectedUser?.id === user.id && (
                    <FontAwesomeIcon icon={faCheck} className="w-5 h-5 text-green-400" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedUser}
              className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Выбрать
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}