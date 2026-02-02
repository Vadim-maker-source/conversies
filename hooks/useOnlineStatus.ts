'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

/* ================================================================
   Типы
================================================================ */

export interface UserStatus {
  userId: number
  name: string | null
  surname: string | null
  isOnline: boolean
  lastSeen: string | null
  isRecentlyOnline: boolean
}


/* ================================================================
   1. Хук состояния текущего пользователя
================================================================ */

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const initialized = useRef(false)

  const updateStatus = useCallback(async (online: boolean) => {
    try {
      await fetch('/api/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOnline: online })
      })

      setIsOnline(online)
    } catch (err) {
      console.error('Error updating status:', err)
    }
  }, [])

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    updateStatus(true)

    const handleOnline = () => updateStatus(true)
    const handleOffline = () => updateStatus(false)

    const handleVisibilityChange = () => {
      if (!document.hidden) updateStatus(true)
    }

    const handleBeforeUnload = () => {
      navigator.sendBeacon(
        '/api/update-status',
        JSON.stringify({ isOnline: false })
      )
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

  return { isOnline, setOnlineStatus: updateStatus }
}


/* ================================================================
   2. Хук получения статуса любого пользователя
================================================================ */

export function useUserStatus(userId: number) {
  const [status, setStatus] = useState<UserStatus | null>(null)
  const isFetching = useRef(false)

  const fetchStatus = useCallback(async () => {
    if (!userId || isFetching.current) return
    isFetching.current = true
    const lastFetchTime = useRef(0)

    try {
      const now = Date.now()
    if (now - lastFetchTime.current < 30000) {
      return
    }

    isFetching.current = true
    lastFetchTime.current = now
      const res = await fetch(`/api/update-status?userId=${userId}`, {
        method: 'GET',
      })

      // если HTML → выведем текст ошибки, а не сломаем приложение
      const text = await res.text()

      try {
        const json = JSON.parse(text)
        setStatus(json)
      } catch {
        console.error('Received non-JSON from /api/update-status:', text)
      }

    } catch (err) {
      console.error('Error fetching user status:', err)
    } finally {
      isFetching.current = false
    }
  }, [userId])

  useEffect(() => {
    fetchStatus()
    const id = setInterval(fetchStatus, 60000)
    return () => clearInterval(id)
  }, [fetchStatus])

  return status
}


/* ================================================================
   3. Статусы участников чата
================================================================ */

export function useChatUsersStatus(chatId: number) {
  const [usersStatus, setUsersStatus] = useState<UserStatus[]>([])
  const isFetching = useRef(false)

  const fetchStatuses = useCallback(async () => {
    if (!chatId || isFetching.current) return
    isFetching.current = true

    try {
      const res = await fetch(`/api/chat-users-status?chatId=${chatId}`)
      const text = await res.text()

      try {
        const json = JSON.parse(text)
        setUsersStatus(json)
      } catch {
        console.error('Non-JSON from chat-users-status:', text)
      }
    } catch (err) {
      console.error('Error fetching chat users status:', err)
    } finally {
      isFetching.current = false
    }
  }, [chatId])

  useEffect(() => {
    fetchStatuses()

    const id = setInterval(fetchStatuses, 180000)
    return () => clearInterval(id)
  }, [fetchStatuses])

  return usersStatus
}
