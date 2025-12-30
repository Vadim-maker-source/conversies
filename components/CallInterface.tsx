'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { User } from '@/app/lib/types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPhone,
  faVideo,
  faMicrophone,
  faMicrophoneSlash,
  faVideoSlash,
  faVolumeUp,
  faVolumeMute,
  faPhoneSlash,
  faExpand,
  faUsers
} from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/utils'

interface ParticipantViewProps {
  user: User
  stream: MediaStream | null
  isVideoEnabled: boolean
  isAudioEnabled: boolean
  isSpeaking: boolean
  isLocal: boolean
  onToggleAudio?: () => void
  onToggleVideo?: () => void
  callType: 'audio' | 'video'
  connectionQuality?: string
  onRetryConnection?: (participantId: number) => Promise<boolean>
}

function ParticipantView({
  user,
  stream,
  isVideoEnabled,
  isAudioEnabled,
  isSpeaking,
  isLocal,
  onToggleAudio,
  onToggleVideo,
  callType,
  connectionQuality = 'unknown',
  onRetryConnection
}: ParticipantViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (videoRef.current && stream && isVideoEnabled && callType === 'video') {
      videoRef.current.srcObject = stream
    }
  }, [stream, isVideoEnabled, callType])

  useEffect(() => {
    if (audioRef.current && stream && isAudioEnabled && !isLocal) {
      audioRef.current.srcObject = stream
    }
  }, [stream, isAudioEnabled, isLocal])

  const getUserInitials = () => {
    const first = user.name?.[0]?.toUpperCase() || ''
    const second = user.surname?.[0]?.toUpperCase() || ''
    
    if (first || second) {
      return first + second
    }
    
    // Fallback to avatar or default
    if (user.avatar) {
      return 'I' // Image avatar indicator
    }
    
    return 'U' // User default
  }

  return (
    <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-transparent group hover:border-purple-500 transition-all duration-300">
      <div className="relative w-full h-full aspect-video">
        {callType === 'video' && isVideoEnabled && stream ? (
          <video
            ref={videoRef}
            autoPlay
            muted={isLocal}
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 relative">
            {user.avatar ? (
              <img 
                src={user.avatar} 
                alt={`${user.name} ${user.surname}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-white text-4xl font-bold">
                {getUserInitials()}
              </div>
            )}
            {callType === 'video' && !isVideoEnabled && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <FontAwesomeIcon icon={faVideoSlash} className="w-8 h-8 text-white" />
              </div>
            )}
            {!stream && !isLocal && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                <div className="text-white text-center">
                  <div className="text-sm">Нет видео</div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-4 flex flex-col justify-end">
          <div className="flex items-center justify-between">
            <div className="text-white">
              <div className="font-semibold">
                {user.name} {user.surname}
                {isLocal && ' (Вы)'}
              </div>
              <div className="text-sm opacity-75 flex items-center space-x-2">
                {isAudioEnabled ? (
                  <FontAwesomeIcon icon={faMicrophone} className="w-3 h-3 text-green-400" />
                ) : (
                  <FontAwesomeIcon icon={faMicrophoneSlash} className="w-3 h-3 text-red-400" />
                )}
                {callType === 'video' && !isVideoEnabled && (
                  <FontAwesomeIcon icon={faVideoSlash} className="w-3 h-3 text-red-400" />
                )}
                {/* Connection Quality Indicator and Retry Button */}
                <div className="flex items-center space-x-1">
                  {!isLocal && (
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      connectionQuality === 'good' ? "bg-green-400" :
                      connectionQuality === 'connecting' ? "bg-yellow-400 animate-pulse" :
                      connectionQuality === 'poor' ? "bg-red-400" :
                      "bg-gray-400"
                    )} title={`Connection: ${connectionQuality}`} />
                  )}
                  {!isLocal && (connectionQuality === 'poor' || connectionQuality === 'failed') && onRetryConnection && (
                    <button
                      onClick={() => onRetryConnection(user.id)}
                      className="w-4 h-4 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center transition-colors"
                      title="Повторить подключение"
                    >
                      <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {isSpeaking && (
          <div className="absolute top-4 right-4">
            <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse">
              <FontAwesomeIcon icon={faVolumeUp} className="w-2 h-2 text-white ml-1 mt-1" />
            </div>
          </div>
        )}

        {isLocal && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {onToggleAudio && (
              <button
                onClick={onToggleAudio}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  isAudioEnabled
                    ? "bg-green-500 text-white hover:bg-green-600"
                    : "bg-red-500 text-white hover:bg-red-600"
                )}
                title={isAudioEnabled ? "Выключить микрофон" : "Включить микрофон"}
              >
                <FontAwesomeIcon
                  icon={isAudioEnabled ? faMicrophone : faMicrophoneSlash}
                  className="w-5 h-5"
                />
              </button>
            )}
            {onToggleVideo && callType === 'video' && (
              <button
                onClick={onToggleVideo}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  isVideoEnabled
                    ? "bg-green-500 text-white hover:bg-green-600"
                    : "bg-red-500 text-white hover:bg-red-600"
                )}
                title={isVideoEnabled ? "Выключить камеру" : "Включить камеру"}
              >
                <FontAwesomeIcon
                  icon={isVideoEnabled ? faVideo : faVideoSlash}
                  className="w-5 h-5"
                />
              </button>
            )}
          </div>
        )}
      </div>

      {!isLocal && (
        <audio
          ref={audioRef}
          autoPlay
          className="hidden"
        />
      )}
    </div>
  )
}

interface ParticipantFromDB {
  id: number
  userId: number
  callId: number
  joinedAt: Date
  leftAt: Date | null
  user: {
    id: number
    name: string | null
    surname: string | null
    avatar: string | null
    email?: string
    phone?: string
  }
}

interface CallInterfaceProps {
  callId: string
  currentUser: User
  participantsFromDB: ParticipantFromDB[]
  callType: 'audio' | 'video'
  onToggleAudio: () => void
  onToggleVideo: () => void
  onEndCall: () => void
  onToggleScreenShare?: () => void
  isScreenSharing?: boolean
  localStream: MediaStream | null
  remoteStreams: Map<number, MediaStream>
  isAudioEnabled: boolean
  isVideoEnabled: boolean
  webRTCParticipants?: number[]
  peerConnections?: Map<number, RTCPeerConnection>
  onRetryConnection?: (participantId: number) => Promise<boolean>
}

interface Participant {
  user: User & {
    id: number
    name: string | null
    surname: string | null
    avatar: string | null
    email?: string
    phone?: string
  }
  stream: MediaStream | null
  isVideoEnabled: boolean
  isAudioEnabled: boolean
  isSpeaking: boolean
  isLocal: boolean
  hasStream: boolean
}

export default function CallInterface({
  callId,
  currentUser,
  participantsFromDB,
  callType,
  onToggleAudio,
  onToggleVideo,
  onEndCall,
  onToggleScreenShare,
  isScreenSharing = false,
  localStream,
  remoteStreams,
  isAudioEnabled,
  isVideoEnabled,
  webRTCParticipants = [],
  peerConnections = new Map(),
  onRetryConnection
}: CallInterfaceProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [callDuration, setCallDuration] = useState(0)
  const callContainerRef = useRef<HTMLDivElement>(null)

  // Track call duration
  useEffect(() => {
    if (callType === 'video' && localStream) {
      setConnectionStatus('connected')
    }
    
    const interval = setInterval(() => {
      setCallDuration(prev => prev + 1)
    }, 1000)
    
    return () => clearInterval(interval)
  }, [callType, localStream])

  // Format call duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Get connection quality indicator
  const getConnectionQuality = (participantId: number) => {
    const pc = peerConnections.get(participantId)
    if (!pc) return 'unknown'
    
    switch (pc.connectionState) {
      case 'connected': return 'good'
      case 'connecting': return 'connecting'
      case 'disconnected': return 'poor'
      case 'failed': return 'failed'
      default: return 'unknown'
    }
  }

  // Handle retry connection
  const handleRetryConnection = async (participantId: number) => {
    if (onRetryConnection) {
      const success = await onRetryConnection(participantId)
      if (success) {
        console.log('Connection retry successful for participant:', participantId)
      } else {
        console.log('Connection retry failed for participant:', participantId)
      }
    }
  }

  // Создаем список всех участников
  const allParticipants = useCallback((): Participant[] => {
    const participants: Participant[] = []
    
    // Добавляем всех участников из базы данных
    participantsFromDB.forEach(dbParticipant => {
      const isLocal = dbParticipant.userId === currentUser.id
      const hasStream = isLocal ? !!localStream : remoteStreams.has(dbParticipant.userId)
      const stream = isLocal ? localStream : remoteStreams.get(dbParticipant.userId) || null
      
      participants.push({
        user: dbParticipant.user,
        stream,
        isVideoEnabled: isLocal ? isVideoEnabled : callType === 'video',
        isAudioEnabled: isLocal ? isAudioEnabled : true,
        isSpeaking: false,
        isLocal,
        hasStream
      })
    })
    
    // Добавляем участников из WebRTC, которых нет в базе данных
    webRTCParticipants.forEach(userId => {
      if (!participants.some(p => p.user.id === userId) && userId !== currentUser.id) {
        const stream = remoteStreams.get(userId) || null
        
        participants.push({
          user: {
            id: userId,
            name: 'Участник',
            surname: '',
            avatar: null
          },
          stream,
          isVideoEnabled: callType === 'video',
          isAudioEnabled: true,
          isSpeaking: false,
          isLocal: false,
          hasStream: !!stream
        })
      }
    })
    
    return participants
  }, [participantsFromDB, currentUser.id, localStream, remoteStreams, isVideoEnabled, isAudioEnabled, callType, webRTCParticipants])

  const toggleFullscreen = () => {
    if (!callContainerRef.current) return

    if (!document.fullscreenElement) {
      callContainerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const getGridClass = (count: number) => {
    if (count === 1) return "grid-cols-1"
    if (count === 2) return "grid-cols-2"
    if (count === 3) return "grid-cols-3"
    if (count === 4) return "grid-cols-2"
    return "grid-cols-3"
  }

  const participants = allParticipants()

  return (
    <div
      ref={callContainerRef}
      className={cn(
        "fixed inset-0 bg-gradient-to-br from-gray-900 to-black z-50 flex flex-col transition-all duration-300",
        isFullscreen ? "p-0" : "p-4"
      )}
    >
      <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur-sm">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={cn(
              "w-3 h-3 rounded-full animate-pulse",
              connectionStatus === 'connected' ? (callType === 'video' ? "bg-purple-500" : "bg-blue-500") : "bg-yellow-500"
            )} />
            <span className="text-white font-semibold">
              {callType === 'video' ? 'Видеозвонок' : 'Аудиозвонок'}
            </span>
            <span className="text-sm text-gray-300">
              ({formatDuration(callDuration)})
            </span>
          </div>
          <div className="text-sm text-gray-300">
            ID: {callId.substring(0, 8)}
          </div>
          <div className={cn(
            "px-2 py-1 rounded-full text-xs font-medium",
            connectionStatus === 'connected' ? "bg-green-500/20 text-green-300" :
            connectionStatus === 'connecting' ? "bg-yellow-500/20 text-yellow-300" :
            "bg-red-500/20 text-red-300"
          )}>
            {connectionStatus === 'connected' ? 'Подключено' :
             connectionStatus === 'connecting' ? 'Подключение...' :
             'Отключено'}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-sm text-gray-300">
            <FontAwesomeIcon icon={faUsers} className="w-4 h-4" />
            <span>{participants.length} участников</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-4">
        {callType === 'audio' ? (
          <div className="max-w-md mx-auto h-full flex flex-col items-center justify-center space-y-8">
            {participants.map((participant) => (
              <div
                key={participant.user.id}
                className="flex items-center space-x-4 p-4 bg-gray-800/50 rounded-xl w-full border border-gray-700/50 hover:border-purple-500/50 transition-colors"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold relative">
                  {participant.user.name?.[0]?.toUpperCase()}
                  {participant.user.surname?.[0]?.toUpperCase()}
                  {/* Connection Quality Indicator */}
                  {!participant.isLocal && (
                    <div className={cn(
                      "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-800",
                      getConnectionQuality(participant.user.id) === 'good' ? "bg-green-400" :
                      getConnectionQuality(participant.user.id) === 'connecting' ? "bg-yellow-400 animate-pulse" :
                      getConnectionQuality(participant.user.id) === 'poor' ? "bg-red-400" :
                      "bg-gray-400"
                    )} title={`Connection: ${getConnectionQuality(participant.user.id)}`} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-white font-semibold">
                    {participant.user.name} {participant.user.surname}
                    {participant.isLocal && ' (Вы)'}
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-300">
                    {participant.isAudioEnabled ? (
                      <>
                        <FontAwesomeIcon icon={faMicrophone} className="w-3 h-3 text-green-400" />
                        <span>Микрофон включен</span>
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faMicrophoneSlash} className="w-3 h-3 text-red-400" />
                        <span>Микрофон выключен</span>
                      </>
                    )}
                    {!participant.isLocal && (
                      <span className="text-xs text-gray-500">
                        • {getConnectionQuality(participant.user.id)}
                      </span>
                    )}
                  </div>
                </div>
                {participant.isSpeaking && (
                  <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse">
                    <FontAwesomeIcon icon={faVolumeUp} className="w-2 h-2 text-white ml-1 mt-1" />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className={`grid ${getGridClass(participants.length)} gap-4 h-full`}>
            {participants.map(participant => (
              <ParticipantView
                key={participant.user.id}
                user={participant.user}
                stream={participant.stream}
                isVideoEnabled={participant.isVideoEnabled}
                isAudioEnabled={participant.isAudioEnabled}
                isSpeaking={participant.isSpeaking}
                isLocal={participant.isLocal}
                onToggleAudio={participant.isLocal ? onToggleAudio : undefined}
                onToggleVideo={participant.isLocal ? onToggleVideo : undefined}
                callType={callType}
                connectionQuality={!participant.isLocal ? getConnectionQuality(participant.user.id) : 'local'}
                onRetryConnection={onRetryConnection}
              />
            ))}
          </div>
        )}
      </div>

      <div className="p-6 bg-black/50 backdrop-blur-sm border-t border-gray-800">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={onToggleAudio}
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300",
                isAudioEnabled
                  ? "bg-gray-700 hover:bg-gray-600 text-white"
                  : "bg-red-500 hover:bg-red-600 text-white"
              )}
              title={isAudioEnabled ? "Выключить микрофон" : "Включить микрофон"}
            >
              <FontAwesomeIcon
                icon={isAudioEnabled ? faMicrophone : faMicrophoneSlash}
                className="w-6 h-6"
              />
            </button>

            {callType === 'video' && (
              <button
                onClick={onToggleVideo}
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300",
                  isVideoEnabled
                    ? "bg-gray-700 hover:bg-gray-600 text-white"
                    : "bg-red-500 hover:bg-red-600 text-white"
                )}
                title={isVideoEnabled ? "Выключить камеру" : "Включить камеру"}
              >
                <FontAwesomeIcon
                  icon={isVideoEnabled ? faVideo : faVideoSlash}
                  className="w-6 h-6"
                />
              </button>
            )}

            <button
              onClick={onEndCall}
              className="w-20 h-20 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white transition-all duration-300 transform hover:scale-105"
              title="Завершить звонок"
            >
              <FontAwesomeIcon icon={faPhoneSlash} className="w-8 h-8" />
            </button>

            {callType === 'video' && onToggleScreenShare && (
              <button
                onClick={onToggleScreenShare}
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300",
                  isScreenSharing
                    ? "bg-purple-500 hover:bg-purple-600 text-white"
                    : "bg-gray-700 hover:bg-gray-600 text-white"
                )}
                title={isScreenSharing ? "Остановить демонстрацию" : "Демонстрация экрана"}
              >
                <div className="relative">
                  <div className="w-6 h-4 border-2 border-current rounded-sm" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-current rounded-full" />
                </div>
              </button>
            )}

            <button
              onClick={toggleFullscreen}
              className="w-14 h-14 rounded-full bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center transition-all duration-300"
              title={isFullscreen ? "Выйти из полноэкранного режима" : "Полноэкранный режим"}
            >
              <FontAwesomeIcon icon={faExpand} className="w-6 h-6" />
            </button>

            <button
              onClick={() => setShowParticipants(!showParticipants)}
              className="w-14 h-14 rounded-full bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center transition-all duration-300 relative"
              title="Участники звонка"
            >
              <FontAwesomeIcon icon={faUsers} className="w-6 h-6" />
              {participants.length > 1 && (
                <span className="absolute -top-1 -right-1 w-6 h-6 bg-purple-500 text-xs rounded-full flex items-center justify-center">
                  {participants.length - 1}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {showParticipants && (
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-gray-900/95 backdrop-blur-sm border-l border-gray-800 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white font-semibold">Участники ({participants.length})</h3>
            <button
              onClick={() => setShowParticipants(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="space-y-3">
            {participants.map(participant => (
              <div
                key={participant.user.id}
                className="flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold relative">
                  {participant.user.name?.[0]?.toUpperCase()}
                  {participant.user.surname?.[0]?.toUpperCase()}
                  {/* Connection Quality Indicator */}
                  {!participant.isLocal && (
                    <div className={cn(
                      "absolute -bottom-1 -right-1 w-3 h-3 rounded-full border border-gray-800",
                      getConnectionQuality(participant.user.id) === 'good' ? "bg-green-400" :
                      getConnectionQuality(participant.user.id) === 'connecting' ? "bg-yellow-400 animate-pulse" :
                      getConnectionQuality(participant.user.id) === 'poor' ? "bg-red-400" :
                      "bg-gray-400"
                    )} title={`Connection: ${getConnectionQuality(participant.user.id)}`} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium">
                    {participant.user.name} {participant.user.surname}
                    {participant.isLocal && ' (Вы)'}
                  </div>
                  <div className="text-xs text-gray-400 flex items-center space-x-2">
                    {participant.isAudioEnabled ? (
                      <span className="text-green-400">Микрофон вкл</span>
                    ) : (
                      <span className="text-red-400">Микрофон выкл</span>
                    )}
                    {callType === 'video' && (
                      <>
                        <span>•</span>
                        {participant.isVideoEnabled ? (
                          <span className="text-green-400">Камера вкл</span>
                        ) : (
                          <span className="text-red-400">Камера выкл</span>
                        )}
                      </>
                    )}
                    {!participant.hasStream && (
                      <>
                        <span>•</span>
                        <span className="text-yellow-400">Нет подключения</span>
                      </>
                    )}
                    {!participant.isLocal && (
                      <>
                        <span>•</span>
                        <span className="text-gray-500 text-xs">
                          {getConnectionQuality(participant.user.id)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {participant.isSpeaking && (
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}