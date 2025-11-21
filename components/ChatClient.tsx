'use client'

import { uploadFile, updateMessage, deleteMessage, forwardMessage, getUserChats, addReaction, removeReaction, pinMessage, unpinMessage, getPinnedMessage, markMessageAsRead, markAllMessagesAsRead, searchMessagesInChat, getLinkPreview } from '@/app/lib/api/chat'
import { User, ChatWithDetails, Message } from '@/app/lib/types'
import { useChatMessages } from '@/hooks/useChatMessages'
import { useState, useRef, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFaceSmile, faPaperclip, faPaperPlane, faTrash, faDownload, faReply, faShare, faEdit, faThumbTack } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { getCurrentUser } from '@/app/lib/api/user'
import { AnimateIcon } from './animate-ui/icons/icon'
import { Download } from './animate-ui/icons/download'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check } from './animate-ui/icons/check'
import { CheckCheck } from './animate-ui/icons/check-check'
import { cn } from '@/lib/utils'
import { Search } from './animate-ui/icons/search'

interface PendingFile {
  id: string
  file: File
  previewUrl?: string
  progress: number
}

interface ChatClientProps {
  currentUser: User
  chatInfo: ChatWithDetails
}

// Расширяем тип Message для поддержки новых полей
export type MessageWithFiles = Message & {
  fileUrls?: string[]
  originalMessage?: Message
  isShared?: boolean
  replyTo?: Message
  messageId?: number | null
  originalMessageId?: number | null
  readBy?: User[]
  readCount?: number
  totalMembers?: number
  readStatus?: 'sent' | 'read' | 'unread'
  isReadByCurrentUser?: boolean
  reactions?: Record<string, any[]> // Добавляем реакции
  imageUrl?: string | null // Добавляем imageUrl
}

// Функция для скачивания файла
const downloadFile = async (url: string, filename: string) => {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = blobUrl
    a.download = filename
    
    document.body.appendChild(a)
    a.click()
    
    window.URL.revokeObjectURL(blobUrl)
    document.body.removeChild(a)
  } catch (error) {
    console.error('Error downloading file:', error)
    window.open(url, '_blank')
  }
}

// Компонент для отображения иконок файлов
function FileIcon({ fileUrl, className = "w-4 h-4" }: { fileUrl: string; className?: string }) {
  const extension = fileUrl.split('.').pop()?.toLowerCase()
  
  const getIconPath = () => {
    switch (extension) {
      case 'pdf': return '/assets/icons/file-pdf.svg'
      case 'doc': case 'docx': return '/assets/icons/word.svg'
      case 'xls': case 'xlsx': return '/assets/icons/excel.svg'
      case 'ppt': case 'pptx': return '/assets/icons/powerpoint.svg'
      case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': case 'avif': return '/assets/icons/file-image.svg'
      case 'svg': return '/assets/icons/file-svg.svg'
      case 'mp4': case 'mov': case 'avi': case 'webm': case 'mkv': return '/assets/icons/file-video.svg'
      case 'zip': case 'rar': case '7z': return '/assets/icons/zip.svg'
      case 'txt': return '/assets/icons/txt.svg'
      default: return '/assets/icons/file-other.svg'
    }
  }

  return (
    <img 
      src={getIconPath()} 
      alt={`${extension} file`}
      className={className}
    />
  )
}

// Компонент для статуса прочтения сообщения
function MessageReadStatus({ message, isOwn }: { message: MessageWithFiles; isOwn: boolean }) {
  if (!isOwn) return null

  const readCount = message.readCount || 0
  const totalMembers = message.totalMembers || 0
  
  return (
    <div className="flex items-center space-x-1 mt-1 justify-end">
      <span className={`text-xs ${
        readCount > 0 ? 'text-gray-100' : 'text-gray-300'
      }`}>
        <AnimateIcon animateOnView>
        {readCount > 0 ? <CheckCheck width={18} height={18} /> : <Check width={18} height={18} />}
        </AnimateIcon>
      </span>
      {/* {readCount > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            alert(`Прочитано ${readCount} из ${totalMembers} участников`)
          }}
          className="text-xs text-blue-400 hover:text-blue-300 underline"
          title={`Прочитано ${readCount} из ${totalMembers}`}
        >
          {readCount}/{totalMembers}
        </button>
      )} */}
    </div>
  )
}

