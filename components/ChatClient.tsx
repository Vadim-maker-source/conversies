'use client'

import { uploadFile, updateMessage, deleteMessage, forwardMessage, getUserChats, addReaction, removeReaction, pinMessage, unpinMessage, getPinnedMessage, markMessageAsRead, markAllMessagesAsRead, searchMessagesInChat, getLinkPreview, sendVoiceMessage, createPrivateChat } from '@/app/lib/api/chat'
import { User, ChatWithDetails, Message } from '@/app/lib/types'
import { useChatMessages } from '@/hooks/useChatMessages'
import { useState, useRef, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFaceSmile, faPaperclip, faPaperPlane, faTrash, faDownload, faReply, faShare, faEdit, faThumbTack, faMicrophone, faStop, faPause, faPlay } from '@fortawesome/free-solid-svg-icons'
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
import { useIsMobile } from '@/hooks/use-is-mobile'
import { useChatUsersStatus, useUserStatus } from '@/hooks/useOnlineStatus'

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
  isVoiceMessage?: boolean
}

interface VideoRecording {
  isRecording: boolean
  videoBlob: Blob | null
  videoUrl: string | null
  duration: number
  timer: number
  stream: MediaStream | null
}

// Обновить VoiceRecording интерфейс
interface VoiceRecording {
  isRecording: boolean
  audioBlob: Blob | null
  audioUrl: string | null
  duration: number
  timer: number
  stream: MediaStream | null
}

interface MicrophoneAnimation {
  isAnimating: boolean
  scale: number
  opacity: number
}

