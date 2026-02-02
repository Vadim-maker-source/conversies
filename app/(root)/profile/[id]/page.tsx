'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getUserById } from '@/app/lib/api/user'
import { addContact, isUserInContacts, removeContact } from '@/app/lib/api/contacts'
import { createPrivateChat } from '@/app/lib/api/chat'
import { getCurrentUser } from '@/app/lib/api/user'
import { getUserStatus } from '@/app/lib/api/online-status'
import { User } from '@/app/lib/types'
import { AnimateIcon } from '@/components/animate-ui/icons/icon'
import { MessageSquareMore, Plus, Trash2, Check, X, Phone, Video, PhoneCall } from 'lucide-react'
import { getAudioFiles, getDocumentFiles, getMediaFiles } from '@/app/lib/api/profile-content'
// import { getCallHistory } from '@/app/lib/api/calls'
import { Calendar, Clock, Download, FileText, ImageIcon, Music, Play } from 'lucide-react'
import { toast } from 'sonner'

// Типы для медиафайлов
interface MediaFile {
  id: number
  url: string
  type: string
  createdAt: Date
  user: {
    id: number
    name: string | null
    surname: string | null
    avatar: string | null
  }
}

interface AudioFile {
  id: number
  url: string
  duration: number
  createdAt: Date
  user: {
    id: number
    name: string | null
    surname: string | null
    avatar: string | null
  }
}

interface DocumentFile {
  id: number
  url: string
  filename: string
  size: number
  createdAt: Date
  user: {
    id: number
    name: string | null
    surname: string | null
    avatar: string | null
  }
}

interface CallHistory {
  id: number
  type: 'audio' | 'video'
  status: string
  duration: number | null
  startTime: Date
  endTime: Date | null
  initiator: {
    id: number
    name: string | null
    surname: string | null
    avatar: string | null
  }
  participants: Array<{
    id: number
    name: string | null
    surname: string | null
    avatar: string | null
  }>
}

