// hooks/useOnlineStatus.ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { updateOnlineStatus, getUserStatus, getChatUsersStatus } from '@/app/lib/api/online-status'

interface UserStatus {
  userId: number
  name: string | null
  surname: string | null
  isOnline: boolean
  lastSeen: Date
  isRecentlyOnline: boolean
}

// Кэш для статусов пользователей
const statusCache = new Map<number, {
  status: { isOnline: boolean; lastSeen: Date; isRecentlyOnline: boolean }
  timestamp: number
}>()

const CACHE_DURATION = 60000 // 1 минута кэширования

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const isInitialized = useRef(false)

  const updateStatus = useCallback(async (online: boolean) => {
    try {
      await updateOnlineStatus(online)
      setIsOnline(online)
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }, [])

  useEffect(() => {
    if (isInitialized.current) return
    isInitialized.current = true

    // Устанавливаем статус "в сети" только один раз при монтировании
    updateStatus(true)

    const handleOnline = () => updateStatus(true)
    const handleOffline = () => updateStatus(false)
    
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateStatus(true)
      }
    }

    const handleBeforeUnload = () => {
      navigator.sendBeacon('/api/update-status', JSON.stringify({ isOnline: false }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [updateStatus])

  return { isOnline, updateStatus }
}

// Улучшенный хук для статуса пользователя с кэшированием
export function useUserStatus(userId: number) {
  const [status, setStatus] = useState<{
    isOnline: boolean
    lastSeen: Date
    isRecentlyOnline: boolean
  } | null>(null)
  
  const lastFetchTime = useRef(0)
  const isFetching = useRef(false)

  const fetchStatus = useCallback(async (force = false) => {
    const now = Date.now()
    const cached = statusCache.get(userId)
    
    // Используем кэш, если он свежий и не форсируем обновление
    if (!force && cached && now - cached.timestamp < CACHE_DURATION) {
      setStatus(cached.status)
      return
    }

    // Предотвращаем одновременные запросы
    if (isFetching.current && !force) return
    isFetching.current = true

    try {
      const userStatus = await getUserStatus(userId)
      if (userStatus) {
        const statusData = {
          isOnline: userStatus.isOnline,
          lastSeen: userStatus.lastSeen,
          isRecentlyOnline: userStatus.isRecentlyOnline
        }
        
        statusCache.set(userId, {
          status: statusData,
          timestamp: now
        })
        setStatus(statusData)
      }
    } catch (error) {
      console.error('Error fetching user status:', error)
      // В случае ошибки используем кэшированные данные, если они есть
      if (cached) {
        setStatus(cached.status)
      }
    } finally {
      isFetching.current = false
      lastFetchTime.current = now
    }
  }, [userId])

  useEffect(() => {
    fetchStatus()
    
    // Увеличиваем интервал обновления до 2 минут
    const interval = setInterval(() => fetchStatus(), 120000)
    
    return () => clearInterval(interval)
  }, [fetchStatus])

  return status
}

// Хук для статусов участников чата
export function useChatUsersStatus(chatId: number) {
  const [usersStatus, setUsersStatus] = useState<UserStatus[]>([])
  const isFetching = useRef(false)

  const fetchStatuses = useCallback(async () => {
    if (isFetching.current) return
    isFetching.current = true

    try {
      const statuses = await getChatUsersStatus(chatId)
      setUsersStatus(statuses)
    } catch (error) {
      console.error('Error fetching chat users status:', error)
    } finally {
      isFetching.current = false
    }
  }, [chatId])

  useEffect(() => {
    fetchStatuses()
    
    // Увеличиваем интервал для групповых чатов
    const interval = setInterval(fetchStatuses, 180000) // 3 минуты
    
    return () => clearInterval(interval)
  }, [fetchStatuses])

  return usersStatus
}