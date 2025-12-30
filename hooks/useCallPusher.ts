'use client'

import { useEffect, useCallback } from 'react'
import { User } from '@/app/lib/types'
import { pusherClient } from '@/app/lib/pusher-client'

interface UseCallPusherProps {
  currentUser: User
  chatId: number
  onIncomingCall: (data: any) => void
  onCallAccepted: (data: any) => void
  onCallEnded: (data: any) => void
  onMediaUpdated: (data: any) => void
  onIceCandidate: (data: any) => void
  onWebRTCSignal: (data: any) => void
}

export default function useCallPusher({
  currentUser,
  chatId,
  onIncomingCall,
  onCallAccepted,
  onCallEnded,
  onMediaUpdated,
  onIceCandidate,
  onWebRTCSignal
}: UseCallPusherProps) {
  useEffect(() => {
    if (!currentUser.id) return

    // Подписываемся на каналы
    const userChannel = pusherClient.subscribe(`user-${currentUser.id}`)
    const chatChannel = pusherClient.subscribe(`chat-${chatId}`)

    // Обработчики событий
    userChannel.bind('call-incoming', onIncomingCall)
    chatChannel.bind('call-accepted', onCallAccepted)
    chatChannel.bind('call-ended', onCallEnded)
    chatChannel.bind('media-updated', onMediaUpdated)
    chatChannel.bind('ice-candidate', onIceCandidate)
    chatChannel.bind('webrtc-signal', onWebRTCSignal)

    // Очистка
    return () => {
      userChannel.unbind_all()
      userChannel.unsubscribe()
      chatChannel.unbind_all()
      chatChannel.unsubscribe()
    }
  }, [
    currentUser.id,
    chatId,
    onIncomingCall,
    onCallAccepted,
    onCallEnded,
    onMediaUpdated,
    onIceCandidate,
    onWebRTCSignal
  ])

  // Функция для отправки сигналов WebRTC
  const sendWebRTCSignal = useCallback((callId: number, signal: any, targetUserId?: number) => {
    const channel = targetUserId 
      ? pusherClient.channel(`user-${targetUserId}`)
      : pusherClient.channel(`call-${callId}`)
    
    if (channel) {
      channel.trigger('client-webrtc-signal', {
        fromUserId: currentUser.id,
        signal,
        callId,
        targetUserId
      })
    }
  }, [currentUser.id])

  // Функция для отправки ICE кандидатов
  const sendIceCandidate = useCallback((callId: number, candidate: any, targetUserId: number) => {
    const channel = pusherClient.channel(`user-${targetUserId}`)
    if (channel) {
      channel.trigger('client-ice-candidate', {
        fromUserId: currentUser.id,
        candidate,
        callId,
        targetUserId
      })
    }
  }, [currentUser.id])

  return {
    sendWebRTCSignal,
    sendIceCandidate
  }
}