// Компонент для закрепленного сообщения
function PinnedMessage({ 
  chatId, 
  currentUser, 
  chatInfo 
}: { 
  chatId: number; 
  currentUser: User; 
  chatInfo: ChatWithDetails;
}) {
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = useState(false)

  const { data: pinnedMessage, isLoading: isPinnedLoading } = useQuery({
    queryKey: ['pinned-message', chatId],
    queryFn: () => getPinnedMessage(chatId),
    refetchInterval: 3000,
    staleTime: 1000,
  })

  const canManagePinned = chatInfo.members.some(member => 
    member.userId === currentUser.id && ['OWNER', 'ADMIN'].includes(member.role)
  )

  const handleUnpin = async () => {
    if (!canManagePinned) return
    
    setIsLoading(true)
    try {
      await unpinMessage(chatId)
      queryClient.invalidateQueries({ queryKey: ['pinned-message', chatId] })
      queryClient.invalidateQueries({ queryKey: ['chat-messages', chatId] })
    } catch (error) {
      console.error('Error unpinning message:', error)
      alert('Ошибка при откреплении сообщения')
    } finally {
      setIsLoading(false)
    }
  }

  if (isPinnedLoading) {
    return (
      <div className="bg-black/60 border-l-4 border-blue-500 p-3 rounded-r-lg animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="h-4 bg-blue-200 rounded w-1/4 mb-2"></div>
            <div className="h-3 bg-blue-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!pinnedMessage) return null

  const contentPreview = pinnedMessage.content && pinnedMessage.content.length > 100 
    ? `${pinnedMessage.content.substring(0, 100)}...`
    : pinnedMessage.content

  return (
    <div className="bg-black/60 border-l-4 border-blue-500 p-3 rounded-r-lg shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-blue-600 text-sm font-medium flex items-center">
              <FontAwesomeIcon icon={faThumbTack} className="w-3 h-3 mr-1" />
              Закреплено
            </span>
            <span className="text-xs text-gray-600">
              {pinnedMessage?.user.name} {pinnedMessage?.user.surname}
            </span>
            <span className="text-xs text-gray-400">
              {new Date(pinnedMessage.createdAt).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
          
          {contentPreview && (
            <p className="text-sm text-white mb-1 whitespace-pre-wrap break-words">
              {contentPreview}
            </p>
          )}

          {pinnedMessage.fileUrl && (
            <div className="flex items-center space-x-1 text-xs text-gray-600 mb-1">
              <FontAwesomeIcon icon={faPaperclip} className="w-3 h-3" />
              <span>Прикреплен файл</span>
            </div>
          )}

          {pinnedMessage.imageUrl && !pinnedMessage.fileUrl && (
            <div className="flex items-center space-x-1 text-xs text-gray-600 mb-1">
              <span>🖼️</span>
              <span>Изображение</span>
            </div>
          )}

          <div className="mt-[-12]">
          {pinnedMessage && (
            <MessageReadStatus 
              message={pinnedMessage as unknown as MessageWithFiles} 
              isOwn={pinnedMessage.userId === currentUser.id} 
            />
          )}
          </div>
        </div>

        {canManagePinned && (
          <button
            onClick={handleUnpin}
            disabled={isLoading}
            className="ml-3 text-gray-400 hover:text-gray-600 disabled:opacity-50 flex-shrink-0 p-1 rounded hover:bg-gray-200 transition-colors"
            title="Открепить сообщение"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>✕</span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

// Компонент для отображения медиа
function MediaMessage({ message, isOwn }: { message: MessageWithFiles; isOwn: boolean }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const fileUrls = message.fileUrl ? [message.fileUrl] : (message.fileUrls || [])

  if (fileUrls.length === 0) return null

  const imageUrls = fileUrls.filter(url => url.match(/\.(jpg|jpeg|png|gif|webp|avif)$/i))
  const videoUrls = fileUrls.filter(url => url.match(/\.(mp4|mov|avi|webm|mkv)$/i))

  const handleMediaClick = (url: string, index: number) => {
    setSelectedImageIndex(index)
    setIsModalOpen(true)
  }

  const handleDownloadMedia = async (url: string, event: React.MouseEvent) => {
    event.stopPropagation()
    const filename = getFileNameFromUrl(url)
    await downloadFile(url, filename)
  }

  const getGridClass = (count: number) => {
    if (count === 1) return "grid-cols-1"
    if (count === 2) return "grid-cols-2"
    if (count === 3) return "grid-cols-3"
    if (count === 4) return "grid-cols-2"
    return "grid-cols-3"
  }

  const getImageSize = (count: number, index: number) => {
    if (count === 1) return "h-64"
    if (count === 2) return "h-40"
    if (count === 3) return "h-32"
    if (count === 4) return "h-32"
    return "h-24"
  }

  return (
    <>
      <div className="mt-2 space-y-3">
        {imageUrls.length > 0 && (
          <div className="max-w-2xl">
            <div className={`grid ${getGridClass(imageUrls.length)} gap-2`}>
              {imageUrls.map((fileUrl, index) => (
                <div 
                  key={index}
                  className="relative cursor-pointer rounded-lg overflow-hidden border border-gray-300 bg-gray-100 group"
                  onClick={() => handleMediaClick(fileUrl, index)}
                >
                  <AnimateIcon animateOnHover>
                    <img 
                      src={fileUrl} 
                      alt={`Фото ${index + 1}`}
                      className={`w-full object-cover ${getImageSize(imageUrls.length, index)}`}
                      loading="lazy"
                    />
                    <button
                      onClick={(e) => handleDownloadMedia(fileUrl, e)}
                      className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Скачать изображение"
                    >
                      <Download />
                    </button>
                  </AnimateIcon>
                </div>
              ))}
            </div>
          </div>
        )}

        {videoUrls.length > 0 && (
          <div className="space-y-2 max-w-md">
            {videoUrls.map((fileUrl, index) => (
              <div key={index} className="relative cursor-pointer rounded-lg overflow-hidden border border-gray-300 group">
                <video 
                  src={fileUrl}
                  className="w-full h-auto max-h-64"
                  controls={false}
                  preload="metadata"
                  onClick={() => handleMediaClick(fileUrl, index)}
                >
                  Ваш браузер не поддерживает видео.
                </video>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 bg-white bg-opacity-80 rounded-full flex items-center justify-center">
                    <span className="text-2xl">▶️</span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDownloadMedia(fileUrl, e)}
                  className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Скачать видео"
                >
                  <FontAwesomeIcon icon={faDownload} className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="relative max-w-4xl max-h-full w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute -top-12 right-0 text-white text-2xl hover:text-gray-300 z-10 bg-black bg-opacity-50 rounded-full w-8 h-8 flex items-center justify-center"
            >
              ✕
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation()
                const currentUrl = imageUrls[selectedImageIndex] || videoUrls[selectedImageIndex]
                if (currentUrl) {
                  handleDownloadMedia(currentUrl, e)
                }
              }}
              className="absolute -top-12 right-12 text-white text-2xl hover:text-gray-300 z-10 bg-black bg-opacity-50 rounded-full w-8 h-8 flex items-center justify-center"
              title="Скачать"
            >
              <FontAwesomeIcon icon={faDownload} className="w-4 h-4" />
            </button>
            
            {imageUrls.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedImageIndex(prev => prev > 0 ? prev - 1 : imageUrls.length - 1)
                  }}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white text-2xl bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-70"
                >
                  ‹
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedImageIndex(prev => prev < imageUrls.length - 1 ? prev + 1 : 0)
                  }}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white text-2xl bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-70"
                >
                  ›
                </button>
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-50 px-3 py-1 rounded-full text-sm">
                  {selectedImageIndex + 1} / {imageUrls.length}
                </div>
              </>
            )}
            
            {imageUrls[selectedImageIndex] && (
              <img 
                src={imageUrls[selectedImageIndex]} 
                alt="Просмотр"
                className="max-w-full max-h-screen object-contain mx-auto"
              />
            )}
            
            {videoUrls[selectedImageIndex] && (
              <video 
                src={videoUrls[selectedImageIndex]}
                className="max-w-full max-h-screen mx-auto"
                controls
                autoPlay
              >
                Ваш браузер не поддерживает видео.
              </video>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// Компонент для разделителя дат
function DateSeparator({ date }: { date: Date }) {
  const formatDate = (date: Date) => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)

    if (date.toDateString() === today.toDateString()) {
      return 'Сегодня'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Вчера'
    } else if (date > weekAgo) {
      const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']
      return days[date.getDay()]
    } else {
      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    }
  }

  return (
    <div className="flex justify-center my-6">
      <div className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-sm">
        {formatDate(date)}
      </div>
    </div>
  )
}

// Компонент для отображения пересланного сообщения
function ForwardedMessageHeader({ message }: { message: MessageWithFiles }) {
  if (!message.isShared || !message.originalMessage) return null

  const originalUser = message.originalMessage.user
  const displayName = originalUser.name && originalUser.surname 
    ? `${originalUser.name} ${originalUser.surname}`
    : originalUser.name || originalUser.surname || originalUser.email

  return (
    <div className="text-xs text-gray-500 mb-1 flex items-center space-x-1">
      <FontAwesomeIcon icon={faShare} className="w-3 h-3" />
      <span>Переслано от {displayName}</span>
    </div>
  )
}

// Компонент для отображения ответа на сообщение
function ReplyHeader({ message, onReplyClick }: { message: MessageWithFiles; onReplyClick: () => void }) {
  if (!message.replyTo) return null

  const repliedUser = message.replyTo.user
  const displayName = repliedUser.name && repliedUser.surname 
    ? `${repliedUser.name} ${repliedUser.surname}`
    : repliedUser.name || repliedUser.surname || repliedUser.email

  const replyPreview = message.replyTo.content.length > 50 
    ? `${message.replyTo.content.substring(0, 50)}...`
    : message.replyTo.content

  return (
    <div 
      className="text-xs text-white mb-1 border-l-2 border-blue-500 pl-2 cursor-pointer hover:bg-gray-600/30 rounded py-1"
      onClick={onReplyClick}
    >
      <div className="font-medium">Ответ {displayName}</div>
      <div className="truncate">{replyPreview}</div>
    </div>
  )
}

function MessageReactions({ 
  message, 
  currentUser,
  onAddReaction,
  onRemoveReaction 
}: { 
  message: MessageWithFiles; 
  currentUser: User;
  onAddReaction: (message: MessageWithFiles, emoji: string) => void;
  onRemoveReaction: (message: MessageWithFiles) => void;
}) {
  const reactions = message.reactions || {}

  if (Object.keys(reactions).length === 0) return null

  const getUserReaction = () => {
    for (const [emoji, users] of Object.entries(reactions)) {
      if (users.some((user: User) => user.id === currentUser.id)) {
        return emoji
      }
    }
    return null
  }

  const userReaction = getUserReaction()

  const handleReactionClick = (emoji: string) => {
    if (userReaction === emoji) {
      onRemoveReaction(message)
    } else {
      onAddReaction(message, emoji)
    }
  }

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {Object.entries(reactions).map(([emoji, users]) => {
        const isUserReaction = userReaction === emoji
        const userNames = users.map((u: User) => u.name).filter(Boolean).join(', ')
        
        return (
          <button
            key={emoji}
            onClick={() => handleReactionClick(emoji)}
            className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs border transition-colors ${
              isUserReaction
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
            title={userNames ? `${userNames}: ${emoji}` : `Реакция: ${emoji}`}
          >
            <span className="text-xs">{emoji}</span>
            <span className="font-medium">{users.length}</span>
          </button>
        )
      })}
    </div>
  )
}

function MessageContextMenu({
  message,
  isOwn,
  onReply,
  onEdit,
  onDelete,
  onForward,
  onPin,
  onAddReaction,
  onRemoveReaction,
  currentUser,
  canPin,
  chatInfo,
  pinnedMessage
}: {
  message: MessageWithFiles;
  isOwn: boolean;
  onReply: (message: MessageWithFiles) => void;
  onEdit: (message: MessageWithFiles) => void;
  onDelete: (message: MessageWithFiles) => void;
  onForward: (message: MessageWithFiles) => void;
  onPin: (message: MessageWithFiles) => void;
  onAddReaction: (message: MessageWithFiles, emoji: string) => void;
  onRemoveReaction: (message: MessageWithFiles) => void;
  currentUser: User;
  canPin: boolean;
  chatInfo: ChatWithDetails;
  pinnedMessage?: MessageWithFiles;
}) {
  const [showAllEmojis, setShowAllEmojis] = useState(false)
  const queryClient = useQueryClient()
  
  const popularEmojis = ['👍', '❤️', '😂', '😮', '😢']
  const allEmojis = [
    '👍', '❤️', '😂', '😮', '😢', '😡', '👏', '🔥', '🎉', '🤔',
    '👎', '🙏', '💯', '🤣', '😍', '😊', '🥰', '😎', '🤩', '😭',
    '🙌', '💕', '💔', '💪', '👀', '✅', '❌', '⭐', '🏆', '🎯'
  ]

  const getUserReaction = () => {
    const reactions = message.reactions || {}
    for (const [emoji, users] of Object.entries(reactions)) {
      if (users.some((user: User) => user.id === currentUser.id)) {
        return emoji
      }
    }
    return null
  }

  const userReaction = getUserReaction()

  const handleReactionClick = (emoji: string) => {
    if (userReaction === emoji) {
      onRemoveReaction(message)
    } else {
      onAddReaction(message, emoji)
    }
    setShowAllEmojis(false)
  }

  // Проверяем, является ли текущее сообщение закрепленным
  const isPinned = pinnedMessage?.id === message.id

  // Функция для открепления сообщения
  const handleUnpin = async () => {
    if (!canPin) return
    
    try {
      await unpinMessage(chatInfo.id)
      queryClient.invalidateQueries({ queryKey: ['pinned-message', chatInfo.id] })
      queryClient.invalidateQueries({ queryKey: ['chat-messages', chatInfo.id] })
    } catch (error) {
      console.error('Error unpinning message:', error)
      alert('Ошибка при откреплении сообщения')
    }
  }

  return (
    <ContextMenuContent className="w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500">
            {userReaction ? 'Ваша реакция:' : 'Добавить реакцию:'}
          </span>
          <button
            onClick={() => setShowAllEmojis(!showAllEmojis)}
            className="text-xs text-blue-500 hover:text-blue-700"
          >
            {showAllEmojis ? 'Свернуть' : 'Ещё...'}
          </button>
        </div>
        
        <div className="grid grid-cols-5 gap-1">
          {(showAllEmojis ? allEmojis : popularEmojis).map((emoji) => (
            <button
              key={emoji}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleReactionClick(emoji)
              }}
              className={`p-2 rounded-lg text-lg hover:bg-gray-100 transition-colors ${
                userReaction === emoji 
                  ? 'bg-blue-50 border border-blue-200' 
                  : ''
              }`}
              title={userReaction === emoji ? 'Убрать реакцию' : `Реакция ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {userReaction && (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onRemoveReaction(message)
              setShowAllEmojis(false)
            }}
            className="w-full mt-2 px-3 py-1 text-xs text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            ❌ Удалить мою реакцию
          </button>
        )}
      </div>

      {canPin && (
        <>
          {isPinned ? (
            <ContextMenuItem 
              onClick={handleUnpin}
              className="flex items-center space-x-2 px-3 py-2 text-sm cursor-pointer hover:bg-red-50 text-red-600"
            >
              <FontAwesomeIcon icon={faThumbTack} className="w-4 h-4" />
              <span>Открепить сообщение</span>
            </ContextMenuItem>
          ) : (
            <ContextMenuItem 
              onClick={() => onPin(message)}
              className="flex items-center space-x-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-100"
            >
              <FontAwesomeIcon icon={faThumbTack} className="w-4 h-4" />
              <span>Закрепить сообщение</span>
            </ContextMenuItem>
          )}
        </>
      )}

      <ContextMenuItem 
        onClick={() => onReply(message)}
        className="flex items-center space-x-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-100"
      >
        <FontAwesomeIcon icon={faReply} className="w-4 h-4" />
        <span>Ответить</span>
      </ContextMenuItem>
      
      <ContextMenuItem 
        onClick={() => onForward(message)}
        className="flex items-center space-x-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-100"
      >
        <FontAwesomeIcon icon={faShare} className="w-4 h-4" />
        <span>Переслать</span>
      </ContextMenuItem>

      {isOwn && (
        <>
          <ContextMenuSeparator className="bg-gray-200" />
          <ContextMenuItem 
            onClick={() => onEdit(message)}
            className="flex items-center space-x-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-100"
          >
            <FontAwesomeIcon icon={faEdit} className="w-4 h-4" />
            <span>Изменить</span>
          </ContextMenuItem>
          <ContextMenuItem 
            onClick={() => onDelete(message)}
            className="flex items-center space-x-2 px-3 py-2 text-sm cursor-pointer hover:bg-red-50 text-red-600"
          >
            <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
            <span>Удалить</span>
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  )
}

// Компонент для одного сообщения
function LinkPreview({ url }: { url: string }) {
  const [preview, setPreview] = useState<{
    url: string
    title: string
    description: string
    image: string | null
    domain: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const fetchPreview = async () => {
      setIsLoading(true)
      try {
        const previewData = await getLinkPreview(url)
        setPreview(previewData)
      } catch (error) {
        console.error('Error loading link preview:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPreview()
  }, [url])

  if (isLoading) {
    return (
      <div className="mb-2 p-3 bg-gray-800/60 rounded-lg border border-gray-600/30">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gray-700 rounded-lg animate-pulse"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-700 rounded animate-pulse w-3/4"></div>
            <div className="h-3 bg-gray-700 rounded animate-pulse w-full"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!preview) return null

  return (
    <div className="mb-2 bg-gray-800/60 rounded-lg border-t-4 border-t-green-300">
      {/* Блок с названием и описанием (над сообщением) */}
      <div className="p-3 rounded-lg">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <a 
              href={preview.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block hover:opacity-80 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center space-x-2 mb-2">
                {preview.image && (
                  <img 
                    src={preview.image} 
                    alt="Preview" 
                    className="w-4 h-4 object-cover rounded"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )}
                <span className="text-xs font-medium text-blue-400 truncate">
                  {preview.domain}
                </span>
              </div>
              
              <h4 className="text-sm font-semibold text-white mb-1 line-clamp-2">
                {preview.title}
              </h4>
              
              {preview.description && (
                <p className="text-xs text-gray-300 line-clamp-2">
                  {preview.description}
                </p>
              )}
            </a>
          </div>
        </div>
      </div>

      {/* Картинка под сообщением (если есть) */}
      {preview.image && (
        <div className="rounded-lg overflow-hidden p-3">
          <a 
            href={preview.url} 
            target="_blank" 
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={preview.image} 
              alt={preview.title}
              className="w-full h-auto max-h-48 object-cover hover:opacity-90 transition-opacity rounded-lg"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </a>
        </div>
      )}
    </div>
  )
}

// Обновленная функция для форматирования текста с ссылками
const formatLinksInText = (text: string): { hasLinks: boolean; links: string[]; elements: React.ReactNode } => {
  if (!text) return { hasLinks: false, links: [], elements: text }
  
  const urlRegex = /(https?:\/\/[^\s<]+[^\s<.,)])/g
  const parts = text.split(urlRegex)
  const links: string[] = text.match(urlRegex) || []
  
  const elements = parts.map((part, index) => {
    if (part.match(urlRegex)) {
      const isImage = /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?.*)?$/i.test(part)
      const isVideo = /\.(mp4|mov|avi|webm|mkv)(\?.*)?$/i.test(part)
      const isAudio = /\.(mp3|wav|ogg|m4a)(\?.*)?$/i.test(part)
      const isDocument = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx)(\?.*)?$/i.test(part)
      
      let displayText = part
      if (part.length > 50) {
        displayText = part.substring(0, 47) + '...'
      }
      
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center space-x-1 px-1 rounded ${
            isImage ? 'text-green-400 hover:text-green-300' :
            isVideo ? 'text-purple-400 hover:text-purple-300' :
            isAudio ? 'text-yellow-400 hover:text-yellow-300' :
            isDocument ? 'text-red-400 hover:text-red-300' :
            'text-blue-400 hover:text-blue-300'
          } underline transition-colors`}
          onClick={(e) => e.stopPropagation()}
          title={part}
        >
          <span>{displayText}</span>
          {isImage && <span>🖼️</span>}
          {isVideo && <span>🎥</span>}
          {isAudio && <span>🔊</span>}
          {isDocument && <span>📄</span>}
        </a>
      )
    }
    return part
  })
  
  return { hasLinks: links.length > 0, links, elements }
}

// Обновленный компонент MessageItem
function MessageItem({ 
  message, 
  currentUser, 
  showDate,
  onReply,
  onEdit,
  onDelete,
  onForward,
  onPin,
  onAddReaction,
  onRemoveReaction,
  canPin,
  markAsRead,
  chatInfo,
  pinnedMessage
}: { 
  message: MessageWithFiles; 
  currentUser: User; 
  showDate: boolean;
  onReply: (message: MessageWithFiles) => void;
  onEdit: (message: MessageWithFiles) => void;
  onDelete: (message: MessageWithFiles) => void;
  onForward: (message: MessageWithFiles) => void;
  onPin: (message: MessageWithFiles) => void;
  onAddReaction: (message: MessageWithFiles, emoji: string) => void;
  onRemoveReaction: (message: MessageWithFiles) => void;
  canPin: boolean;
  markAsRead: (messageId: number) => void;
  chatInfo: ChatWithDetails;
  pinnedMessage?: MessageWithFiles;
}) {
  const isOwn = message.userId === currentUser.id
  const fileUrls = message.fileUrl ? [message.fileUrl] : (message.fileUrls || [])
  const hasFiles = fileUrls.length > 0
  const isFileMessage = message.content && (
    message.content.includes('📎 Файлы:') || 
    message.content.startsWith('📷') || 
    message.content.startsWith('🎥')
  )
  const isSticker = message.imageUrl && message.imageUrl.includes('/stickers/')

  // Извлекаем ссылки из текста сообщения
  const { hasLinks, links, elements } = formatLinksInText(message.content || '')
  const firstLink = links[0] // Берем первую ссылку для предпросмотра

  // Отмечаем сообщение как прочитанное при появлении в viewport
  useEffect(() => {
    if (!isOwn && !message.isReadByCurrentUser) {
      const element = document.getElementById(`message-${message.id}`)
      if (element) {
        const observer = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting) {
            markAsRead(message.id)
            observer.disconnect()
          }
        }, { threshold: 0.5 })
        
        observer.observe(element)
        return () => observer.disconnect()
      }
    }
  }, [message.id, isOwn, message.isReadByCurrentUser, markAsRead])

  const handleReplyClick = () => {
    if (message.replyTo) {
      const repliedMessageElement = document.getElementById(`message-${message.replyTo.id}`)
      if (repliedMessageElement) {
        repliedMessageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        repliedMessageElement.classList.add('bg-yellow-100', 'transition-colors', 'duration-1000')
        setTimeout(() => {
          repliedMessageElement.classList.remove('bg-yellow-100')
        }, 2000)
      }
    }
  }

  const handleDownloadFile = async (url: string, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const filename = getFileNameFromUrl(url)
    await downloadFile(url, filename)
  }

  if (isSticker) {
    return (
      <>
        {showDate && <DateSeparator date={new Date(message.createdAt)} />}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div id={`message-${message.id}`} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
              <div className="max-w-xs">
                <img 
                  src={String(message.imageUrl)} 
                  alt="Стикер"
                  className="w-48 h-48 object-contain cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => {
                    const img = new Image()
                    img.src = message.imageUrl!
                    const width = img.width
                    const height = img.height
                    const windowWidth = window.innerWidth * 0.8
                    const windowHeight = window.innerHeight * 0.8
                    
                    const ratio = Math.min(windowWidth / width, windowHeight / height, 1)
                    const newWindow = window.open('', '_blank')
                    newWindow?.document.write(`
                      <html>
                        <head>
                          <title>Стикер</title>
                          <style>
                            body { 
                              margin: 0; 
                              padding: 20px; 
                              display: flex; 
                              justify-content: center; 
                              align-items: center; 
                              min-height: 100vh; 
                              background: rgba(0,0,0,0.9);
                            }
                            img { 
                              max-width: ${width * ratio}px; 
                              max-height: ${height * ratio}px; 
                            }
                          </style>
                        </head>
                        <body>
                          <img src="${message.imageUrl}" />
                        </body>
                      </html>
                    `)
                  }}
                />
                <div className="flex items-center">
                <p className={`text-xs mt-1 text-center ${
                  isOwn ? 'text-blue-100' : 'text-gray-400'
                }`}>
                  {new Date(message.createdAt).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
                <MessageReactions 
                  message={message}
                  currentUser={currentUser}
                  onAddReaction={onAddReaction}
                  onRemoveReaction={onRemoveReaction}
                />
                </div>
              </div>
            </div>
          </ContextMenuTrigger>
          <MessageContextMenu 
            message={message}
            isOwn={isOwn}
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
            onForward={onForward}
            onPin={onPin}
            onAddReaction={onAddReaction}
            onRemoveReaction={onRemoveReaction}
            currentUser={currentUser}
            canPin={canPin}
            chatInfo={chatInfo}
            pinnedMessage={pinnedMessage}
          />
        </ContextMenu>
      </>
    )
  }

  return (
    <>
      {showDate && <DateSeparator date={new Date(message.createdAt)} />}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div id={`message-${message.id}`} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                isOwn
                  ? 'bg-purple-700/10 text-white rounded-br-none border border-purple-400/20'
                  : 'bg-black/40 text-white rounded-bl-none border border-purple-400/20'
              }`}
            >
              {!isOwn && (
                <p className="text-xs font-medium text-gray-100 mb-2 wrap-break-word">
                  {message.user.name} {message.user.surname}
                </p>
              )}
              <ForwardedMessageHeader message={message} />
              <ReplyHeader message={message} onReplyClick={handleReplyClick} />
              
              {/* Предпросмотр ссылки (над текстом сообщения) */}
              {hasLinks && firstLink && (
                <LinkPreview url={firstLink} />
              )}
              
              {message.content && !isFileMessage && (
                <p className="text-sm whitespace-pre-wrap mb-2 wrap-break-word">{elements}</p>
              )}
              
              {hasFiles && (
                <MediaMessage message={message} isOwn={isOwn} />
              )}
              
              {hasFiles && fileUrls.some(url => !url.match(/\.(jpg|jpeg|png|gif|webp|avif|mp4|mov|avi|webm|mkv)$/i)) && (
                <div className="mt-2 space-y-1">
                  {fileUrls.map((url, index) => {
                    if (url.match(/\.(jpg|jpeg|png|gif|webp|avif|mp4|mov|avi|webm|mkv)$/i)) return null
                    
                    return (
                      <div 
                        key={index}
                        className="flex items-center w-full space-x-2 px-3 py-1 bg-purple-500/40 rounded-lg hover:bg-purple-500/30 transition-colors text-sm"
                      >
                        <a 
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-2 flex-1 w-[85%]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FileIcon fileUrl={url} className="w-6 h-6 flex-shrink-0" />
                          <p className="wrap-break-word flex-1 w-full">{getFileNameFromUrl(url)}</p>
                        </a>
                        <button 
                          onClick={(e) => handleDownloadFile(url, e)}
                          className="text-white hover:text-gray-300 transition-colors p-1 rounded"
                          title="Скачать файл"
                        >
                          <FontAwesomeIcon icon={faDownload} className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
              
              <MessageReactions 
                message={message}
                currentUser={currentUser}
                onAddReaction={onAddReaction}
                onRemoveReaction={onRemoveReaction}
              />
              <div className="flex items-center justify-between mt-1 gap-4">
              <p className={`text-xs mt-1 ${
                isOwn ? 'text-blue-100' : 'text-gray-400'
              }`}>
                {new Date(message.createdAt).toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
                {message.isEdited && ' (ред.)'}
              </p>
              
              <MessageReadStatus message={message} isOwn={isOwn} />
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        <MessageContextMenu 
          message={message}
          isOwn={isOwn}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          onForward={onForward}
          onPin={onPin}
          onAddReaction={onAddReaction}
          onRemoveReaction={onRemoveReaction}
          currentUser={currentUser}
          canPin={canPin}
          chatInfo={chatInfo}
          pinnedMessage={pinnedMessage}
        />
      </ContextMenu>
    </>
  )
}

// Компонент для выбора стикеров
function StickerPicker({ onStickerSelect, onClose }: { 
  onStickerSelect: (stickerPath: string) => void 
  onClose: () => void
}) {
  const stickers = Array.from({ length: 20 }, (_, i) => `/assets/stickers/${i + 1}.png`);
  const [cuser, setcuser] = useState<User | null>(null)

  useEffect(() => {
    const getUser = async () => {
      const currentUser = await getCurrentUser();
      setcuser(currentUser)
    }
    getUser();
  }, []);

  const exclusive = cuser?.isPremium ? Array.from({ length: 20 }, (_, i) => `/assets/stickers/${i + 1}.png`) : null

  return (
    <div className="absolute bottom-20 left-4 bg-white border border-black/70 rounded-lg shadow-xl p-4 z-10 max-h-96 overflow-y-scroll">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-medium text-white">Выберите стикер</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg"
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2 max-w-xs">
        {stickers.map((stickerPath, index) => (
          <button
            key={index}
            onClick={() => onStickerSelect(stickerPath)}
            className="w-16 h-16 hover:bg-gray-600/40 rounded-lg transition-colors p-1"
          >
            <img 
              src={stickerPath} 
              alt={`Стикер ${index + 1}`}
              className="w-full h-full object-contain"
            />
          </button>
        ))}
      </div>
      <span className="text-gray-100 mt-2">Эксклюзивные стикеры</span>
        {exclusive ? (
          <div className="grid grid-cols-4 gap-2 max-w-xs mt-2">
            {exclusive.map((stickerPath, index) => (
              <button
                key={index}
                onClick={() => onStickerSelect(stickerPath)}
                className="w-16 h-16 hover:bg-gray-600/40 rounded-lg transition-colors p-1"
              >
                <img 
                  src={stickerPath} 
                  alt={`Стикер ${index + 1}`}
                  className="w-full h-full object-contain"
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl p-4">
            <p>Это платная функция. <Link href="/settings">Приобрести Premium статус</Link></p>
          </div>
        )}
    </div>
  )
}

// Модальное окно для пересылки сообщений
function ForwardMessageModal({ 
  message, 
  onClose, 
  onForward,
  currentUser
}: { 
  message: MessageWithFiles; 
  onClose: () => void; 
  onForward: (chatId: number) => void;
  currentUser: User;
}) {
  const [chats, setChats] = useState<ChatWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null)

  useEffect(() => {
    async function loadChats() {
      try {
        const userChats = await getUserChats()
        setChats(userChats)
      } catch (error) {
        console.error('Error loading chats:', error)
      } finally {
        setLoading(false)
      }
    }

    loadChats()
  }, [])

  const handleForward = () => {
    if (selectedChatId) {
      onForward(selectedChatId)
    }
  }

  const getChatDisplayName = (chat: ChatWithDetails) => {
    if (chat.type === 'GROUP') {
      return chat.name || 'Групповой чат'
    }
    
    const otherMember = chat.members.find(member => 
      member.userId !== message.userId
    )
    return otherMember ? `${otherMember.user.name} ${otherMember.user.surname}` : 'Приватный чат'
  }

  const getChatAvatar = (chat: ChatWithDetails) => {
    if (chat.type === 'GROUP') {
      if(chat.type === 'GROUP' && chat.avatar) return <img src={String(chat.avatar)} alt="" className="rounded-full" />
      else return '👥' 
    }
    
    const otherMember = chat.members.find(member => 
      member.userId !== message.userId
    )
    return otherMember?.user.name?.[0]?.toUpperCase() || 'П'
  }

  const canSendToChat = (chat: ChatWithDetails) => {
    if (chat.type === 'PRIVATE') return true
    if (chat.type === 'GROUP' && !chat.isChannel) return true
    if (chat.isChannel) {
      const currentMember = chat.members.find(member => member.userId === currentUser.id)
      if (!currentMember) return false
      return ['ADMIN', 'OWNER'].includes(currentMember.role)
    }
    return true
  }

  const filteredChats = chats.filter(chat => canSendToChat(chat))

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Переслать сообщение</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-lg"
            >
              ✕
            </button>
          </div>
          
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">
              {message.user.name} {message.user.surname}
            </p>
            <p className="text-sm text-gray-800">
              {message.content.length > 100 
                ? `${message.content.substring(0, 100)}...`
                : message.content
              }
            </p>
            {message.fileUrl && (
              <p className="text-xs text-gray-500 mt-1">
                📎 Прикреплен файл
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Выберите чат:</h3>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Загрузка чатов...</p>
            </div>
          ) : filteredChats.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Нет доступных чатов для пересылки</p>
          ) : (
            <div className="space-y-2">
              {filteredChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChatId(chat.id)}
                  className={`w-full p-3 rounded-lg border transition-colors flex items-center space-x-3 ${
                    selectedChatId === chat.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {getChatAvatar(chat)}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900">
                      {getChatDisplayName(chat)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {chat.type === 'GROUP' 
                        ? chat.isChannel 
                          ? `Канал • ${chat.members.length} участников` 
                          : `Групповой чат • ${chat.members.length} участников`
                        : 'Приватный чат'
                      }
                    </p>
                  </div>
                  {selectedChatId === chat.id && (
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleForward}
              disabled={!selectedChatId}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Переслать
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Функция для получения имени файла из URL
function getFileNameFromUrl(url: string) {
    return url.split('/').pop() || 'Файл'
}

// Функция для группировки сообщений по датам
function groupMessagesByDate(messages: Message[]) {
  const groups: { date: Date; messages: Message[] }[] = []
  
  messages.forEach(message => {
    const messageDate = new Date(message.createdAt)
    const dateKey = messageDate.toDateString()
    
    const lastGroup = groups[groups.length - 1]
    const lastDateKey = lastGroup ? new Date(lastGroup.date).toDateString() : null
    
    if (lastDateKey === dateKey) {
      lastGroup.messages.push(message)
    } else {
      groups.push({
        date: messageDate,
        messages: [message]
      })
    }
  })
  
  return groups
}

export default function ChatClient({ currentUser, chatInfo }: ChatClientProps) {
  const [newMessage, setNewMessage] = useState('')
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [showStickers, setShowStickers] = useState(false)
  const [replyingTo, setReplyingTo] = useState<MessageWithFiles | null>(null)
  const [editingMessage, setEditingMessage] = useState<MessageWithFiles | null>(null)
  const [forwardingMessage, setForwardingMessage] = useState<MessageWithFiles | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const queryClient = useQueryClient()

  const [isSearchMode, setIsSearchMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MessageWithFiles[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1)

  const [linkPreview, setLinkPreview] = useState<{
    url: string
    title: string
    description: string
    image: string | null
    domain: string
  } | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  
  const { 
    messages, 
    isLoading, 
    sendMessageOptimistic,
    markAsRead
  } = useChatMessages({
    chatId: chatInfo.id,
    currentUser,
    chatInfo
  })

  const extractLinksFromText = (text: string): string[] => {
    const urlRegex = /https?:\/\/[^\s<]+[^\s<.,)]/g
    const matches = text.match(urlRegex)
    return matches || []
  }
  
  // Обновите useEffect для обработки ссылок
  useEffect(() => {
    if (newMessage) {
      const links = extractLinksFromText(newMessage)
      const lastLink = links[links.length - 1]
      
      if (lastLink && lastLink !== linkPreview?.url) {
        setIsLoadingPreview(true)
        getLinkPreview(lastLink)
          .then(preview => {
            setLinkPreview(preview)
          })
          .catch(error => {
            console.error('Error loading link preview:', error)
            setLinkPreview(null)
          })
          .finally(() => {
            setIsLoadingPreview(false)
          })
      } else if (!lastLink) {
        setLinkPreview(null)
      }
    } else {
      setLinkPreview(null)
    }
  }, [newMessage])

  // Получаем информацию о закрепленном сообщении
  const { data: pinnedMessage } = useQuery({
    queryKey: ['pinned-message', chatInfo.id],
    queryFn: () => getPinnedMessage(chatInfo.id),
    refetchInterval: 3000,
    staleTime: 1000,
  })

  // Проверка прав для закрепления сообщений
  const canPinMessages = chatInfo.type === 'PRIVATE' 
    ? true // В приватных чатах все могут закреплять сообщения
    : chatInfo.members.some(member => 
        member.userId === currentUser.id && ['OWNER', 'ADMIN'].includes(member.role)
      )

  // Автоскролл при новом сообщении
  useEffect(() => {
    if (autoScroll && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [messages, autoScroll])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F или Cmd+F для поиска
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setIsSearchMode(true)
      }
      
      // Esc для выхода из поиска
      if (e.key === 'Escape' && isSearchMode) {
        exitSearchMode()
      }
      
      // Навигация по результатам поиска
      if (isSearchMode && searchResults.length > 0) {
        if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
          e.preventDefault()
          navigateSearchResults('next')
        } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
          e.preventDefault()
          navigateSearchResults('prev')
        }
      }
    }
  
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isSearchMode, searchResults, currentSearchIndex])

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100
      setAutoScroll(isAtBottom)
    }
  }

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [])

  // Функция для отметки сообщения как прочитанного
  const handleMarkAsRead = async (messageId: number) => {
    try {
      await markMessageAsRead(messageId)
      queryClient.setQueryData(['chat-messages', chatInfo.id], (old: MessageWithFiles[] = []) => {
        return old.map(msg => {
          if (msg.id === messageId && msg.userId !== currentUser.id) {
            return {
              ...msg,
              isReadByCurrentUser: true,
              readStatus: 'read',
              readCount: (msg.readCount || 0) + 1
            }
          }
          return msg
        })
      })
    } catch (error) {
      console.error('Error marking message as read:', error)
    }
  }

  // Функция для закрепления сообщения
  const handlePinMessage = async (message: MessageWithFiles) => {
    try {
      await pinMessage(chatInfo.id, message.id)
      queryClient.invalidateQueries({ queryKey: ['pinned-message', chatInfo.id] })
      queryClient.invalidateQueries({ queryKey: ['chat-messages', chatInfo.id] })
    } catch (error) {
      console.error('Error pinning message:', error)
      alert('Ошибка при закреплении сообщения')
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    
    setIsSearching(true)
    try {
      const results = await searchMessagesInChat(chatInfo.id, searchQuery.trim())
      
      // Преобразуем результаты
      const transformedResults = results as unknown as MessageWithFiles[]
      setSearchResults(transformedResults)
      
      if (transformedResults.length > 0) {
        setCurrentSearchIndex(0)
        // Ждем немного перед прокруткой
        setTimeout(() => {
          scrollToMessage(transformedResults[0].id)
        }, 200)
      } else {
        setCurrentSearchIndex(-1)
      }
    } catch (error) {
      console.error('Error searching messages:', error)
      alert('Ошибка при поиске сообщений')
    } finally {
      setIsSearching(false)
    }
  }

  // Функция прокрутки к сообщению
  const scrollToMessage = (messageId: number) => {
    // Сначала пытаемся найти элемент
    let messageElement = document.getElementById(`message-${messageId}`)
    
    // Если элемент не найден сразу, ждем и пробуем снова
    if (!messageElement) {
      setTimeout(() => {
        messageElement = document.getElementById(`message-${messageId}`)
        if (messageElement) {
          scrollToElement(messageElement)
        }
      }, 100)
      return
    }
    
    scrollToElement(messageElement)
  }
  
  // Вспомогательная функция для прокрутки к элементу
  const scrollToElement = (element: HTMLElement) => {
    // Убираем предыдущую подсветку
    document.querySelectorAll('.search-highlight').forEach(el => {
      el.classList.remove('search-highlight')
    })
    
    // Добавляем подсветку текущему элементу
    element.classList.add('search-highlight')
    
    // Прокручиваем к элементу
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center',
      inline: 'nearest'
    })
    
    // Убираем подсветку через 3 секунды
    setTimeout(() => {
      element.classList.remove('search-highlight')
    }, 3000)
  }

  // Навигация по результатам поиска