// Компонент для записи видеосообщений
function VideoRecorder({ 
  onRecordingComplete,
  onRecordingCancel
}: {
  onRecordingComplete: (videoBlob: Blob) => void
  onRecordingCancel: () => void
}) {
  const [recording, setRecording] = useState<VideoRecording>({
    isRecording: false,
    videoBlob: null,
    videoUrl: null,
    duration: 0,
    timer: 0,
    stream: null
  })
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([])
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Получаем список доступных камер
  const getCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const cameras = devices.filter(device => device.kind === 'videoinput')
      setAvailableCameras(cameras)
      return cameras
    } catch (error) {
      console.error('Error getting cameras:', error)
      return []
    }
  }

  // Переключение камеры во время записи
  const switchCamera = async () => {
    if (!recording.isRecording || availableCameras.length <= 1) return
    
    try {
      const nextCameraIndex = (currentCameraIndex + 1) % availableCameras.length
      const currentCamera = availableCameras[nextCameraIndex]
      
      // Останавливаем текущую запись
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }

      // Останавливаем текущий поток
      if (recording.stream) {
        recording.stream.getTracks().forEach(track => track.stop())
      }

      // Получаем новый поток с другой камерой
      const newStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          deviceId: currentCamera.deviceId ? { exact: currentCamera.deviceId } : undefined,
          width: { ideal: 400 },
          height: { ideal: 400 },
          aspectRatio: 1 // Для квадратного видео
        }, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })

      // Обновляем видео элемент с новым потоком
      if (videoRef.current) {
        videoRef.current.srcObject = newStream
        await videoRef.current.play()
      }

      // Пробуем разные MIME types для совместимости
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/webm',
        'video/mp4'
      ]

      let supportedMimeType = ''
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          supportedMimeType = mimeType
          break
        }
      }

      // Создаем новый MediaRecorder с новым потоком
      const newMediaRecorder = new MediaRecorder(newStream, {
        mimeType: supportedMimeType
      })

      mediaRecorderRef.current = newMediaRecorder

      newMediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      newMediaRecorder.onstop = () => {
        const mimeType = supportedMimeType || 'video/webm'
        const videoBlob = new Blob(chunksRef.current, { type: mimeType })
        const videoUrl = URL.createObjectURL(videoBlob)
        
        setRecording(prev => ({
          ...prev,
          videoBlob,
          videoUrl,
          isRecording: false
        }))

        // Освобождаем поток
        if (newStream) {
          newStream.getTracks().forEach(track => track.stop())
        }
      }

      // Запускаем запись с новым потоком
      newMediaRecorder.start(1000)

      setRecording(prev => ({
        ...prev,
        stream: newStream
      }))
      setCurrentCameraIndex(nextCameraIndex)

    } catch (error) {
      console.error('Error switching camera:', error)
      alert('Ошибка при переключении камеры')
    }
  }

  const startRecording = async (cameraIndex: number = 0) => {
    try {
      const cameras = await getCameras()
      if (cameras.length === 0) {
        throw new Error('Камеры не найдены')
      }

      const currentCamera = cameras[cameraIndex]
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          deviceId: currentCamera.deviceId ? { exact: currentCamera.deviceId } : undefined,
          width: { ideal: 400 },
          height: { ideal: 400 },
          aspectRatio: 1 // Квадратное видео для кружочка
        }, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        // Ждем загрузки метаданных видео
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().then(resolve)
            }
          }
        })
      }

      // Пробуем разные MIME types для совместимости
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/webm',
        'video/mp4'
      ]

      let supportedMimeType = ''
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          supportedMimeType = mimeType
          break
        }
      }

      if (!supportedMimeType) {
        console.warn('No supported MIME type found, using default')
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: supportedMimeType
      })
      
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const mimeType = supportedMimeType || 'video/webm'
        const videoBlob = new Blob(chunksRef.current, { type: mimeType })
        const videoUrl = URL.createObjectURL(videoBlob)
        
        setRecording(prev => ({
          ...prev,
          videoBlob,
          videoUrl,
          isRecording: false
        }))

        // Освобождаем поток
        if (stream) {
          stream.getTracks().forEach(track => track.stop())
        }
      }

      mediaRecorder.start(1000)
      setRecording(prev => ({
        ...prev,
        isRecording: true,
        timer: 0,
        duration: 0,
        stream
      }))
      setCurrentCameraIndex(cameraIndex)

      // Таймер с ограничением в 1 минуту
      timerRef.current = setInterval(() => {
        setRecording(prev => {
          const newTimer = prev.timer + 1
          const newDuration = prev.duration + 1
          
          // Автоматическая остановка через 60 секунд
          if (newTimer >= 60) {
            stopRecording()
          }
          
          return {
            ...prev,
            timer: newTimer,
            duration: newDuration
          }
        })
      }, 1000)

    } catch (error) {
      console.error('Error starting video recording:', error)
      alert('Не удалось получить доступ к камере и микрофону. Проверьте разрешения.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording.isRecording && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }

  const sendRecording = () => {
    if (recording.videoBlob) {
      onRecordingComplete(recording.videoBlob)
    }
    cleanup()
  }

  const cleanup = () => {
    if (recording.videoUrl) {
      URL.revokeObjectURL(recording.videoUrl)
    }
    if (recording.stream) {
      recording.stream.getTracks().forEach(track => track.stop())
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setRecording({
      isRecording: false,
      videoBlob: null,
      videoUrl: null,
      duration: 0,
      timer: 0,
      stream: null
    })
    setCurrentCameraIndex(0)
    chunksRef.current = []
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Воспроизведение записанного видео
  const handleVideoPlay = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget
    video.play().catch(error => {
      console.error('Error playing video:', error)
    })
  }

  // Компонент для кругового прогресс-бара
  const CircularProgress = ({ progress, size = 80, strokeWidth = 4 }: { progress: number; size?: number; strokeWidth?: number }) => {
    const radius = (size - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const strokeDashoffset = circumference - (progress / 100) * circumference

    return (
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#ef4444"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30 rounded-xl p-4 mb-3">
      {!recording.videoUrl ? (
        <div className="space-y-4">
          {recording.isRecording ? (
            <div className="text-center">
              <div className="relative w-80 h-80 mx-auto rounded-full overflow-hidden border-4 border-red-500 shadow-2xl">
                {/* Круговое видео */}
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover rounded-full"
                />
                
                {/* Круговой прогресс-бар */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <CircularProgress 
                    progress={(recording.timer / 60) * 100} 
                    size={320}
                    strokeWidth={8}
                  />
                </div>
                
                {/* Индикатор записи и времени */}
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 bg-black/70 rounded-full px-3 py-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-400 text-sm font-bold">
                    {formatTime(recording.timer)}
                  </span>
                </div>
                
                {/* Кнопка переключения камеры */}
                {availableCameras.length > 1 && (
                  <button
                    onClick={switchCamera}
                    className="absolute top-4 right-4 bg-black/70 text-white rounded-full p-2 hover:bg-black/90 transition-colors"
                    title="Переключить камеру"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="text-red-400 text-sm mt-3">
                Запись... {60 - recording.timer}с осталось
              </p>
              {availableCameras.length > 1 && (
                <p className="text-purple-300 text-xs mt-1">
                  Доступно камер: {availableCameras.length}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center">
              <div className="w-48 h-48 mx-auto bg-purple-500/20 rounded-full flex items-center justify-center border-2 border-dashed border-purple-400 mb-4">
                <span className="text-6xl">🎥</span>
              </div>
              <p className="text-purple-300 text-lg font-medium mb-2">
                Кружочек (до 1 минуты)
              </p>
              <p className="text-purple-200 text-sm mb-4">
                Запишите короткое видео сообщение в форме кружочка
              </p>
            </div>
          )}
          
          <div className="flex items-center justify-center space-x-4">
            {!recording.isRecording ? (
              <button
                onClick={() => startRecording()}
                className="flex items-center space-x-3 px-6 py-3 bg-purple-500 text-white rounded-full hover:bg-purple-600 transition-colors shadow-lg font-medium"
              >
                <span className="text-xl">🎥</span>
                <span>Начать запись</span>
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="flex items-center space-x-3 px-6 py-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg font-medium"
              >
                <span className="text-xl">⏹️</span>
                <span>Остановить</span>
              </button>
            )}
            
            <button
              onClick={onRecordingCancel}
              className="px-6 py-3 text-gray-300 hover:text-white transition-colors font-medium"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center">
            {/* Круговое видео для предпросмотра */}
            <div className="relative w-80 h-80 mx-auto rounded-full overflow-hidden bg-black shadow-lg">
              <video 
                ref={videoRef}
                controls 
                src={recording.videoUrl}
                onPlay={handleVideoPlay}
                className="w-full h-full object-cover rounded-full"
                preload="metadata"
              >
                Ваш браузер не поддерживает видео.
              </video>
              
              {/* Круговой прогресс-бар для воспроизведения */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <CircularProgress 
                  progress={0} 
                  size={320}
                  strokeWidth={8}
                />
              </div>
            </div>
            <p className="text-purple-300 text-sm mt-3">
              Длительность: {formatTime(recording.duration)}
            </p>
          </div>
          
          <div className="flex items-center justify-center space-x-3">
            <button
              onClick={sendRecording}
              className="px-5 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
            >
              Отправить
            </button>
            <button
              onClick={() => {
                cleanup()
                startRecording()
              }}
              className="px-5 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              Перезаписать
            </button>
            <button
              onClick={() => {
                cleanup()
                onRecordingCancel()
              }}
              className="px-5 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Компонент для отображения голосового сообщения
function VoiceMessage({ 
  message, 
  isOwn 
}: { 
  message: MessageWithFiles; 
  isOwn: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  const voiceUrl = message.fileUrl

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration)
    const handleEnd = () => setIsPlaying(false)

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended', handleEnd)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended', handleEnd)
    }
  }, [])

  const togglePlayback = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  if (!voiceUrl) return null

  return (
    <div className={`flex items-center space-x-3 p-3 rounded-lg ${
      isOwn ? 'bg-purple-500/20' : 'bg-gray-500/20'
    }`}>
      <audio
        ref={audioRef}
        src={voiceUrl}
        preload="metadata"
      />
      
      <button
        onClick={togglePlayback}
        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          isOwn 
            ? 'bg-purple-500 text-white hover:bg-purple-600' 
            : 'bg-blue-500 text-white hover:bg-blue-600'
        }`}
      >
        <FontAwesomeIcon 
          icon={isPlaying ? faPause : faPlay} 
          className="w-4 h-4 ml-1" 
        />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-white">
            Голосовое сообщение
          </span>
          <span className="text-xs text-gray-300">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
        
        <div className="w-full bg-gray-600 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-100 ${
              isOwn ? 'bg-purple-400' : 'bg-blue-400'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <button
        onClick={() => voiceUrl && downloadFile(voiceUrl, 'voice-message.mp3')}
        className="flex-shrink-0 text-gray-300 hover:text-white transition-colors"
        title="Скачать голосовое сообщение"
      >
        <FontAwesomeIcon icon={faDownload} className="w-4 h-4" />
      </button>
    </div>
  )
}

// Компонент для записи голосового сообщения
// Компонент для записи голосового сообщения (компактная версия)
function VoiceRecorder({ 
  onRecordingComplete,
  onCancel
}: {
  onRecordingComplete: (audioBlob: Blob) => void
  onCancel: () => void
}) {
  const [recording, setRecording] = useState<VoiceRecording>({
    isRecording: false,
    audioBlob: null,
    audioUrl: null,
    duration: 0,
    timer: 0,
    stream: null
  })
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const audioUrl = URL.createObjectURL(audioBlob)
        
        setRecording(prev => ({
          ...prev,
          audioBlob,
          audioUrl,
          isRecording: false
        }))

        // Освобождаем поток
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setRecording(prev => ({
        ...prev,
        isRecording: true,
        timer: 0,
        duration: 0
      }))

      // Таймер
      timerRef.current = setInterval(() => {
        setRecording(prev => ({
          ...prev,
          timer: prev.timer + 1,
          duration: prev.duration + 1
        }))
      }, 1000)

    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Не удалось получить доступ к микрофону')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording.isRecording) {
      mediaRecorderRef.current.stop()
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }

  const sendRecording = () => {
    if (recording.audioBlob) {
      onRecordingComplete(recording.audioBlob)
    }
    cleanup()
  }

  const cleanup = () => {
    if (recording.audioUrl) {
      URL.revokeObjectURL(recording.audioUrl)
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    setRecording({
      isRecording: false,
      audioBlob: null,
      audioUrl: null,
      duration: 0,
      timer: 0,
      stream: null
    })
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-400/30 rounded-xl p-3 mb-3">
      {!recording.audioUrl ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {!recording.isRecording ? (
              <button
                onClick={startRecording}
                className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
              >
                <FontAwesomeIcon icon={faMicrophone} className="w-4 h-4" />
                <span className="font-medium">Начать запись</span>
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="flex items-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
              >
                <FontAwesomeIcon icon={faStop} className="w-4 h-4" />
                <span className="font-medium">Остановить</span>
              </button>
            )}
            
            {recording.isRecording && (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-400 font-mono text-lg font-bold">
                  {formatTime(recording.timer)}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {recording.isRecording && (
              <div className="text-sm text-red-300">
                Запись...
              </div>
            )}
            <button
              onClick={onCancel}
              className="px-3 py-1 text-gray-300 hover:text-white transition-colors text-sm"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <audio 
              controls 
              src={recording.audioUrl}
              className="w-32 h-8"
            />
            <span className="text-sm text-gray-300">
              {formatTime(recording.duration)}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={sendRecording}
              className="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
            >
              Отправить
            </button>
            <button
              onClick={() => {
                cleanup()
                startRecording()
              }}
              className="px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
            >
              Перезаписать
            </button>
            <button
              onClick={() => {
                cleanup()
                onCancel()
              }}
              className="px-3 py-1 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
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
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0)
  const [videoProgress, setVideoProgress] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  
  const fileUrls = message.fileUrl ? [message.fileUrl] : (message.fileUrls || [])
  const isVideoMessage = message.content === '🎥 Видеосообщение'

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const updateProgress = () => {
      if (video.duration > 0) {
        setVideoProgress((video.currentTime / video.duration) * 100)
      }
    }

    video.addEventListener('timeupdate', updateProgress)
    return () => video.removeEventListener('timeupdate', updateProgress)
  }, [])

  const handleVideoPlay = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget
    video.play().catch(error => {
      console.error('Error playing video:', error)
    })
  }

  const handleMediaClick = (url: string, index: number) => {
    setSelectedMediaIndex(index)
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

  if (fileUrls.length === 0) return null

  const imageUrls = fileUrls.filter(url => url.match(/\.(jpg|jpeg|png|gif|webp|avif)$/i))
  const videoUrls = fileUrls.filter(url => url.match(/\.(mp4|mov|avi|webm|mkv)$/i))

  // Компонент для кругового прогресс-бара видео
  const CircularVideoProgress = ({ progress, size = 60, strokeWidth = 3 }: { progress: number; size?: number; strokeWidth?: number }) => {
    const radius = (size - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const strokeDashoffset = circumference - (progress / 100) * circumference

    return (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={isOwn ? "#a855f7" : "#3b82f6"}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-100"
          />
        </svg>
      </div>
    )
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
              <div key={index} className={`relative cursor-pointer overflow-hidden border border-gray-300 group ${
                isVideoMessage ? 'rounded-full w-48 h-48' : 'rounded-lg'
              }`}>
                <video 
                  ref={index === 0 ? videoRef : null}
                  src={fileUrl}
                  className={`w-full h-auto ${isVideoMessage ? 'rounded-full object-cover' : 'rounded-lg max-h-64'}`}
                  controls
                  preload="metadata"
                  onPlay={handleVideoPlay}
                  onClick={() => handleMediaClick(fileUrl, index)}
                >
                  Ваш браузер не поддерживает видео.
                </video>
                
                {/* Круговой прогресс-бар для видеосообщений */}
                {isVideoMessage && (
                  <CircularVideoProgress progress={videoProgress} />
                )}
                
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
                const currentUrl = imageUrls[selectedMediaIndex] || videoUrls[selectedMediaIndex]
                if (currentUrl) {
                  handleDownloadMedia(currentUrl, e)
                }
              }}
              className="absolute -top-12 right-12 text-white text-2xl hover:text-gray-300 z-10 bg-black bg-opacity-50 rounded-full w-8 h-8 flex items-center justify-center"
              title="Скачать"
            >
              <FontAwesomeIcon icon={faDownload} className="w-4 h-4" />
            </button>
            
            {(imageUrls.length > 1 || videoUrls.length > 1) && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const totalMedia = imageUrls.length + videoUrls.length
                    setSelectedMediaIndex(prev => prev > 0 ? prev - 1 : totalMedia - 1)
                  }}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white text-2xl bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-70"
                >
                  ‹
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const totalMedia = imageUrls.length + videoUrls.length
                    setSelectedMediaIndex(prev => prev < totalMedia - 1 ? prev + 1 : 0)
                  }}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white text-2xl bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-70"
                >
                  ›
                </button>
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white bg-black bg-opacity-50 px-3 py-1 rounded-full text-sm">
                  {selectedMediaIndex + 1} / {imageUrls.length + videoUrls.length}
                </div>
              </>
            )}
            
            {imageUrls[selectedMediaIndex] && (
              <img 
                src={imageUrls[selectedMediaIndex]} 
                alt="Просмотр"
                className="max-w-full max-h-screen object-contain mx-auto"
              />
            )}
            
            {videoUrls[selectedMediaIndex] && (
              <div className={`relative ${isVideoMessage ? 'w-96 h-96 mx-auto rounded-full overflow-hidden' : ''}`}>
                <video 
                  src={videoUrls[selectedMediaIndex]}
                  className={`${isVideoMessage ? 'w-full h-full object-cover rounded-full' : 'max-w-full max-h-screen mx-auto'}`}
                  controls
                  autoPlay
                  onPlay={handleVideoPlay}
                >
                  Ваш браузер не поддерживает видео.
                </video>
                
                {/* Круговой прогресс-бар в модальном окне для видеосообщений */}
                {isVideoMessage && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <CircularVideoProgress progress={videoProgress} size={380} strokeWidth={6} />
                  </div>
                )}
              </div>
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

async function createChatByForward(otherUserId: number) {
  const currentUser = await getCurrentUser()
  if(currentUser){
    if(currentUser.id === otherUserId) return null

    await createPrivateChat(otherUserId)
  }
}

// Компонент для отображения пересланного сообщения
function ForwardedMessageHeader({ message }: { message: MessageWithFiles }) {
  if (message.isShared === true && message.originalMessage && message.originalMessage.id !== message.id) {

    const getUserInitials = (user: User) => {
        const first = user.name?.[0]?.toUpperCase() || ''
        const second = user.surname?.[0]?.toUpperCase() || ''
        return first + second || user.email[0].toUpperCase()
    }

    const originalUser = message.originalMessage.user || undefined
    const displayName = originalUser.name && originalUser.surname
      ? `${originalUser.name} ${originalUser.surname}`
      : originalUser.name || originalUser.surname || originalUser.email
    
    const displayAvatar = originalUser.avatar ? <img src={originalUser.avatar} alt={String(originalUser.name)} className="w-5 h-5 rounded-full" /> : <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-[8px] text-center font-bold"> {getUserInitials(originalUser)} </div>

    return (
      <div className="text-xs text-white mb-1 flex items-center space-x-1">
        <FontAwesomeIcon icon={faShare} className="w-3 h-3" />
        <span>Переслано от <br /> <button className="cursor-pointer" onClick={() => createChatByForward(originalUser.id)}><span className="flex items-center gap-1">{displayAvatar}{displayName}</span></button></span>
      </div>
    )
  } else return null
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
  const isVoiceMessage = message.fileUrl && message.fileUrl.match(/\.(mp3|wav|ogg|webm)$/i) && 
                        !message.content && !message.imageUrl

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

  if (isVoiceMessage) {
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
                
                <VoiceMessage message={message} isOwn={isOwn} />
                
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
  const isMobile = useIsMobile()
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

  const [isRecording, setIsRecording] = useState(false)
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false)

  const [showVideoRecorder, setShowVideoRecorder] = useState(false)
const [videoRecording, setVideoRecording] = useState<VideoRecording>({
  isRecording: false,
  videoBlob: null,
  videoUrl: null,
  duration: 0,
  timer: 0,
  stream: null
})

const [microphoneAnimation, setMicrophoneAnimation] = useState<MicrophoneAnimation>({
  isAnimating: false,
  scale: 1,
  opacity: 1
})

// Функция для запуска анимации поднимания микрофона
const animateMicrophone = () => {
  setMicrophoneAnimation({
    isAnimating: true,
    scale: 1.2,
    opacity: 0.7
  })
  
  setTimeout(() => {
    setMicrophoneAnimation({
      isAnimating: false,
      scale: 1,
      opacity: 1
    })
  }, 500)
}

  const handleSendVoiceMessage = async (audioBlob: Blob) => {
    setIsUploading(true)
    try {
      // Создаем FormData для загрузки аудио файла
      const formData = new FormData()
      const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, {
        type: 'audio/webm'
      })
      formData.append('file', audioFile)
  
      // Загружаем файл
      const uploadResult = await uploadFile(formData)
      
      // Отправляем голосовое сообщение используя оптимистичное обновление
      await sendVoiceMessageOptimistic(uploadResult.url, replyingTo?.id)
      
      setShowVoiceRecorder(false)
      setAutoScroll(true)
    } catch (error) {
      console.error('Error sending voice message:', error)
      alert('Ошибка при отправке голосового сообщения')
    } finally {
      setIsUploading(false)
    }
  }

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
    sendVoiceMessageOptimistic,
    sendVideoMessageOptimistic,
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

  const [isDragging, setIsDragging] = useState(false)
const [dragStartY, setDragStartY] = useState(0)
const voiceButtonRef = useRef<HTMLButtonElement>(null)


function UserStatus({ userId, showText = true }: { userId: number; showText?: boolean }) {
  const status = useUserStatus(userId)
  
  if (!status) return null

  const getStatusText = () => {
    if (status.isOnline) return 'в сети'
    if (status.isRecentlyOnline) return 'был(а) недавно'
    
    // Форматируем время последнего посещения
    if (status.lastSeen) {
      const now = new Date()
      const lastSeen = new Date(status.lastSeen)
      const diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60))
      
      if (diffMinutes < 1) return 'только что'
      if (diffMinutes < 60) return `был(а) ${diffMinutes} мин назад`
      if (diffMinutes < 1440) return `был(а) ${Math.floor(diffMinutes / 60)} ч назад`
      
      return `был(а) ${lastSeen.toLocaleDateString('ru-RU')}`
    }
    
    return 'не в сети'
  }

  return (
    <div className="flex items-center space-x-1">
      <div 
        className={`w-2 h-2 rounded-full ${
          status.isOnline 
            ? 'bg-green-500 animate-pulse' 
            : status.isRecentlyOnline 
              ? 'bg-yellow-500' 
              : 'bg-gray-500'
        }`}
        title={getStatusText()}
      />
      {showText && (
        <span className="text-xs text-gray-400">
          {getStatusText()}
        </span>
      )}
    </div>
  )
}


// Обработчики для жеста "потянуть вверх"
const handleVoiceButtonMouseDown = (e: React.MouseEvent) => {
  setIsDragging(true)
  setDragStartY(e.clientY)
}

const handleVoiceButtonTouchStart = (e: React.TouchEvent) => {
  setIsDragging(true)
  setDragStartY(e.touches[0].clientY)
}

const handleDocumentMouseMove = (e: MouseEvent) => {
  if (!isDragging) return
  
  const deltaY = dragStartY - e.clientY
  if (deltaY > 100) { // Потянули вверх на 100px
    setShowVideoRecorder(true)
    setShowVoiceRecorder(false)
    setIsDragging(false)
  }
}

const handleDocumentTouchMove = (e: TouchEvent) => {
  if (!isDragging) return
  
  const deltaY = dragStartY - e.touches[0].clientY
  if (deltaY > 100) { // Потянули вверх на 100px
    setShowVideoRecorder(true)
    setShowVoiceRecorder(false)
    setIsDragging(false)
  }
}

const handleDocumentMouseUp = () => {
  setIsDragging(false)
}

const handleDocumentTouchEnd = () => {
  setIsDragging(false)
}

// Добавить useEffect для обработчиков событий
useEffect(() => {
  if (isDragging) {
    document.addEventListener('mousemove', handleDocumentMouseMove)
    document.addEventListener('touchmove', handleDocumentTouchMove)
    document.addEventListener('mouseup', handleDocumentMouseUp)
    document.addEventListener('touchend', handleDocumentTouchEnd)
  }

  return () => {
    document.removeEventListener('mousemove', handleDocumentMouseMove)
    document.removeEventListener('touchmove', handleDocumentTouchMove)
    document.removeEventListener('mouseup', handleDocumentMouseUp)
    document.removeEventListener('touchend', handleDocumentTouchEnd)
  }
}, [isDragging, dragStartY])

// В компоненте ChatClient заменить handleSendVideoMessage:
const handleSendVideoMessage = async (videoBlob: Blob) => {
  setIsUploading(true)
  try {
    // Создаем FormData для загрузки видео файла
    const formData = new FormData()
    const videoFile = new File([videoBlob], `video-${Date.now()}.webm`, {
      type: 'video/webm'
    })
    formData.append('file', videoFile)

    // Загружаем файл
    const uploadResult = await uploadFile(formData)
    
    // Отправляем видеосообщение используя новую функцию
    await sendVideoMessageOptimistic(uploadResult.url, replyingTo?.id)
    
    setShowVideoRecorder(false)
    setAutoScroll(true)
  } catch (error) {
    console.error('Error sending video message:', error)
    alert('Ошибка при отправке видеосообщения')
  } finally {
    setIsUploading(false)
  }
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

  const getOtherUser = (chatInfo: ChatWithDetails, currentUser: User) => {
    if (chatInfo.type === 'PRIVATE') {
      return chatInfo.members.find(member => member.userId !== currentUser.id)?.user
    }
    return null
  }

  const getChatDescription = (chatInfo: ChatWithDetails, currentUser: User) => {
    if (chatInfo.type === 'GROUP') {
      if (chatInfo.isChannel) {
        return 'Канал • Могут писать только администраторы'
      }
      const memberCount = chatInfo.members.length
      return `Групповой чат • ${memberCount} участников`
    }
    
    // Для приватного чата показываем статус собеседника
    const otherUser = getOtherUser(chatInfo, currentUser)
    if (otherUser) {
      return (
        <div className="flex items-center space-x-2">
          <UserStatus userId={otherUser.id} showText={true} />
        </div>
      )
    }
  }

  function GroupOnlineStatus({ chatId }: { chatId: number }) {
    const usersStatus = useChatUsersStatus(chatId)
    const onlineUsers = usersStatus.filter(user => user.isOnline)
    
    if (onlineUsers.length === 0) return null
  
    return (
      <div className="flex items-center space-x-1 mt-1">
        <div className="flex items-center space-x-1">
          {onlineUsers.slice(0, 3).map(user => (
            <div key={user.userId} className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-gray-400">
                {user.name} {user.surname}
              </span>
            </div>
          ))}
        </div>
        {onlineUsers.length > 3 && (
          <span className="text-xs text-gray-500">
            и ещё {onlineUsers.length - 3} онлайн
          </span>
        )}
      </div>
    )
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
                  {getChatDescription(chatInfo, currentUser)}
              </div>
            </div>
          </Link>
          
          {chatInfo.type === 'GROUP' && (
                <GroupOnlineStatus chatId={chatInfo.id} />
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
        <div className="flex-shrink-0">
          {showVoiceRecorder && (
          <VoiceRecorder
            onRecordingComplete={handleSendVoiceMessage}
            onCancel={() => setShowVoiceRecorder(false)}
          />
        )}

{showVideoRecorder && (
  <VideoRecorder
    onRecordingComplete={handleSendVideoMessage}
    onRecordingCancel={() => setShowVideoRecorder(false)}
  />
)}
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

            {isDragging && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 pointer-events-none">
    <div className="bg-white/90 rounded-xl p-6 text-center">
      <div className="text-4xl mb-4">⬆️</div>
      <p className="text-lg font-medium text-gray-800">
        Тяните вверх для записи видео
      </p>
      <p className="text-sm text-gray-600 mt-2">
        Отпустите, чтобы начать запись кружочка
      </p>
    </div>
  </div>
)}

{!newMessage.trim() && pendingFiles.length === 0 && !editingMessage && (
  <button
    ref={voiceButtonRef}
    type="button"
    onMouseDown={(e) => {
      handleVoiceButtonMouseDown(e)
      animateMicrophone() // Запускаем анимацию при нажатии
    }}
    onTouchStart={(e) => {
      handleVoiceButtonTouchStart(e)
      animateMicrophone() // Запускаем анимацию при касании
    }}
    onClick={() => {
      setShowVoiceRecorder(true)
      setShowVideoRecorder(false)
      animateMicrophone() // Запускаем анимацию при клике
    }}
    disabled={isUploading}
    className="flex-shrink-0 h-10 w-10 text-white rounded-full hover:opacity-70 disabled:opacity-50 flex items-center justify-center transition-all duration-300 cursor-pointer relative group"
    style={{
      transform: `scale(${microphoneAnimation.scale})`,
      opacity: microphoneAnimation.opacity,
      background: microphoneAnimation.isAnimating 
        ? 'radial-gradient(circle, rgba(168,85,247,0.8) 0%, rgba(147,51,234,0.6) 100%)' 
        : 'transparent'
    }}
    title="Удерживайте и тяните вверх для записи видео"
  >
    <FontAwesomeIcon 
      icon={faMicrophone} 
      className="text-xl transition-all duration-300"
      style={{
        transform: microphoneAnimation.isAnimating ? 'scale(1.1)' : 'scale(1)'
      }}
    />
    
    {/* Подсказка при наведении */}
    <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-3 py-1 bg-black/80 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
      Удерживайте и тяните вверх для записи видео
    </div>

    {/* Анимация пульсации */}
    {microphoneAnimation.isAnimating && (
      <div className="absolute inset-0 rounded-full border-2 border-purple-400 animate-ping opacity-60"></div>
    )}
  </button>
)}
            
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