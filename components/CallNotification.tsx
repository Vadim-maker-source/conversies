'use client'

import { useState, useEffect } from 'react'
import { User } from '@/app/lib/types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPhone, faVideo, faTimes, faCheck } from '@fortawesome/free-solid-svg-icons'

interface CallNotificationProps {
  callId: string
  caller: User
  callType: 'audio' | 'video'
  chatId: number
  onAccept: () => Promise<void> | void
  onDecline: () => Promise<void> | void
}

export default function CallNotification({
  callId,
  caller,
  callType,
  chatId,
  onAccept,
  onDecline
}: CallNotificationProps) {
  const [ringing, setRinging] = useState(true)
  const [duration, setDuration] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (!ringing || isProcessing) return

    const timer = setInterval(() => {
      setDuration(prev => prev + 1)
    }, 1000)

    // Автоматическое отклонение через 30 секунд
    const timeout = setTimeout(() => {
      if (ringing && !isProcessing) {
        handleDecline()
      }
    }, 30000)

    return () => {
      clearInterval(timer)
      clearTimeout(timeout)
    }
  }, [ringing, isProcessing])

  const handleAccept = async () => {
    if (isProcessing) return
    
    setIsProcessing(true)
    try {
      await onAccept()
      setRinging(false)
    } catch (error) {
      console.error('Error in accept callback:', error)
      // Если произошла ошибка, всё равно скрываем уведомление
      setRinging(false)
    } finally {
      setIsProcessing(false)
    }
  }
  
  const handleDecline = async () => {
    if (isProcessing) return
    
    setIsProcessing(true)
    try {
      await onDecline()
      setRinging(false)
    } catch (error) {
      console.error('Error in decline callback:', error)
      // Если произошла ошибка, всё равно скрываем уведомление
      setRinging(false)
    } finally {
      setIsProcessing(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (!ringing) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 max-w-md w-full shadow-2xl border border-purple-500/30">
        <div className="text-center">
          {/* Аватар звонящего */}
          <div className="w-24 h-24 mx-auto mb-6 relative">
            <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
              {caller.name?.[0]?.toUpperCase()}
              {caller.surname?.[0]?.toUpperCase()}
            </div>
            
            {/* Анимация звонка */}
            <div className="absolute inset-0">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute inset-0 border-2 border-blue-400 rounded-full animate-ping"
                  style={{
                    animationDelay: `${i * 0.5}s`,
                    animationDuration: '2s'
                  }}
                />
              ))}
            </div>
            
            {/* Иконка типа звонка */}
            <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white">
              <FontAwesomeIcon
                icon={callType === 'video' ? faVideo : faPhone}
                className="w-6 h-6"
              />
            </div>
          </div>

          {/* Информация о звонке */}
          <h2 className="text-2xl font-bold text-white mb-2">
            {caller.name} {caller.surname}
          </h2>
          <p className="text-gray-300 mb-2">
            Входящий {callType === 'video' ? 'видеозвонок' : 'звонок'}
          </p>
          <p className="text-gray-400 text-sm mb-6">
            Звонит... {formatTime(duration)}
          </p>

          {/* Кнопки управления */}
          <div className="flex items-center justify-center space-x-6">
            {/* Кнопка принятия */}
            <button
              onClick={handleAccept}
              disabled={isProcessing}
              className="group flex flex-col items-center space-y-2 disabled:opacity-50"
            >
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white hover:from-green-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-105 shadow-lg">
                <FontAwesomeIcon icon={faCheck} className="w-10 h-10" />
              </div>
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                Принять
              </span>
            </button>

            {/* Кнопка отклонения */}
            <button
              onClick={handleDecline}
              disabled={isProcessing}
              className="group flex flex-col items-center space-y-2 disabled:opacity-50"
            >
              <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center text-white hover:from-red-600 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 shadow-lg">
                <FontAwesomeIcon icon={faTimes} className="w-10 h-10" />
              </div>
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                Отклонить
              </span>
            </button>
          </div>

          {/* Подсказка */}
          <p className="text-xs text-gray-500 mt-8">
            Нажмите клавишу <kbd className="px-2 py-1 bg-gray-700 rounded">↵ Enter</kbd> чтобы принять
          </p>
        </div>
      </div>
    </div>
  )
}