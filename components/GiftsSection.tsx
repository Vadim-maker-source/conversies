'use client'

import { useState, useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faCoins, faGift, faUsers, faShare, faSearch, faTimes, faCheck } from '@fortawesome/free-solid-svg-icons'
import { 
  getReceivedGifts, 
  getSentGifts, 
  getUserCoins, 
  getUsersForGifting, 
  sendGift, 
  redeemGift, 
  regiftGift 
} from '@/app/lib/api/gifts'
import { gifts, getGiftImagePath, type GiftData } from '@/app/lib/gifts-data'
import { searchUsers } from '@/app/lib/api/chat'
import { toast } from 'sonner'

interface Gift {
  id: number
  giftId: number
  price: number
  message: string | null
  status: string
  createdAt: Date
  sender?: {
    id: number
    name: string | null
    surname: string | null
    avatar: string | null
  }
  receiver?: {
    id: number
    name: string | null
    surname: string | null
    avatar: string | null
  }
}

interface User {
  id: number
  name: string | null
  surname: string | null
  avatar: string | null
  isPremium: boolean
  email: string
}

export function GiftsSection({ settings, onBack, message, loading }: any) {
  const [activeTab, setActiveTab] = useState<'received' | 'sent' | 'send'>('received')
  const [receivedGifts, setReceivedGifts] = useState<Gift[]>([])
  const [sentGifts, setSentGifts] = useState<Gift[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [coins, setCoins] = useState(0)
  const [selectedGift, setSelectedGift] = useState<GiftData | null>(null)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [giftMessage, setGiftMessage] = useState('')
  const [regiftUser, setRegiftUser] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)

  useEffect(() => {
    loadGiftsData()
  }, [])

  const loadGiftsData = async () => {
    const [received, sent, userCoins, userList] = await Promise.all([
      getReceivedGifts(),
      getSentGifts(),
      getUserCoins(),
      getUsersForGifting()
    ])
    
    setReceivedGifts(received)
    setSentGifts(sent)
    setCoins(userCoins)
    setUsers(userList)
  }

  const handleSendGift = async () => {
    if (!selectedGift || !selectedUser) return
    
    setActionLoading(true)
    const result = await sendGift(selectedUser.id, selectedGift.id, giftMessage)
    
    if (result.success) {
      await loadGiftsData()
      setSelectedGift(null)
      setSelectedUser(null)
      setGiftMessage('')
      setActiveTab('sent')
      toast.success("Успешно отправлен подарок!")
    }
    setActionLoading(false)
  }

  const handleRedeemGift = async (giftId: number) => {
    setActionLoading(true)
    const result = await redeemGift(giftId)
    
    if (result.success) {
      await loadGiftsData()
      toast.success("Успешно отправлен подарок!")
    }
    setActionLoading(false)
  }

  const handleRegift = async (giftId: number) => {
    if (!regiftUser) return
    
    setActionLoading(true)
    const result = await regiftGift(giftId, regiftUser.id, giftMessage)
    
    if (result.success) {
      await loadGiftsData()
      setRegiftUser(null)
      setGiftMessage('')
    }
    setActionLoading(false)
  }

  const handleUserSelect = (user: User) => {
    setSelectedUser(user)
    setIsUserModalOpen(false)
  }

  const getUserAvatar = (user: any) => {
    if (user.avatar) {
      return <img src={user.avatar} alt="Avatar" className="w-8 h-8 rounded-full" />
    }
    return (
      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
        {user.name?.[0]?.toUpperCase()}{user.surname?.[0]?.toUpperCase()}
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-white">Подарки</h2>
        <div className="flex items-center space-x-2 bg-purple-500/20 px-4 py-2 rounded-lg">
          <FontAwesomeIcon icon={faCoins} className="w-5 h-5 text-yellow-400" />
          <span className="text-white font-bold text-lg">{coins}</span>
        </div>
      </div>

      {/* Табы */}
      <div className="flex space-x-4 mb-6 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('received')}
          className={`pb-3 px-4 font-medium transition-colors ${
            activeTab === 'received' 
              ? 'text-purple-400 border-b-2 border-purple-400' 
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <FontAwesomeIcon icon={faGift} className="w-4 h-4 mr-2" />
          Мне подарили ({receivedGifts.length})
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`pb-3 px-4 font-medium transition-colors ${
            activeTab === 'sent' 
              ? 'text-purple-400 border-b-2 border-purple-400' 
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <FontAwesomeIcon icon={faUsers} className="w-4 h-4 mr-2" />
          Подаренные мной ({sentGifts.length})
        </button>
        <button
          onClick={() => setActiveTab('send')}
          className={`pb-3 px-4 font-medium transition-colors ${
            activeTab === 'send' 
              ? 'text-purple-400 border-b-2 border-purple-400' 
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <FontAwesomeIcon icon={faShare} className="w-4 h-4 mr-2" />
          Подарить
        </button>
      </div>

      {/* Контент табов */}
      <div className="bg-black/40 rounded-xl p-6 backdrop-blur-sm border border-gray-700">
        {activeTab === 'received' && (
          <div>
            <h3 className="text-xl font-semibold text-white mb-4">Полученные подарки</h3>
            {receivedGifts.length === 0 ? (
              <p className="text-gray-400 text-center py-8">У вас пока нет полученных подарков</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {receivedGifts.map((gift) => (
                  <div key={gift.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-600">
                    <div className="flex items-center space-x-3 mb-3">
                      {gift.sender && getUserAvatar(gift.sender)}
                      <div>
                        <p className="text-white font-medium">
                          {gift.sender?.name} {gift.sender?.surname}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {new Date(gift.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-center mb-3">
                      <img 
                        src={getGiftImagePath(gift.giftId)} 
                        alt="Gift" 
                        className="w-full aspect-square mx-auto mb-2"
                      />
                      <p className="text-yellow-400 font-bold">{gift.price} <FontAwesomeIcon icon={faCoins} className="w-5 h-5 text-yellow-400" /></p>
                      {gift.message && (
                        <p className="text-gray-300 text-sm mt-1">"{gift.message}"</p>
                      )}
                    </div>

                    <div className="flex space-x-2">
                      {gift.status === 'ACTIVE' && (
                        <>
                          <button
                            onClick={() => handleRedeemGift(gift.id)}
                            disabled={actionLoading}
                            className="flex-1 bg-green-500 text-white py-2 px-3 rounded text-sm hover:bg-green-600 disabled:opacity-50"
                          >
                            Обналичить
                          </button>
                          <button
                            onClick={() => setRegiftUser(gift)}
                            disabled={actionLoading}
                            className="flex-1 bg-purple-500 text-white py-2 px-3 rounded text-sm hover:bg-purple-600 disabled:opacity-50"
                          >
                            Подарить
                          </button>
                        </>
                      )}
                      {gift.status === 'REDEEMED' && (
                        <span className="flex-1 bg-gray-600 text-white py-2 px-3 rounded text-sm text-center">
                          Обналичен
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'sent' && (
          <div>
            <h3 className="text-xl font-semibold text-white mb-4">Подаренные мной</h3>
            {sentGifts.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Вы еще не дарили подарки</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sentGifts.map((gift) => (
                  <div key={gift.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-600">
                    <div className="flex items-center space-x-3 mb-3">
                      {gift.receiver && getUserAvatar(gift.receiver)}
                      <div>
                        <p className="text-white font-medium">
                          {gift.receiver?.name} {gift.receiver?.surname}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {new Date(gift.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <img 
                        src={getGiftImagePath(gift.giftId)} 
                        alt="Gift" 
                        className="w-full aspect-square mx-auto mb-2"
                      />
                      <p className="text-yellow-400 font-bold">{gift.price} <FontAwesomeIcon icon={faCoins} className="w-5 h-5 text-yellow-400" /></p>
                      {gift.message && (
                        <p className="text-gray-300 text-sm mt-1">"{gift.message}"</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'send' && (
          <div>
            <h3 className="text-xl font-semibold text-white mb-4">Подарить подарок</h3>
            
            {/* Выбор пользователя */}
            <div className="mb-6">
              <label className="block text-white text-sm font-medium mb-2">
                Выберите пользователя
              </label>
              
              {/* Кнопка выбора пользователя */}
              <button
                onClick={() => setIsUserModalOpen(true)}
                className="w-full flex items-center justify-between p-4 rounded-lg border border-gray-600 bg-gray-800/50 hover:border-purple-400/50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  {selectedUser ? (
                    <>
                      {getUserAvatar(selectedUser)}
                      <div className="text-left">
                        <p className="text-white font-medium">
                          {selectedUser.name} {selectedUser.surname}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {selectedUser.isPremium && '⭐ Premium'}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                        <FontAwesomeIcon icon={faSearch} className="w-4 h-4 text-gray-400" />
                      </div>
                      <span className="text-gray-400">Нажмите чтобы выбрать пользователя</span>
                    </>
                  )}
                </div>
                <FontAwesomeIcon icon={faSearch} className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Выбор подарка */}
            {selectedUser && (
              <div className="mb-6">
                <label className="block text-white text-sm font-medium mb-2">
                  Выберите подарок (ваш баланс: {coins} монет)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-120 overflow-y-auto">
                  {gifts.map((gift) => (
                    <button
                      key={gift.id}
                      onClick={() => setSelectedGift(gift)}
                      disabled={coins < gift.price}
                      className={`flex flex-col items-center p-3 rounded-lg border transition-colors cursor-pointer ${
                        selectedGift?.id === gift.id 
                          ? 'border-purple-500 bg-purple-500/20' 
                          : coins < gift.price
                            ? 'border-gray-700 bg-gray-900/50 opacity-50 cursor-not-allowed'
                            : 'border-gray-600 bg-gray-800/50 hover:border-purple-400/50'
                      }`}
                    >
                      <img 
                        src={getGiftImagePath(gift.id)} 
                        alt={gift.name}
                        className="w-48 aspect-square mb-2"
                      />
                      <p className="text-white text-sm font-medium text-center">
                        {gift.name}
                      </p>
                      <p className="text-yellow-400 text-xs">
                        {gift.price} монет
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Сообщение и кнопка отправки */}
            {selectedGift && (
              <div className="space-y-4">
                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    Сообщение с подарком (необязательно)
                  </label>
                  <textarea
                    value={giftMessage}
                    onChange={(e) => setGiftMessage(e.target.value)}
                    placeholder="Напишите сообщение..."
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-600"
                    rows={3}
                  />
                </div>

                <button
                  onClick={handleSendGift}
                  disabled={actionLoading || !selectedUser || !selectedGift}
                  className="w-full bg-purple-500 text-white py-3 px-4 rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium cursor-pointer"
                >
                  {actionLoading ? 'Отправка...' : `Подарить за ${selectedGift.price} монет`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Модальное окно для передарения */}
      {regiftUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-white text-lg font-semibold mb-4">Передать подарок</h3>
            
            <div className="mb-4">
              <label className="block text-white text-sm font-medium mb-2">
                Выберите пользователя для передарения
              </label>
              <div className="grid gap-2 max-h-48 overflow-y-auto">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => setRegiftUser(user)}
                    className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                      regiftUser?.id === user.id 
                        ? 'border-purple-500 bg-purple-500/20' 
                        : 'border-gray-600 bg-gray-800/50 hover:border-purple-400/50'
                    }`}
                  >
                    {getUserAvatar(user)}
                    <div className="text-left">
                      <p className="text-white font-medium">
                        {user.name} {user.surname}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-white text-sm font-medium mb-2">
                Сообщение (необязательно)
              </label>
              <textarea
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
                placeholder="Напишите сообщение..."
                className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-600"
                rows={2}
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setRegiftUser(null)}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={() => handleRegift(regiftUser.id)}
                disabled={actionLoading || !regiftUser}
                className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'Передача...' : 'Передать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно выбора пользователя */}
      <UserSelectionModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        onSelect={handleUserSelect}
        currentUserId={0} // Здесь нужно передать ID текущего пользователя
      />
    </div>
  )
}

// Компонент модального окна выбора пользователя
interface UserSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (user: User) => void
  currentUserId: number
}

function UserSelectionModal({ isOpen, onClose, onSelect, currentUserId }: UserSelectionModalProps) {
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
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }

      const timeout = setTimeout(async () => {
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

      searchTimeoutRef.current = timeout
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
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