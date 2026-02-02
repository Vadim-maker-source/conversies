'use client'

import { useCallback, useRef } from 'react'

export default function useCallManager(callId: string) {
  const connectionManager = useRef<Map<number, {
    pc: RTCPeerConnection
    lastActivity: number
    retries: number
  }>>(new Map())

  const cleanupConnection = useCallback((userId: number) => {
    const connection = connectionManager.current.get(userId)
    if (connection) {
      try {
        connection.pc.close()
      } catch (err) {
        console.warn('Error closing connection:', err)
      }
      connectionManager.current.delete(userId)
    }
  }, [])

  const createConnection = useCallback((userId: number, isInitiator: boolean) => {
    // Закрываем старую связь, если существует
    cleanupConnection(userId)
    
    // Создаем новую
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    }
    
    const pc = new RTCPeerConnection(configuration)
    
    connectionManager.current.set(userId, {
      pc,
      lastActivity: Date.now(),
      retries: 0
    })
    
    return pc
  }, [cleanupConnection])

  const cleanupAll = useCallback(() => {
    connectionManager.current.forEach((connection, userId) => {
      cleanupConnection(userId)
    })
  }, [cleanupConnection])

  return {
    connectionManager: connectionManager.current,
    createConnection,
    cleanupConnection,
    cleanupAll
  }
}