const navigateSearchResults = (direction: 'next' | 'prev') => {
  if (searchResults.length === 0) return
  
  let newIndex
  if (direction === 'next') {
    newIndex = currentSearchIndex + 1
    if (newIndex >= searchResults.length) {
      newIndex = 0 // Циклическая навигация
    }
  } else {
    newIndex = currentSearchIndex - 1
    if (newIndex < 0) {
      newIndex = searchResults.length - 1 // Циклическая навигация
    }
  }
  
  setCurrentSearchIndex(newIndex)
  
  // Добавляем небольшую задержку для гарантии обновления состояния
  setTimeout(() => {
    scrollToMessage(searchResults[newIndex].id)
  }, 100)
}

  // Выход из режима поиска
  const exitSearchMode = () => {
    setIsSearchMode(false)
    setSearchQuery('')
    setSearchResults([])
    setCurrentSearchIndex(-1)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const textToSend = editingMessage ? newMessage.trim() : newMessage.trim()
    const filesToSend = pendingFiles
  
    if (!textToSend && filesToSend.length === 0) return
  
    setIsUploading(true)
  
    try {
      const uploadedFiles: string[] = []
      
      for (const pendingFile of filesToSend) {
        try {
          const formData = new FormData()
          formData.append('file', pendingFile.file)

          setPendingFiles(prev => prev.map(pf => 
            pf.id === pendingFile.id ? { ...pf, progress: 50 } : pf
          ))

          const result = await uploadFile(formData)
          uploadedFiles.push(result.url)

          setPendingFiles(prev => prev.map(pf => 
            pf.id === pendingFile.id ? { ...pf, progress: 100 } : pf
          ))
        } catch (error) {
          console.error('Error uploading file:', error)
        }
      }

      if (editingMessage) {
        await updateMessage(editingMessage.id, textToSend)
        setEditingMessage(null)
      } else {
        let finalContent = textToSend
        
        if (uploadedFiles.length > 0) {
          if (textToSend) {
            finalContent = textToSend
          } else {
            const fileNames = uploadedFiles.map(url => getFileNameFromUrl(url)).join(', ')
            finalContent = `📎 Файлы: ${fileNames}`
          }
          
          await sendMessageOptimistic(
            finalContent, 
            uploadedFiles[0], 
            uploadedFiles,
            undefined,
            replyingTo?.id
          )
        } else {
          await sendMessageOptimistic(finalContent, undefined, undefined, undefined, replyingTo?.id)
        }
      }

      setNewMessage('')
      setPendingFiles([])
      setReplyingTo(null)
      setLinkPreview(null)
      setAutoScroll(true)

    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleSendSticker = async (stickerPath: string) => {
    setIsUploading(true)
    try {
      await sendMessageOptimistic('', undefined, undefined, stickerPath, replyingTo?.id)
      setAutoScroll(true)
      setShowStickers(false)
      setReplyingTo(null)
    } catch (error) {
      console.error('Error sending sticker:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    if (files.length === 0) return

    const validFiles = files.filter(file => {
      const maxSize = file.type.startsWith('image/') || file.type.startsWith('video/') 
        ? 20 * 1024 * 1024 
        : 10 * 1024 * 1024
      
      if (file.size > maxSize) {
        alert(`Файл "${file.name}" слишком большой. Максимальный размер: ${maxSize / 1024 / 1024}MB`)
        return false
      }
      return true
    })

    const newPendingFiles: PendingFile[] = validFiles.map(file => {
      const id = Math.random().toString(36).substr(2, 9)
      let previewUrl: string | undefined

      if (file.type.startsWith('image/')) {
        previewUrl = URL.createObjectURL(file)
      }

      return {
        id,
        file,
        previewUrl,
        progress: 0
      }
    })

    setPendingFiles(prev => [...prev, ...newPendingFiles])
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removePendingFile = (id: string) => {
    setPendingFiles(prev => {
      const fileToRemove = prev.find(pf => pf.id === id)
      if (fileToRemove?.previewUrl) {
        URL.revokeObjectURL(fileToRemove.previewUrl)
      }
      return prev.filter(pf => pf.id !== id)
    })
  }

  const handleReply = (message: MessageWithFiles) => {
    setReplyingTo(message)
    setEditingMessage(null)
  }

  const handleEdit = (message: MessageWithFiles) => {
    setEditingMessage(message)
    setNewMessage(message.content)
    setReplyingTo(null)
  }

  const handleDelete = async (message: MessageWithFiles) => {
    if (confirm('Вы уверены, что хотите удалить это сообщение?')) {
      try {
        await deleteMessage(message.id)
      } catch (error) {
        console.error('Error deleting message:', error)
        alert('Ошибка при удалении сообщения')
      }
    }
  }

  const handleForward = (message: MessageWithFiles) => {
    setForwardingMessage(message)
  }

  const handleForwardConfirm = async (targetChatId: number) => {
    if (!forwardingMessage) return

    try {
      await forwardMessage(forwardingMessage.id, targetChatId)
      alert('Сообщение успешно переслано!')
      setForwardingMessage(null)
    } catch (error) {
      console.error('Error forwarding message:', error)
      alert('Ошибка при пересылке сообщения')
    }
  }

  const cancelReply = () => {
    setReplyingTo(null)
    setEditingMessage(null)
  }

  const handleAddReaction = async (message: MessageWithFiles, emoji: string) => {
    try {
      const updatedReactions = await addReaction(message.id, emoji)
      queryClient.setQueryData(['chat-messages', chatInfo.id], (old: MessageWithFiles[] = []) => {
        return old.map(msg => 
          msg.id === message.id 
            ? { ...msg, reactions: updatedReactions }
            : msg
        )
      })
    } catch (error) {
      console.error('Error adding reaction:', error)
      alert('Ошибка при добавлении реакции')
    }
  }
  
  const handleRemoveReaction = async (message: MessageWithFiles) => {
    try {
      const updatedReactions = await removeReaction(message.id)
      queryClient.setQueryData(['chat-messages', chatInfo.id], (old: MessageWithFiles[] = []) => {
        return old.map(msg => 
          msg.id === message.id 
            ? { ...msg, reactions: updatedReactions }
            : msg
        )
      })
    } catch (error) {
      console.error('Error removing reaction:', error)
      alert('Ошибка при удалении реакции')
    }
  }

  const getChatUserId = () => {
    if (chatInfo.type === 'GROUP') {
      return `/chat-data/${chatInfo.id}`
    }
    const otherMember = chatInfo.members.find(member => member.userId !== currentUser.id)
    return otherMember ? `/profile/${otherMember.user.id}` : 'Приватный чат'
  }

  const getChatAvatar = () => {
    if (chatInfo.type === 'GROUP') {
      if(chatInfo.type === 'GROUP' && chatInfo.avatar) return <img src={String(chatInfo.avatar)} alt="" className="rounded-full" />
      else return '👥' 
    }
    const otherMember = chatInfo.members.find(member => member.userId !== currentUser.id)
    return otherMember?.user.avatar ? <img src={otherMember.user.avatar} alt={String(otherMember.user.name)} className="w-full h-full rounded-full" /> : `${otherMember?.user.name?.[0].toUpperCase()}${otherMember?.user.surname?.[0].toUpperCase()}`
  }

  const getChatName = () => {
    if (chatInfo.type === 'GROUP') {
      return chatInfo.name || 'Групповой чат'
    }
    const otherMember = chatInfo.members.find(member => member.userId !== currentUser.id)
    return otherMember ? `${otherMember.user.name} ${otherMember.user.surname}` : 'Приватный чат'
  }

  const getChatDescription = () => {
    if (chatInfo.type === 'GROUP') {
      if (chatInfo.isChannel) {
        return 'Канал • Могут писать только администраторы'
      }
      const memberCount = chatInfo.members.length
      return `Групповой чат • ${memberCount} участников`
    }
    const otherMember = chatInfo.members.find(member => member.userId !== currentUser.id)
    return otherMember?.user.email || ''
  }

  const canSendMessages = () => {
    if (chatInfo.type === 'PRIVATE') return true
    if (!chatInfo.isChannel) return true
    const currentMember = chatInfo.members.find(member => member.userId === currentUser.id)
    return currentMember && ['ADMIN', 'OWNER'].includes(currentMember.role)
  }

  const groupedMessages = groupMessagesByDate(messages as unknown as Message[])

  const renderChatHeader = () => {
    if (isSearchMode) {
      return (
        <div className="bg-black/40 rounded-xl px-6 py-4 flex-shrink-0">
          <div className="flex items-center space-x-4">
            <button
              onClick={exitSearchMode}
              className="flex-shrink-0 w-10 h-10 text-white hover:bg-white/10 rounded-full flex items-center justify-center transition-colors"
              title="Выйти из поиска"
            >
              ←
            </button>
            
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск сообщений..."
                className="w-full px-4 py-2 bg-white/10 border border-white/20 text-white rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-300"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch()
                  }
                }}
                autoFocus
              />
              
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-12 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300"
                >
                  ✕
                </button>
              )}
            </div>
            
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="flex-shrink-0 w-10 h-10 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              title="Искать"
            >
              {isSearching ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search width={22} height={22} />
              )}
            </button>
          </div>
          
          {/* Панель результатов поиска */}
          {searchResults.length > 0 && (
  <div className="mt-3 flex items-center justify-between text-sm text-white">
    <div className="flex items-center space-x-2">
      <span>Найдено: {searchResults.length}</span>
      {currentSearchIndex >= 0 && (
        <span className="bg-blue-500 px-2 py-1 rounded-full text-xs">
          {currentSearchIndex + 1} / {searchResults.length}
        </span>
      )}
    </div>
    
    <div className="flex items-center space-x-1">
      <button
        onClick={() => navigateSearchResults('prev')}
        disabled={searchResults.length === 0}
        className="p-2 hover:bg-white/10 rounded transition-colors disabled:opacity-50"
        title="Предыдущий результат (↑)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
        </svg>
      </button>
      <button
        onClick={() => navigateSearchResults('next')}
        disabled={searchResults.length === 0}
        className="p-2 hover:bg-white/10 rounded transition-colors disabled:opacity-50"
        title="Следующий результат (↓)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
        </svg>
      </button>
    </div>
  </div>
)}
          
          {searchQuery && searchResults.length === 0 && !isSearching && (
            <div className="mt-2 text-sm text-gray-300 text-center">
              Сообщения не найдены
            </div>
          )}
        </div>
      )
    }

    // Обычная шапка чата с кнопкой поиска
    return (
      <div className="bg-black/40 rounded-xl px-6 py-4 flex-shrink-0 w-full">
        <div className="flex items-center space-x-4 w-full flex items-center justify-between">
          <Link href={getChatUserId()}>
            <div className="flex items-center space-x-4 flex-1">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {getChatAvatar()}
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-semibold text-white">
                  {getChatName()}
                </h1>
                <p className="text-sm text-gray-400">
                  {getChatDescription()}
                </p>
              </div>
            </div>
          </Link>
          
          {chatInfo.type === 'GROUP' && chatInfo.isChannel && (
            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
              Канал
            </span>
          )}
          
          <AnimateIcon animateOnHover>
          <button
            onClick={() => setIsSearchMode(true)}
            className="flex-shrink-0 w-10 h-10 text-white hover:bg-white/10 rounded-full flex items-center justify-center transition-colors"
            title="Поиск сообщений"
          >
            <Search width={22} height={22} />
          </button>
          </AnimateIcon>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-screen relative p-4">
      {/* Шапка чата */}
      {renderChatHeader()}

      {/* Закрепленное сообщение */}
      <PinnedMessage 
        chatId={chatInfo.id}
        currentUser={currentUser}
        chatInfo={chatInfo}
      />

      {/* Область сообщений с прокруткой */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto bg-inherit p-4"
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <div className="text-6xl mb-4">💬</div>
              <p className="text-lg font-medium">Нет сообщений</p>
              <p className="text-sm">Начните общение первым</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {groupedMessages.map((group, groupIndex) =>
              group.messages.map((message, messageIndex) => (
                <MessageItem 
                  key={message.id} 
                  message={message as MessageWithFiles} 
                  currentUser={currentUser}
                  showDate={messageIndex === 0}
                  onReply={handleReply}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onForward={handleForward}
                  onPin={handlePinMessage}
                  onAddReaction={handleAddReaction}
                  onRemoveReaction={handleRemoveReaction}
                  canPin={canPinMessages}
                  markAsRead={handleMarkAsRead}
                  chatInfo={chatInfo}
                  pinnedMessage={pinnedMessage as unknown as MessageWithFiles}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Панель ответа/редактирования */}
      {(replyingTo || editingMessage) && (
        <div className="bg-blue-50 border-t border-blue-200 p-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-800">
                {editingMessage ? 'Редактирование сообщения' : `Ответ ${replyingTo?.user.name} ${replyingTo?.user.surname}`}
              </p>
              {replyingTo && (
                <p className="text-xs text-blue-600 truncate">
                  {replyingTo.content.length > 50 
                    ? `${replyingTo.content.substring(0, 50)}...`
                    : replyingTo.content
                  }
                </p>
              )}
            </div>
            <button
              onClick={cancelReply}
              className="text-blue-600 hover:text-blue-800 text-lg"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Область предпросмотра файлов */}
      {pendingFiles.length > 0 && (
        <div className="bg-gray-100 border-t border-gray-200 p-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Готовы к отправке:</p>
            <button
              onClick={() => setPendingFiles([])}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Удалить все
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingFiles.map((pendingFile) => (
              <div key={pendingFile.id} className="relative bg-white rounded-lg border border-gray-300 p-2 max-w-xs">
                {pendingFile.previewUrl ? (
                  <div className="w-20 h-20 rounded overflow-hidden">
                    <img 
                      src={pendingFile.previewUrl} 
                      alt={pendingFile.file.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded bg-gray-100 flex items-center justify-center">
                    <FileIcon fileUrl={pendingFile.file.name} className="w-8 h-8" />
                  </div>
                )}
                <div className="mt-1 text-xs text-gray-600 truncate max-w-[80px]">
                  {pendingFile.file.name}
                </div>
                {pendingFile.progress > 0 && pendingFile.progress < 100 && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded flex items-center justify-center">
                    <div className="text-white text-xs">{pendingFile.progress}%</div>
                  </div>
                )}
                <button
                  onClick={() => removePendingFile(pendingFile.id)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

{(linkPreview || isLoadingPreview) && (
  <div className="mt-3 p-3 bg-gray-800/80 rounded-lg border border-gray-600/50 backdrop-blur-sm">
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        {isLoadingPreview ? (
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gray-700 rounded-lg animate-pulse"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-700 rounded animate-pulse w-3/4"></div>
              <div className="h-3 bg-gray-700 rounded animate-pulse w-full"></div>
              <div className="h-3 bg-gray-700 rounded animate-pulse w-1/2"></div>
            </div>
          </div>
        ) : linkPreview ? (
          <div className="flex items-start space-x-3">
            {linkPreview.image && (
              <img 
                src={linkPreview.image} 
                alt="Preview" 
                className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
                onError={(e) => {
                  // Если изображение не загружается, скрываем его
                  e.currentTarget.style.display = 'none'
                }}
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white mb-1 truncate">
                {linkPreview.title}
              </p>
              <p className="text-xs text-gray-300 mb-2 line-clamp-2">
                {linkPreview.description}
              </p>
              <div className="flex items-center space-x-2 text-xs text-gray-400">
                <span className="truncate">{linkPreview.domain}</span>
                <span>•</span>
                <a 
                  href={linkPreview.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline truncate flex-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  Открыть ссылку
                </a>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <button
        onClick={() => setLinkPreview(null)}
        className="text-gray-400 hover:text-gray-200 ml-2 flex-shrink-0 transition-colors"
        title="Убрать предпросмотр"
      >
        ✕
      </button>
    </div>
  </div>
)}

      {/* Форма отправки сообщения */}
      {canSendMessages() ? (
        <div className="bg-black/40 rounded-xl px-6 py-4 flex-shrink-0 relative">
          <form onSubmit={handleSendMessage} className="flex space-x-4 items-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex-shrink-0 h-10 w-10 text-white rounded-full hover:opacity-70 disabled:opacity-50 flex items-center justify-center transition-colors cursor-pointer"
              title="Прикрепить файлы"
            >
              {isUploading ? (
                <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FontAwesomeIcon icon={faPaperclip} className="text-xl" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowStickers(!showStickers)}
              disabled={isUploading}
              className="flex-shrink-0 h-10 w-10 text-white rounded-full hover:opacity-70 disabled:opacity-50 flex items-center justify-center transition-colors cursor-pointer"
              title="Стикеры"
            >
              <FontAwesomeIcon icon={faFaceSmile} className="text-xl" />
            </button>
            
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar"
              multiple
            />
            
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={
                editingMessage ? "Редактируйте сообщение..." :
                pendingFiles.length > 0 ? "Добавьте подпись к файлам..." : 
                "Введите сообщение..."
              }
              className="flex-1 px-4 py-2 border border-gray-300 text-white rounded-full focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-transparent"
              disabled={isUploading}
            />

            <button
              type="button"
              onClick={() => {
                setNewMessage("")
                cancelReply()
              }}
              className={`flex-shrink-0 ${newMessage.trim() ? "block" : "hidden"} transition-all duration-300 px-3 py-2 bg-gray-500/60 text-white rounded-full hover:bg-red-400 cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <FontAwesomeIcon icon={faTrash} />
            </button>
            
            <button
              type="submit"
              disabled={(!newMessage.trim() && pendingFiles.length === 0) || isUploading}
              className={`flex-shrink-0 ${newMessage.trim() ? "px-3" : "px-8"} bg-gray-500/60 transition-all duration-300 py-2 text-white rounded-full hover:bg-purple-500 cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isUploading ? '...' : <FontAwesomeIcon icon={faPaperPlane} />}
            </button>
          </form>

          {showStickers && (
            <StickerPicker 
              onStickerSelect={handleSendSticker}
              onClose={() => setShowStickers(false)}
            />
          )}
        </div>
      ) : (
        <div className="bg-yellow-50 border-t border-yellow-200 p-4 text-center flex-shrink-0">
          <p className="text-yellow-800 text-sm">
            В этом канале могут писать только администраторы
          </p>
        </div>
      )}

      {forwardingMessage && (
        <ForwardMessageModal
          message={forwardingMessage}
          onClose={() => setForwardingMessage(null)}
          onForward={handleForwardConfirm}
          currentUser={currentUser}
        />
      )}
    </div>
  )
}