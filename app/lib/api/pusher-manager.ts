'use client'

import Pusher from 'pusher-js'

class PusherManager {
  private static instance: PusherManager
  private pusher: Pusher | null = null
  private subscriptions: Map<string, any> = new Map()
  private connectionCallbacks: Map<string, Function[]> = new Map()

  private constructor() {
    this.initializePusher()
  }

  static getInstance(): PusherManager {
    if (!PusherManager.instance) {
      PusherManager.instance = new PusherManager()
    }
    return PusherManager.instance
  }

  private initializePusher() {
    if (typeof window === 'undefined') return
    
    if (!this.pusher && process.env.NEXT_PUBLIC_PUSHER_KEY) {
      this.pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
        authEndpoint: '/api/pusher/auth',
        enabledTransports: ['ws', 'wss'],
        forceTLS: true,
        disableStats: true, // Отключаем статистику для производительности
        activityTimeout: 120000, // 2 минуты
        pongTimeout: 30000, // 30 секунд
        wsHost: 'ws-' + process.env.NEXT_PUBLIC_PUSHER_CLUSTER + '.pusher.com',
        wsPort: 443,
        wssPort: 443,
      })
      
      // Мониторинг состояния соединения
      this.pusher.connection.bind('state_change', (states: any) => {
        console.log('Pusher connection state:', states.current)
      })
    }
  }

  subscribe(channelName: string): any {
    if (!this.pusher) {
      console.error('Pusher not initialized')
      return null
    }

    // Если уже подписаны, возвращаем существующий канал
    if (this.subscriptions.has(channelName)) {
      return this.subscriptions.get(channelName)
    }

    const channel = this.pusher.subscribe(channelName)
    this.subscriptions.set(channelName, channel)
    
    return channel
  }

  unsubscribe(channelName: string) {
    if (this.subscriptions.has(channelName)) {
      const channel = this.subscriptions.get(channelName)
      channel.unbind_all()
      channel.unsubscribe()
      this.subscriptions.delete(channelName)
    }
  }

  unsubscribeAll() {
    this.subscriptions.forEach((channel, name) => {
      channel.unbind_all()
      channel.unsubscribe()
    })
    this.subscriptions.clear()
  }

  getClient(): Pusher | null {
    return this.pusher
  }

  disconnect() {
    if (this.pusher) {
      this.unsubscribeAll()
      this.pusher.disconnect()
      this.pusher = null
    }
  }

  isConnected(): boolean {
    return this.pusher?.connection.state === 'connected'
  }
}

// Singleton экспорт
export const pusherManager = PusherManager.getInstance()