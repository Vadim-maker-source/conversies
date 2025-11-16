'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  getChatDetails, 
  updateChat, 
  addUsersToChat, 
  removeUserFromChat, 
  leaveChat, 
  deleteChat, 
  updateChatMemberRole,
  updateChatAvatar,
  uploadAvatar,
  joinChat
} from '@/app/lib/api/chat'
import { searchUsers } from '@/app/lib/api/chat'
import { getCurrentUser } from '@/app/lib/api/user'
import { User } from '@/app/lib/types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faDownLong, 
  faEdit, 
  faUpLong, 
  faUserMinus, 
  faEllipsisVertical,
  faCamera,
  faTimes,
  faUserPlus,
  faSignInAlt,
  faHashtag,
  faUsers
} from '@fortawesome/free-solid-svg-icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function ChatDataPage() {
  const params = useParams()
  const router = useRouter()
  const chatId = Number(params.id)

  const [chat, setChat] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName] = useState('')
  const [showAddUsers, setShowAddUsers] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [searching, setSearching] = useState(false)
  const [showAvatarMenu, setShowAvatarMenu] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const avatarMenuRef = useRef<HTMLDivElement>(null)
  const avatarContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const [chatData, userData] = await Promise.all([
          getChatDetails(chatId),
          getCurrentUser()
        ])

        if (!chatData) {
          setError('Чат не найден')
          return
        }

        setChat(chatData)
        setCurrentUser(userData)
        setNewName(chatData.name || '')
      } catch (error) {
        console.error('Error loading chat data:', error)
        setError('Ошибка загрузки данных чата')
      } finally {
        setLoading(false)
      }
    }

    if (chatId) {
      loadData()
    }
  }, [chatId])

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target as Node)) {
        setShowAvatarMenu(false)
      }
    }

    if (showAvatarMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAvatarMenu])

  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([])
        return
      }

      setSearching(true)
      try {
        const results = await searchUsers(searchQuery)
        const existingUserIds = new Set(chat?.members.map((m: any) => m.userId) || [])
        const filteredResults = results.filter(user => 
          !existingUserIds.has(user.id) && user.id !== currentUser?.id
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
  }, [searchQuery, chat, currentUser])

  const handleAvatarClick = () => {
    if (canManage) {
      setShowAvatarMenu(!showAvatarMenu)
    }
  }

  const handleFileInputClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !chat) return

    setUploadingAvatar(true)
    try {
      const uploadResult = await uploadAvatar(file)
      
      // Обновляем аватар чата
      const updatedChat = await updateChatAvatar(chat.id, uploadResult.url)
      setChat(updatedChat)
      setShowAvatarMenu(false)
    } catch (error) {
      console.error('Error uploading avatar:', error)
      setError(error instanceof Error ? error.message : 'Ошибка при загрузке аватара')
    } finally {
      setUploadingAvatar(false)
      // Сбрасываем input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveAvatar = async () => {
    if (!chat) return

    setUploadingAvatar(true)
    try {
      const updatedChat = await updateChatAvatar(chat.id, '')
      setChat(updatedChat)
      setShowAvatarMenu(false)
    } catch (error) {
      console.error('Error removing avatar:', error)
      setError(error instanceof Error ? error.message : 'Ошибка при удалении аватара')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleUpdateChat = async () => {
    if (!chat) return

    setActionLoading(true)
    try {
      const updatedChat = await updateChat(chat.id, { name: newName })
      setChat(updatedChat)
      setEditingName(false)
    } catch (error) {
      console.error('Error updating chat:', error)
      setError(error instanceof Error ? error.message : 'Ошибка при обновлении чата')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddUser = async (user: User) => {
    if (!chat) return

    setActionLoading(true)
    try {
      const updatedChat = await addUsersToChat(chat.id, [user.id])
      setChat(updatedChat)
      setSearchQuery('')
      setSearchResults([])
    } catch (error) {
      console.error('Error adding user:', error)
      setError(error instanceof Error ? error.message : 'Ошибка при добавлении пользователя')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveUser = async (userId: number) => {
    if (!chat) return

    setActionLoading(true)
    try {
      const updatedChat = await removeUserFromChat(chat.id, userId)
      setChat(updatedChat)
    } catch (error) {
      console.error('Error removing user:', error)
      setError(error instanceof Error ? error.message : 'Ошибка при удалении пользователя')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdateRole = async (userId: number, newRole: 'ADMIN' | 'MEMBER') => {
    if (!chat) return

    setActionLoading(true)
    try {
      const updatedChat = await updateChatMemberRole(chat.id, userId, newRole)
      setChat(updatedChat)
    } catch (error) {
      console.error('Error updating role:', error)
      setError(error instanceof Error ? error.message : 'Ошибка при изменении роли')
    } finally {
      setActionLoading(false)
    }
  }

  const handleLeaveChat = async () => {
    if (!chat) return

    if (!confirm('Вы уверены, что хотите покинуть этот чат?')) {
      return
    }

    setActionLoading(true)
    try {
      await leaveChat(chat.id)
      router.push('/')
    } catch (error) {
      console.error('Error leaving chat:', error)
      setError(error instanceof Error ? error.message : 'Ошибка при выходе из чата')
      setActionLoading(false)
    }
  }

  const handleDeleteChat = async () => {
    if (!chat) return

    if (!confirm('Вы уверены, что хотите удалить этот чат? Это действие нельзя отменить.')) {
      return
    }

    setActionLoading(true)
    try {
      await deleteChat(chat.id)
      router.push('/')
    } catch (error) {
      console.error('Error deleting chat:', error)
      setError(error instanceof Error ? error.message : 'Ошибка при удалении чата')
      setActionLoading(false)
    }
  }

  const handleJoinChat = async () => {
    if (!chat) return

    setActionLoading(true)
    try {
      await joinChat(chat.id)
      // Перезагружаем данные чата
      const updatedChat = await getChatDetails(chat.id)
      setChat(updatedChat)
    } catch (error) {
      console.error('Error joining chat:', error)
      setError(error instanceof Error ? error.message : 'Ошибка при вступлении в чат')
    } finally {
      setActionLoading(false)
    }
  }

  // Функции для отображения
  const getDisplayName = (user: User) => {
    if (user.name && user.surname) {
      return `${user.name} ${user.surname}`
    }
    return user.name || user.surname || user.email
  }

  const getUserInitials = (user: User) => {
    if (user.avatar) {
      return <img src={user.avatar} alt={String(user.name)} className="w-10 h-10 rounded-full object-cover" />
    }
    const first = user.name?.[0]?.toUpperCase() || ''
    const second = user.surname?.[0]?.toUpperCase() || ''
    return first + second || user.email[0].toUpperCase()
  }

  const getChatAvatar = () => {
    if (chat.avatar) {
      return (
        <img 
          src={chat.avatar} 
          alt={chat.name || 'Чат'} 
          className="w-16 h-16 rounded-full object-cover border-2 border-gray-600"
        />
      )
    }
    return (
      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg border-2 border-gray-600">
        {chat.name?.[0]?.toUpperCase() || 'Г'}
      </div>
    )
  }

  const getCurrentUserRole = () => {
    if (!chat || !currentUser) return null
    return chat.members.find((member: any) => member.userId === currentUser.id)?.role
  }

  const isOwner = getCurrentUserRole() === 'OWNER'
  const isAdmin = getCurrentUserRole() === 'ADMIN'
  const canManage = isOwner || isAdmin
  const isMember = getCurrentUserRole() !== null

  const getRoleText = (role: string) => {
    switch (role) {
      case 'OWNER': return 'Владелец'
      case 'ADMIN': return 'Админ'
      case 'MEMBER': return 'Участник'
      default: return role
    }
  }

  // Компонент Dropdown Menu для управления участником
  const MemberDropdownMenu = ({ member }: { member: any }) => {
    const isCurrentUser = member.userId === currentUser?.id
    
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button 
            className="p-2 hover:bg-gray-600/30 rounded-lg transition-colors"
            disabled={actionLoading}
          >
            <FontAwesomeIcon 
              icon={faEllipsisVertical} 
              className="w-4 h-4 text-gray-400 hover:text-white" 
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48 bg-gray-800 border-gray-700 text-white z-50">
          {isOwner && member.role !== 'OWNER' && (
            <>
              {member.role === 'ADMIN' ? (
                <DropdownMenuItem 
                  onClick={() => handleUpdateRole(member.userId, 'MEMBER')}
                  disabled={actionLoading}
                  className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700"
                >
                  <FontAwesomeIcon icon={faDownLong} className="w-4 h-4 text-yellow-400" />
                  <span>Снять администратора</span>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem 
                  onClick={() => handleUpdateRole(member.userId, 'ADMIN')}
                  disabled={actionLoading}
                  className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700"
                >
                  <FontAwesomeIcon icon={faUpLong} className="w-4 h-4 text-purple-400" />
                  <span>Назначить администратором</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-gray-600" />
              <DropdownMenuItem 
                onClick={() => handleRemoveUser(member.userId)}
                disabled={actionLoading}
                className="flex items-center space-x-2 cursor-pointer text-red-400 hover:bg-gray-700 hover:text-red-300"
              >
                <FontAwesomeIcon icon={faUserMinus} className="w-4 h-4" />
                <span>Удалить из чата</span>
              </DropdownMenuItem>
            </>
          )}
          
          {isAdmin && !isOwner && member.role === 'MEMBER' && !isCurrentUser && (
            <DropdownMenuItem 
              onClick={() => handleRemoveUser(member.userId)}
              disabled={actionLoading}
              className="flex items-center space-x-2 cursor-pointer text-red-400 hover:bg-gray-700 hover:text-red-300"
            >
              <FontAwesomeIcon icon={faUserMinus} className="w-4 h-4" />
              <span>Удалить из чата</span>
            </DropdownMenuItem>
          )}
          
          {((!isOwner && !isAdmin) || (isAdmin && member.role !== 'MEMBER') || isCurrentUser) && (
            <DropdownMenuItem className="text-gray-400 cursor-not-allowed">
              Нет доступных действий
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black/40 flex items-center justify-center w-full">
        <div className="text-white text-xl">Загрузка...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black/40 flex items-center justify-center w-full">
        <div className="text-white text-xl">{error}</div>
      </div>
    )
  }

  if (!chat) {
    return (
      <div className="min-h-screen bg-black/40 flex items-center justify-center w-full">
        <div className="text-white text-xl">Чат не найден</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black/40 p-4 w-full relative">
      <div className="w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 text-white hover:text-gray-300 transition-colors px-3 py-2 rounded-lg hover:bg-white/10"
          >
            <span>←</span>
            <span>Назад</span>
          </button>
          <h1 className="text-2xl font-bold text-white">
            {chat.isChannel ? 'Данные канала' : 'Данные чата'}
          </h1>
          <div className="w-10"></div>
        </div>

        {/* Основная информация */}
        <div className="bg-black/40 rounded-xl p-6 backdrop-blur-sm mb-4 border border-gray-700 relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              {/* Аватар с возможностью редактирования */}
              <div className="relative" ref={avatarContainerRef}>
                <div className="relative group">
                  {getChatAvatar()}
                  {canManage && (
                    <button
                      onClick={handleAvatarClick}
                      className="absolute inset-0 w-16 h-16 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer border-2 border-white/30"
                    >
                      <FontAwesomeIcon icon={faCamera} className="w-5 h-5 text-white" />
                    </button>
                  )}
                </div>

                {/* Меню выбора аватара */}
                {showAvatarMenu && (
                  <>
                    <div 
                      className="fixed inset-0 bg-black/20 z-40"
                      onClick={() => setShowAvatarMenu(false)}
                    />
                    
                    <div 
                      ref={avatarMenuRef}
                      className="absolute top-full left-0 mt-2 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl z-50 min-w-48 overflow-hidden"
                    >
                      <div className="p-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileInputChange}
                          accept="image/*"
                          className="hidden"
                        />
                        <button
                          onClick={handleFileInputClick}
                          disabled={uploadingAvatar}
                          className="w-full px-4 py-3 text-left text-white hover:bg-gray-700 rounded-lg flex items-center space-x-3 disabled:opacity-50 cursor-pointer transition-colors"
                        >
                          <FontAwesomeIcon icon={faCamera} className="w-4 h-4 text-blue-400" />
                          <span className="flex-1">
                            {uploadingAvatar ? 'Загрузка...' : 'Загрузить фото'}
                          </span>
                        </button>
                        
                        {chat.avatar && (
                          <>
                            <div className="h-px bg-gray-600 my-2"></div>
                            <button
                              onClick={handleRemoveAvatar}
                              disabled={uploadingAvatar}
                              className="w-full px-4 py-3 text-left text-red-400 hover:bg-gray-700 rounded-lg flex items-center space-x-3 disabled:opacity-50 cursor-pointer transition-colors"
                            >
                              <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
                              <span className="flex-1">Удалить фото</span>
                            </button>
                          </>
                        )}
                        
                        <div className="h-px bg-gray-600 my-2"></div>
                        <button
                          onClick={() => setShowAvatarMenu(false)}
                          className="w-full px-4 py-3 text-left text-gray-400 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
                        >
                          Отмена
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div>
                {editingName ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="bg-gray-700 text-white px-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Введите название чата"
                    />
                    <button
                      onClick={handleUpdateChat}
                      disabled={actionLoading}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {actionLoading ? '...' : 'OK'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingName(false)
                        setNewName(chat.name || '')
                      }}
                      className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer"
                    >
                      Отмена
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <h2 className="text-2xl font-bold text-white">
                      {chat.name || (chat.isChannel ? 'Без названия' : 'Групповой чат')}
                    </h2>
                    {canManage && (
                      <button
                        onClick={() => setEditingName(true)}
                        className="text-gray-400 hover:text-white transition-colors cursor-pointer p-2 hover:bg-white/10 rounded-lg"
                      >
                        <FontAwesomeIcon icon={faEdit} className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
                <p className="text-gray-400 mt-1">
                  {chat.isChannel ? 'Канал' : 'Групповой чат'} • {chat.memberCount} участников
                  {chat.isPrivate && ' • Приватный'}
                </p>
              </div>
            </div>
          </div>

          {/* Действия */}
          <div className="flex space-x-3">
            {isMember === null ? (
              // Кнопка "Вступить" для не участников
              <button
                onClick={handleJoinChat}
                disabled={actionLoading}
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 cursor-pointer font-medium flex items-center space-x-2"
              >
                <FontAwesomeIcon icon={faSignInAlt} className="w-4 h-4" />
                <span>{actionLoading ? 'Вступление...' : 'Вступить'}</span>
              </button>
            ) : (
              // Действия для участников
              <>
                {canManage && (
                  <button
                    onClick={() => setShowAddUsers(true)}
                    className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors cursor-pointer font-medium flex items-center space-x-2"
                  >
                    <FontAwesomeIcon icon={faUserPlus} className="w-4 h-4" />
                    <span>Добавить участников</span>
                  </button>
                )}
                {isOwner ? (
                  <button
                    onClick={handleDeleteChat}
                    disabled={actionLoading}
                    className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 cursor-pointer font-medium"
                  >
                    {actionLoading ? 'Удаление...' : 'Удалить чат'}
                  </button>
                ) : (
                  <button
                    onClick={handleLeaveChat}
                    disabled={actionLoading}
                    className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 cursor-pointer font-medium"
                  >
                    {actionLoading ? 'Выход...' : 'Покинуть чат'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Список участников - показывается только для участников */}
        {isMember && (
          <div className="bg-black/40 rounded-xl p-6 backdrop-blur-sm border border-gray-700 relative z-0">
            <h3 className="text-white font-medium mb-4 text-lg">Участники ({chat.memberCount})</h3>
            <div className="space-y-3">
              {chat.members.map((member: any) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl hover:bg-gray-700/50 transition-colors border border-gray-600/50"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow">
                      {getUserInitials(member.user)}
                    </div>
                    <div>
                      <p className="font-medium text-white">
                        {getDisplayName(member.user)}
                      </p>
                      <p className="text-xs text-gray-400">{member.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-sm capitalize px-3 py-1 rounded-full text-white ${
                      member.role === 'OWNER' 
                        ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' 
                        : member.role === 'ADMIN'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                    }`}>
                      {getRoleText(member.role)}
                    </span>
                    
                    {(isOwner && member.role !== 'OWNER') || 
                     (isAdmin && !isOwner && member.role === 'MEMBER' && member.userId !== currentUser?.id) ? (
                      <MemberDropdownMenu member={member} />
                    ) : (
                      <div className="w-10"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Информация для не участников */}
        {!isMember && (
          <div className="bg-black/40 rounded-xl p-6 backdrop-blur-sm border border-gray-700 relative z-0">
            <div className="text-center py-8">
              <FontAwesomeIcon 
                icon={chat.isChannel ? faHashtag : faUsers} 
                className="w-16 h-16 text-gray-400 mb-4" 
              />
              <h3 className="text-white text-xl font-medium mb-2">
                {chat.isChannel ? 'Публичный канал' : 'Публичный чат'}
              </h3>
              <p className="text-gray-400 mb-6">
                {chat.isChannel 
                  ? 'В каналах только администраторы могут отправлять сообщения' 
                  : 'В групповых чатах все участники могут писать'
                }
              </p>
              <p className="text-gray-400 text-sm">
                Участников: {chat.memberCount} • Сообщений: {chat.messageCount || 0}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Модальное окно добавления участников */}
      {showAddUsers && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl w-full max-w-md max-h-[80vh] flex flex-col border border-gray-700">
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Добавить участников</h2>
                <button
                  onClick={() => setShowAddUsers(false)}
                  className="text-gray-400 hover:text-white transition-colors cursor-pointer p-2 hover:bg-white/10 rounded-lg"
                >
                  ✕
                </button>
              </div>
              
              <div className="relative mt-3">
                <input
                  type="text"
                  placeholder="Поиск пользователей..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-600"
                />
                {searching && (
                  <div className="absolute right-3 top-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleAddUser(user)}
                      disabled={actionLoading}
                      className="w-full p-3 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center space-x-3 cursor-pointer border border-gray-600/50"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
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
              ) : (
                <p className="text-gray-400 text-center py-4">
                  {searchQuery ? 'Пользователи не найдены' : 'Начните вводить имя для поиска'}
                </p>
              )}
            </div>

            <div className="p-4 border-t border-gray-700">
              <button
                onClick={() => setShowAddUsers(false)}
                className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors cursor-pointer font-medium"
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}