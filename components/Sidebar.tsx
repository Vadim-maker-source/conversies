'use client'

import { getCurrentUser } from '@/app/lib/api/user'
import { User, ChatWithDetails, Message, ChatMember, Chat } from '@/app/lib/types'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createPrivateChat, getUserChats, searchAll } from '@/app/lib/api/chat'
import { Separator } from './ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { signOut } from 'next-auth/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faArrowRight, faSearch, faUsers, faUser, faHashtag } from '@fortawesome/free-solid-svg-icons'
import { Unbounded } from 'next/font/google'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { useChatStore } from '@/store/chatStore'

export type SearchUser = {
  id: number
  name: string | null
  surname: string | null
  email: string
  phone: string | null
  avatar: string | null
  isPremium: boolean
  createdAt: Date
  updatedAt: Date
}

export type SearchChat = Chat & {
  members: (ChatMember & {
    user: SearchUser
  })[]
  isUserMember: boolean
  lastMessage?: Message
  memberCount?: number
  messageCount?: number
}

export type SearchResults = {
  users: SearchUser[]
  chats: SearchChat[]
}

export default function Sidebar() {
  const isMobile = useIsMobile()
  const [isExpanded, setIsExpanded] = useState(true)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResults>({ users: [], chats: [] })
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const router = useRouter()

  const { chats, fetchChats } = useChatStore()

  useEffect(() => {
    async function loadData() {
      try {
        const user = await getCurrentUser()
        setCurrentUser(user)
        fetchChats()
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults({ users: [], chats: [] })
        return
      }
  
      setSearching(true)
      try {
        const results = await searchAll(searchQuery)
        // Приводим типы к SearchResults
        setSearchResults(results as unknown as SearchResults)
      } catch (error) {
        console.error('Error searching:', error)
        setSearchResults({ users: [], chats: [] })
      } finally {
        setSearching(false)
      }
    }
  
    const timeoutId = setTimeout(performSearch, 300)
    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded)
  }

  const handleUserSelect = async (user: SearchUser) => {
    try {
      const chat = await createPrivateChat(user.id)
      setSearchQuery('')
      setSearchResults({ users: [], chats: [] })
      router.push(`/chat/${chat.id}`)
    } catch (error) {
      console.error('Error creating chat:', error)
    }
  }

  const handleChatSelect = (chat: SearchChat) => {
    if (chat.isUserMember) {
      // Если пользователь уже участник - переходим в чат
      router.push(`/chat/${chat.id}`)
    } else {
      // Если не участник - переходим на страницу информации о чате/канале
      router.push(`/chat-data/${chat.id}`)
    }
    setSearchQuery('')
    setSearchResults({ users: [], chats: [] })
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/sign-in')
  }
  
  const handleCreateChat = () => {
    router.push('/create-chat')
  }

  const getChatName = (chat: ChatWithDetails | SearchChat) => {
    if (chat.type === 'GROUP') {
      return chat.name || 'Групповой чат'
    }

    const otherMember = chat.members.find(member => member.userId !== currentUser?.id)
    return otherMember ? `${otherMember.user.name} ${otherMember.user.surname}` : 'Приватный чат'
  }

  const getChatAvatar = (chat: ChatWithDetails | SearchChat) => {
    if (chat.type === 'GROUP') {
      if(chat.type === 'GROUP' && chat.avatar) return <img src={String(chat.avatar)} alt="" className="rounded-full h-full w-full" />
      else return '👥' 
    }

    const otherMember = chat.members.find(member => member.userId !== currentUser?.id)
    if(otherMember?.user.avatar){
      return <img src={otherMember.user.avatar} alt="" className="rounded-full" />
    }
    if (otherMember?.user) {
      return `${otherMember.user.name?.[0]?.toUpperCase()}${otherMember.user.surname?.[0]?.toUpperCase()}` || '👤'
    }
    
    return '👤'
  }

  const getLastMessagePreview = (chat: ChatWithDetails) => {
    if (!chat.lastMessage) return 'Нет сообщений'
    
    const sender = chat.lastMessage.userId === currentUser?.id ? 'Вы: ' : ''
    return `${sender}${chat.lastMessage.content}`
  }

  const getUserInitials = (user: User | SearchUser) => {
    if(user.avatar){
        return <img src={user.avatar} alt={String(user.name)} className="rounded-full" />
    }
    if(!user.email) return null
    const first = user.name?.[0]?.toUpperCase() || ''
    const second = user.surname?.[0]?.toUpperCase() || ''
    return first + second || user.email[0].toUpperCase()
  }

  const getSearchResultIcon = (item: SearchUser | SearchChat) => {
    if ('email' in item) {
      // Это пользователь
      return <FontAwesomeIcon icon={faUser} className="w-4 h-4" />
    } else {
      // Это чат/канал
      if (item.isChannel) {
        return <FontAwesomeIcon icon={faHashtag} className="w-4 h-4" />
      } else {
        return <FontAwesomeIcon icon={faUsers} className="w-4 h-4" />
      }
    }
  }

  const getSearchResultName = (item: SearchUser | SearchChat) => {
    if ('email' in item) {
      // Это пользователь
      return `${item.name || ''} ${item.surname || ''}`.trim() || item.email
    } else {
      // Это чат/канал
      return getChatName(item)
    }
  }

  const getSearchResultDescription = (item: SearchUser | SearchChat) => {
    if ('email' in item) {
      // Это пользователь
      return item.email
    } else {
      // Это чат/канал
      if (item.isChannel) {
        return `Канал • ${item.memberCount || 0} участников`
      } else {
        return `Чат • ${item.memberCount || 0} участников`
      }
    }
  }

  if (loading) {
    return (
      <div className={`bg-black/40 text-white transition-all duration-500 ease-in-out ${isExpanded ? 'w-72' : 'w-28'} min-h-screen flex flex-col`}>
        <div className="p-4 flex items-center justify-center">
          <div className="animate-pulse bg-gray-600 h-8 w-8 rounded"></div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse">Загрузка...</div>
        </div>
      </div>
    )
  }

  const hasSearchResults = searchResults.users.length > 0 || searchResults.chats.length > 0

  return (
    <div className={`bg-black/40 max-h-screen text-white transition-all duration-500 ease-in-out ${isExpanded ? 'w-72' : 'w-28'} min-h-screen flex flex-col`}>
      {/* Header */}
      <div className="px-4 pb-2 pt-4 flex items-center justify-between">
        <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0 overflow-hidden'}`}>
          <h1 className={`text-xl font-bold whitespace-nowrap logo_font`}>Conversies</h1>
        </div>
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-gray-700/40 transition-all duration-300 flex-shrink-0 cursor-pointer"
          title={isExpanded ? 'Свернуть' : 'Развернуть'}
        >
          <FontAwesomeIcon 
            icon={faArrowLeft} 
            className={`transition-transform duration-500 ease-in-out ${isExpanded ? 'rotate-0' : 'rotate-180'}`}
          />
        </button>
      </div>

      {/* Поиск */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="p-4">
          <div className="relative">
            <FontAwesomeIcon 
              icon={faSearch} 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" 
            />
            <input
              type="text"
              placeholder="Поиск пользователей, чатов, каналов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 rounded-3xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-600 duration-200"
            />
            {searching && (
              <div className="absolute right-3 top-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              </div>
            )}
          </div>
          
          {/* Результаты поиска */}
          {hasSearchResults && (
            <div className="absolute z-50 mt-2 w-64 bg-gray-800 rounded-lg shadow-xl border border-gray-700 max-h-80 overflow-y-auto">
              {/* Пользователи */}
              {searchResults.users.length > 0 && (
                <div className="p-2">
                  <div className="px-3 py-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Пользователи
                  </div>
                  {searchResults.users.map((user) => (
                    <button
                      key={`user-${user.id}`}
                      onClick={() => handleUserSelect(user)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-700 rounded-lg flex items-center space-x-3 transition-colors"
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {getUserInitials(user)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-white">
                          {user.name} {user.surname}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                      </div>
                      <FontAwesomeIcon icon={faUser} className="w-3 h-3 text-gray-400" />
                    </button>
                  ))}
                </div>
              )}

              {/* Чаты и каналы */}
              {searchResults.chats.length > 0 && (
                <div className="p-2">
                  <div className="px-3 py-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Чаты и каналы
                  </div>
                  {searchResults.chats.map((chat) => (
                    <button
                      key={`chat-${chat.id}`}
                      onClick={() => handleChatSelect(chat)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-700 rounded-lg flex items-center space-x-3 transition-colors"
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {getChatAvatar(chat)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-white">
                          {getChatName(chat)}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {getSearchResultDescription(chat)}
                        </p>
                        {!chat.isUserMember && (
                          <span className="inline-block mt-1 text-xs text-blue-400">
                            Присоединиться
                          </span>
                        )}
                      </div>
                      {chat.isChannel ? (
                        <FontAwesomeIcon icon={faHashtag} className="w-3 h-3 text-purple-400" />
                      ) : (
                        <FontAwesomeIcon icon={faUsers} className="w-3 h-3 text-blue-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {searchQuery && !searching && !hasSearchResults && (
            <div className="absolute z-50 mt-2 w-64 bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-4">
              <p className="text-gray-400 text-center">Ничего не найдено</p>
            </div>
          )}

          <div className="w-full flex items-center justify-center mt-4">
            <Separator className="bg-gray-500" />
          </div>
        </div>
      </div>

      {/* Список чатов */}
      <div className="flex-1 overflow-y-scroll max-h-full">
        {isExpanded ? (
          <div className="p-2">
            {chats.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <p>Нет чатов</p>
                <p className="text-sm mt-1">Начните общение через поиск</p>
              </div>
            ) : (
              chats.map((chat) => (
                <a
                  key={chat.id}
                  href={`/chat/${chat.id}`}
                  className="flex items-center p-3 rounded-lg hover:bg-gray-600/40 transition-colors mb-1"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {getChatAvatar(chat)}
                  </div>
                  <div className="ml-3 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium truncate">
                        {getChatName(chat)}
                      </p>
                      {chat.lastMessage && (
                        <span className="text-xs text-gray-400">
                          {new Date(chat.lastMessage.createdAt).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 truncate">
                      {getLastMessagePreview(chat)}
                    </p>
                    {chat.type === 'GROUP' && chat.isChannel && (
                      <span className="inline-block mt-1 px-2 py-1 text-xs bg-purple-500 text-white rounded-full">
                        Канал
                      </span>
                    )}
                  </div>
                </a>
              ))
            )}
          </div>
        ) : (
          <div className="p-2">
            {chats.map((chat) => (
              <a
                key={chat.id}
                href={`/chat/${chat.id}`}
                className="flex items-center justify-center p-3 rounded-lg hover:bg-gray-700 transition-colors mb-1"
                title={getChatName(chat)}
              >
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {getChatAvatar(chat)}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className={`w-full flex items-center justify-center transition-all duration-300 ease-in-out ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
        <Separator className="bg-gray-500" />
      </div>

      {/* User Info */}
      <div className="p-4">
        {currentUser ? (
          <div className={`flex items-center ${isExpanded ? 'justify-between' : 'justify-center'}`}>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                {getUserInitials(currentUser)}
              </div>
              
              <div className={`ml-3 flex-1 min-w-0 transition-all duration-300 ease-in-out ${isExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0 overflow-hidden'}`}>
                <p className="font-medium truncate">
                  {currentUser.name} {currentUser.surname}
                </p>
                <p className="text-sm text-gray-400 truncate">
                  {currentUser.email}
                </p>
                {currentUser.isPremium && (
                  <span className="inline-block mt-1 px-2 py-1 text-xs bg-yellow-500 text-yellow-900 rounded-full">
                    PREMIUM
                  </span>
                )}
              </div>
            </div>

            <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0 overflow-hidden'}`}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                    <img 
                      src="/assets/dots.svg" 
                      alt="Меню" 
                      className="w-5 h-5 filter invert"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        e.currentTarget.parentElement!.innerHTML = '⋮'
                      }}
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48 bg-gray-800 border-gray-700 text-white">
                  <DropdownMenuItem 
                    onClick={handleCreateChat}
                    className="cursor-pointer hover:bg-gray-700"
                  >
                    <span>+</span>
                    <span>Создать чат/канал</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => router.push('/settings')}
                    className="cursor-pointer hover:bg-gray-700"
                  >
                    ⚙️ Настройки
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-gray-600" />
                  <DropdownMenuItem 
                    onClick={handleLogout}
                    className="cursor-pointer text-red-400 hover:bg-gray-700 hover:text-red-300"
                  >
                    🚪 Выйти
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ) : (
          <div className={`flex items-center ${isExpanded ? 'justify-start' : 'justify-center'}`}>
            <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
              <span className="text-lg">👤</span>
            </div>
            <div className={`ml-3 transition-all duration-300 ease-in-out ${isExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0 overflow-hidden'}`}>
              <p className="font-medium">Гость</p>
              <p className="text-sm text-gray-400">Не авторизован</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}