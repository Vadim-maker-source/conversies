'use client'

import { useState, useEffect, useCallback } from 'react'
import { User } from '@/app/lib/types'
import { getCallParticipants } from '@/app/lib/api/calls'

interface UseCallParticipantsProps {
  callId: number
  currentUser: User
  chatId: number
}

export default function useCallParticipants({
  callId,
  currentUser,
  chatId
}: UseCallParticipantsProps) {
  const [participants, setParticipants] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadParticipants = useCallback(async () => {
    try {
      const participants = await getCallParticipants(callId)
      setParticipants(participants)
    } catch (error) {
      console.error('Error loading call participants:', error)
    } finally {
      setIsLoading(false)
    }
  }, [callId])

  useEffect(() => {
    if (!callId || !currentUser.id) return
    
    loadParticipants()
    
    // Подписка на обновления участников через Pusher
    const subscribeToUpdates = async () => {
      const { getPusherClient } = await import('@/app/lib/pusher-client')
      const pusher = getPusherClient()
      
      if (pusher) {
        const callChannel = pusher.subscribe(`call-${callId}`)
        
        callChannel.bind('participant-joined', async (data: any) => {
          console.log('New participant joined:', data)
          await loadParticipants()
        })
        
        callChannel.bind('participant-left', async (data: any) => {
          console.log('Participant left:', data)
          await loadParticipants()
        })
        
        return () => {
          callChannel.unbind_all()
          callChannel.unsubscribe()
        }
      }
      // Возвращаем undefined если Pusher недоступен
      return undefined
    }
    
    const cleanup = subscribeToUpdates()
    
    return () => {
      if (cleanup) {
        cleanup.then(fn => fn && fn()) // Добавляем проверку на undefined
      }
    }
  }, [callId, currentUser.id, loadParticipants])

  return {
    participants,
    isLoading,
    refreshParticipants: loadParticipants
  }
}