export default function ProfilePage() {
  const params = useParams()
  const router = useRouter()
  const userId = Number(params.id)

  const [user, setUser] = useState<User | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isContact, setIsContact] = useState(false)
  const [loading, setLoading] = useState(true)
  const [contentLoading, setContentLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [userStatus, setUserStatus] = useState<{ isOnline: boolean; lastSeen: Date; isRecentlyOnline: boolean } | null>(null)
  const [activeTab, setActiveTab] = useState<'media' | 'audio' | 'docs' | 'calls'>('media')
  
  // Состояния для контента
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([])
  const [documentFiles, setDocumentFiles] = useState<DocumentFile[]>([])
  const [callHistory, setCallHistory] = useState<CallHistory[]>([])

  // Загрузка данных профиля
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const [userData, currentUserData, status] = await Promise.all([
          getUserById(userId),
          getCurrentUser(),
          getUserStatus(userId)
        ])

        if (!userData) {
          setError('Пользователь не найден')
          return
        }

        setUser(userData)
        setCurrentUser(currentUserData)
        setUserStatus(status)

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

  // Загрузка контента при смене вкладки
  useEffect(() => {
    if (!currentUser || !user) return
  
    const loadContent = async () => {
      setContentLoading(true)
      try {
        switch (activeTab) {
          case 'media':
            const media = await getMediaFiles(userId) as any as MediaFile[]
            setMediaFiles(media.map(item => ({
              ...item,
              type: (item.type === 'video' ? 'video' : 'image') as 'image' | 'video'
            })))
            break
          case 'audio':
            const audio = await getAudioFiles(userId) as any as AudioFile[]
            setAudioFiles(audio)
            break
          case 'docs':
            const docs = await getDocumentFiles(userId) as any as DocumentFile[]
            setDocumentFiles(docs)
            break
          // case 'calls':
          //   const calls = await getCallHistory(userId) as any
          //   setCallHistory(calls.map((call: any) => ({
          //     ...call,
          //     participants: call.participants.map((p: any) => p.user)
          //   })))
          //   break
        }
      } catch (error) {
        console.error('Error loading content:', error)
      } finally {
        setContentLoading(false)
      }
    }
  
    loadContent()
  }, [activeTab, currentUser, user, userId])

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

  const handleAudioCall = () => {
    // Здесь будет логика для аудиозвонка
    console.log('Start audio call with', user?.id)
  }

  const handleVideoCall = () => {
    // Здесь будет логика для видеозвонка
    console.log('Start video call with', user?.id)
  }

  const getDisplayName = (user: User) => {
    if (user.name && user.surname) {
      return `${user.name} ${user.surname}`
    }
    return user.name || user.surname || user.email
  }

  const formatLastSeen = (lastSeen: Date) => {
    const now = new Date()
    const diff = now.getTime() - lastSeen.getTime()
    const diffMinutes = Math.floor(diff / (1000 * 60))
    const diffHours = Math.floor(diff / (1000 * 60 * 60))
    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (diffMinutes < 1) {
      return 'только что'
    } else if (diffMinutes < 60) {
      return `${diffMinutes} ${getMinutesWord(diffMinutes)} назад`
    } else if (diffHours < 24) {
      return `${diffHours} ${getHoursWord(diffHours)} назад`
    } else if (diffDays === 1) {
      return 'вчера'
    } else if (diffDays < 7) {
      return `${diffDays} ${getDaysWord(diffDays)} назад`
    } else {
      return lastSeen.toLocaleDateString('ru-RU')
    }
  }

  const getMinutesWord = (minutes: number) => {
    if (minutes % 10 === 1 && minutes % 100 !== 11) return 'минуту'
    if ([2, 3, 4].includes(minutes % 10) && ![12, 13, 14].includes(minutes % 100)) return 'минуты'
    return 'минут'
  }

  const getHoursWord = (hours: number) => {
    if (hours % 10 === 1 && hours % 100 !== 11) return 'час'
    if ([2, 3, 4].includes(hours % 10) && ![12, 13, 14].includes(hours % 100)) return 'часа'
    return 'часов'
  }

  const getDaysWord = (days: number) => {
    if (days % 10 === 1 && days % 100 !== 11) return 'день'
    if ([2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100)) return 'дня'
    return 'дней'
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (seconds: number) => {
    if (!seconds) return '00:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleCopyUsername = async () => {
    const textToCopy = `@${user?.username}`;
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success("Успешно скопировано!")
    } catch (err) {
      console.error('Ошибка при копировании:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900/20 to-black/40 w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900/20 to-black/40 w-full flex items-center justify-center">
        <div className="text-white text-xl">{error}</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900/20 to-black/40 w-full flex items-center justify-center">
        <div className="text-white text-xl">Пользователь не найден</div>
      </div>
    )
  }

  const isOwnProfile = currentUser && currentUser.id === user.id

  return (
    <div className="h-screen overflow-x-scroll overflow-y-none bg-gradient-to-b from-purple-900/20 to-black/40 w-full">
      <div className="relative">
        {/* Header с кнопкой назад */}
        <div className="absolute top-4 left-4 z-50">
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 text-white hover:text-gray-300 transition-colors px-4 py-2 rounded-lg hover:bg-white/10 backdrop-blur-sm"
          >
            <span>←</span>
            <span>Назад</span>
          </button>
        </div>

        {/* Шапка профиля с фоном */}
        <div className="relative h-72 overflow-hidden">
          {/* Фоновое изображение профиля */}
          {user.backgroundImage ? (
            <div 
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${user.backgroundImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/40 to-blue-600/40" />
          )}
          
          {/* Затемнение фона */}
          <div className="absolute inset-0 bg-black/40" />
          
          {/* Контент шапки */}
          <div className="relative h-full flex items-center px-8">
            <div className="flex items-center justify-between w-full">
              {/* Аватар и информация */}
              <div className="flex items-center space-x-6">
                {/* Контейнер аватара со статусом */}
                <div className="relative">
                  {/* Аватар */}
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/30 shadow-2xl">
                    {user.avatar ? (
                      <img 
                        src={user.avatar} 
                        alt={String(getDisplayName(user))}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white text-3xl font-bold">
                        {user.name?.[0]?.toUpperCase()}{user.surname?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  {/* Статус онлайн */}
                  <div className={`absolute bottom-2 right-2 w-8 h-8 rounded-full border-4 border-black/30 shadow-lg flex items-center justify-center ${
                    userStatus?.isOnline 
                      ? 'bg-green-500' 
                      : userStatus?.isRecentlyOnline 
                        ? 'bg-yellow-500' 
                        : 'bg-gray-500'
                  }`}>
                    {userStatus?.isOnline ? (
                      <Check className="w-4 h-4 text-white" />
                    ) : (
                      <X className="w-4 h-4 text-white" />
                    )}
                  </div>
                </div>

                {/* Имя и статус */}
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">
                    {getDisplayName(user)}
                  </h1>
                  
                  {/* Статус текст */}
                  <div className="flex items-center space-x-3">
                    <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                      userStatus?.isOnline 
                        ? 'bg-green-500/20 text-green-300' 
                        : userStatus?.isRecentlyOnline 
                          ? 'bg-yellow-500/20 text-yellow-300' 
                          : 'bg-gray-500/20 text-gray-300'
                    }`}>
                      {userStatus?.isOnline 
                        ? 'В сети' 
                        : userStatus?.isRecentlyOnline 
                          ? 'Был(а) недавно' 
                          : `Был(а) в сети ${formatLastSeen(userStatus?.lastSeen || new Date())}`}
                    </span>
                    
                    {user.isPremium && (
                      <span className="bg-gradient-to-r from-yellow-500 to-orange-500 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full">
                        PREMIUM
                      </span>
                    )}
                  </div>
                  
                  <p className="text-gray-300 mt-2">{user.email}</p>
                </div>
              </div>

              {/* Кнопки действий справа */}
              {!isOwnProfile && currentUser && (
                <div className="flex space-x-4">
                  {/* Группа кнопок чата/контакта */}
                  <div className="relative flex items-center bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                    {/* Эффект жидкого стекла для всей группы */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                    
                    {/* Кнопка написать */}
                    <AnimateIcon animateOnHover>
                      <button
                        onClick={handleStartChat}
                        disabled={actionLoading}
                        className="group relative flex items-center space-x-2 py-3 px-6 text-white hover:bg-white/5 transition-all duration-300 disabled:opacity-50"
                      >
                        <div className="relative z-10 flex items-center space-x-2">
                          {actionLoading ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <>
                              <MessageSquareMore className="w-5 h-5" />
                              <span className="font-medium">Написать</span>
                            </>
                          )}
                        </div>
                      </button>
                    </AnimateIcon>

                    {/* Вертикальный разделитель */}
                    <div className="w-px h-6 bg-white/20" />

                    {/* Кнопка добавления/удаления контакта */}
                    <AnimateIcon animateOnHover>
                      {isContact ? (
                        <button
                          onClick={handleRemoveContact}
                          disabled={actionLoading}
                          className="group relative flex items-center space-x-2 py-3 px-6 text-white hover:bg-white/5 transition-all duration-300 disabled:opacity-50"
                        >
                          <div className="relative z-10 flex items-center space-x-2">
                            {actionLoading ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <>
                                <Trash2 className="w-5 h-5" />
                                <span className="font-medium">Удалить</span>
                              </>
                            )}
                          </div>
                        </button>
                      ) : (
                        <button
                          onClick={handleAddContact}
                          disabled={actionLoading}
                          className="group relative flex items-center space-x-2 py-3 px-6 text-white hover:bg-white/5 transition-all duration-300 disabled:opacity-50"
                        >
                          <div className="relative z-10 flex items-center space-x-2">
                            {actionLoading ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <>
                                <Plus className="w-5 h-5" />
                                <span className="font-medium">Добавить</span>
                              </>
                            )}
                          </div>
                        </button>
                      )}
                    </AnimateIcon>
                  </div>

                  {/* Группа кнопок звонков */}
                  <div className="relative flex items-center bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                    {/* Эффект жидкого стекла для всей группы */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                    
                    {/* Кнопка аудиозвонка */}
                    <AnimateIcon animateOnHover>
                      <button
                        onClick={handleAudioCall}
                        className="group relative flex items-center space-x-2 py-3 px-6 text-white hover:bg-white/5 transition-all duration-300"
                      >
                        <div className="relative z-10 flex items-center space-x-2">
                          <Phone className="w-5 h-5" />
                          <span className="font-medium">Аудио</span>
                        </div>
                      </button>
                    </AnimateIcon>

                    {/* Вертикальный разделитель */}
                    <div className="w-px h-6 bg-white/20" />

                    {/* Кнопка видеозвонка */}
                    <AnimateIcon animateOnHover>
                      <button
                        onClick={handleVideoCall}
                        className="group relative flex items-center space-x-2 py-3 px-6 text-white hover:bg-white/5 transition-all duration-300"
                      >
                        <div className="relative z-10 flex items-center space-x-2">
                          <Video className="w-5 h-5" />
                          <span className="font-medium">Видео</span>
                        </div>
                      </button>
                    </AnimateIcon>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Основной контент */}
        <div className="relative mt-8 px-8">
          {error && (
            <div className="p-4 bg-red-500/20 text-red-300 rounded-lg mb-6 backdrop-blur-sm">
              {error}
            </div>
          )}

          {/* Панель вкладок */}
          <div className="bg-black/30 rounded-2xl p-6 backdrop-blur-xl border border-white/10 shadow-2xl mb-6">
            {/* Вкладки */}
            <div className="flex space-x-2 mb-6">
              <button
                onClick={() => setActiveTab('media')}
                className={`flex items-center space-x-2 px-4 py-3 rounded-xl transition-all ${
                  activeTab === 'media' 
                    ? 'bg-white/10 text-white border border-white/20' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <ImageIcon className="w-5 h-5" />
                <span>Медиа</span>
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                  {mediaFiles.length}
                </span>
              </button>
              
              <button
                onClick={() => setActiveTab('audio')}
                className={`flex items-center space-x-2 px-4 py-3 rounded-xl transition-all ${
                  activeTab === 'audio' 
                    ? 'bg-white/10 text-white border border-white/20' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Music className="w-5 h-5" />
                <span>Аудио</span>
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                  {audioFiles.length}
                </span>
              </button>
              
              <button
                onClick={() => setActiveTab('docs')}
                className={`flex items-center space-x-2 px-4 py-3 rounded-xl transition-all ${
                  activeTab === 'docs' 
                    ? 'bg-white/10 text-white border border-white/20' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <FileText className="w-5 h-5" />
                <span>Документы</span>
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                  {documentFiles.length}
                </span>
              </button>
              
              <button
                onClick={() => setActiveTab('calls')}
                className={`flex items-center space-x-2 px-4 py-3 rounded-xl transition-all ${
                  activeTab === 'calls' 
                    ? 'bg-white/10 text-white border border-white/20' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Phone className="w-5 h-5" />
                <span>Звонки</span>
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                  {callHistory.length}
                </span>
              </button>
            </div>

            {/* Контент вкладок */}
            <div className="min-h-[200px]">
              {contentLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
              ) : (
                <>
                  {/* Медиафайлы */}
                  {activeTab === 'media' && (
                    <div>
                      {mediaFiles.length === 0 ? (
                        <div className="text-center text-gray-400 py-12">
                          <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-30" />
                          <p className="text-lg">Медиафайлы не найдены</p>
                          <p className="text-sm mt-2">В чате с этим пользователем нет изображений или видео</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {mediaFiles.map((file) => (
                            <div 
                              key={file.id} 
                              className="relative group cursor-pointer bg-white/5 rounded-lg overflow-hidden"
                              onClick={() => window.open(file.url, '_blank')}
                            >
                              {file.type === 'image' ? (
                                <img 
                                  src={file.url} 
                                  alt="Media"
                                  className="w-full h-72 object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-full h-48 bg-black/50 flex items-center justify-center">
                                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                                    <Play className="w-6 h-6 text-white" />
                                  </div>
                                </div>
                              )}
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="text-white text-sm truncate">
                                  {formatDate(file.createdAt)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Аудиосообщения */}
                  {activeTab === 'audio' && (
                    <div>
                      {audioFiles.length === 0 ? (
                        <div className="text-center text-gray-400 py-12">
                          <Music className="w-12 h-12 mx-auto mb-4 opacity-30" />
                          <p className="text-lg">Аудиосообщения не найдены</p>
                          <p className="text-sm mt-2">В чате с этим пользователем нет голосовых сообщений</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {audioFiles.map((audio) => (
                            <div 
                              key={audio.id} 
                              className="bg-white/5 rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors"
                            >
                              <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                                  <Music className="w-5 h-5 text-purple-400" />
                                </div>
                                <div>
                                  <p className="text-white text-sm">
                                    {formatDate(audio.createdAt)} • {formatTime(audio.createdAt)}
                                  </p>
                                  <p className="text-gray-400 text-xs">
                                    {formatDuration(audio.duration)}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDownload(audio.url, 'аудиосообщение.mp3')}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                title="Скачать"
                              >
                                <Download className="w-4 h-4 text-gray-400" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Документы */}
                  {activeTab === 'docs' && (
                    <div>
                      {documentFiles.length === 0 ? (
                        <div className="text-center text-gray-400 py-12">
                          <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                          <p className="text-lg">Документы не найдены</p>
                          <p className="text-sm mt-2">В чате с этим пользователем нет документов</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {documentFiles.map((doc) => (
                            <div 
                              key={doc.id} 
                              className="bg-white/5 rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors"
                            >
                              <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                  <FileText className="w-5 h-5 text-blue-400" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-white text-sm truncate">
                                    {doc.filename}
                                  </p>
                                  <div className="flex items-center space-x-3 text-xs text-gray-400">
                                    <span>{formatDate(doc.createdAt)}</span>
                                    {doc.size > 0 && <span>• {Math.round(doc.size / 1024)} KB</span>}
                                  </div>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDownload(doc.url, doc.filename)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                title="Скачать"
                              >
                                <Download className="w-4 h-4 text-gray-400" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Звонки */}
                  {activeTab === 'calls' && (
                    <div>
                      {callHistory.length === 0 ? (
                        <div className="text-center text-gray-400 py-12">
                          <Phone className="w-12 h-12 mx-auto mb-4 opacity-30" />
                          <p className="text-lg">Звонки не найдены</p>
                          <p className="text-sm mt-2">История звонков с этим пользователем пуста</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {callHistory.map((call) => (
                            <div 
                              key={call.id} 
                              className="bg-white/5 rounded-xl p-4 hover:bg-white/10 transition-colors"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-3">
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                    call.type === 'video' 
                                      ? 'bg-green-500/20' 
                                      : 'bg-blue-500/20'
                                  }`}>
                                    {call.type === 'video' ? (
                                      <Phone className="w-5 h-5 text-green-400" />
                                    ) : (
                                      <Phone className="w-5 h-5 text-blue-400" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-white">
                                      {call.type === 'video' ? 'Видеозвонок' : 'Аудиозвонок'}
                                    </p>
                                    <p className="text-sm text-gray-400">
                                      {call.initiator.id === currentUser?.id ? 'Исходящий' : 'Входящий'}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                                    <Calendar className="w-4 h-4" />
                                    <span>{formatDate(call.startTime)}</span>
                                  </div>
                                  <div className="flex items-center space-x-2 text-sm text-gray-400 mt-1">
                                    <Clock className="w-4 h-4" />
                                    <span>{formatTime(call.startTime)}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-sm text-gray-400">
                                <div className="flex items-center space-x-2">
                                  <span className={`px-2 py-1 rounded ${
                                    call.status === 'ended' 
                                      ? 'bg-green-500/20 text-green-400' 
                                      : call.status === 'missed' 
                                        ? 'bg-red-500/20 text-red-400' 
                                        : 'bg-yellow-500/20 text-yellow-400'
                                  }`}>
                                    {call.status === 'ended' ? 'Завершен' : 
                                     call.status === 'missed' ? 'Пропущен' : 
                                     call.status === 'declined' ? 'Отклонен' : call.status}
                                  </span>
                                </div>
                                {call.duration && (
                                  <span>{formatDuration(call.duration)}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Информация профиля */}
          <div className="bg-black/30 rounded-2xl p-6 backdrop-blur-xl border border-white/10 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-6">Информация профиля</h2>
            
            <div className="space-y-4">
              {user.bio && (
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <span className="text-blue-300 font-semibold block mb-2">О себе</span>
                  <p className="text-white/90">{user.bio}</p>
                </div>
              )}

              {user.username && (
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <span className="text-blue-300 font-semibold block mb-2">Имя пользователя</span>
                  <p className="text-blue-300/90 font-semibold underline cursor-pointer select-none hover:text-blue-300/70 duration-200" 
                  onClick={handleCopyUsername}
                  title="Нажмите, чтобы скопировать">@{user.username}</p>
                </div>
              )}

              {user.place && (
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <span className="text-blue-300 font-semibold block mb-2">Местоположение</span>
                  <p className="text-white/90">{user.place}</p>
                </div>
              )}

              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <span className="text-blue-300 font-semibold block mb-2">Телефон</span>
                <p className="text-white/90">{user.phone || 'Не указан'}</p>
              </div>
            </div>

            {isOwnProfile && (
              <div className="text-center text-gray-400 py-6 mt-6 text-lg border-t border-white/10">
                ✨ Это ваш профиль
              </div>
            )}

            {!currentUser && (
              <div className="text-center text-gray-400 py-6 mt-6 border-t border-white/10">
                Войдите в аккаунт, чтобы добавить в контакты или написать сообщение
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}