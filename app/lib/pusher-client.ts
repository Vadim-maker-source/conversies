'use client'

import Pusher from 'pusher-js'

// Создаем singleton экземпляр Pusher
let pusherInstance: Pusher | null = null

export const getPusherClient = (): Pusher | null => {
  if (!pusherInstance && typeof window !== 'undefined') {
    pusherInstance = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: '/api/pusher/auth',
      auth: {
        params: {}
      },
      enabledTransports: ['ws', 'wss'],
      forceTLS: true,
      authorizer: (channel) => {
        return {
          authorize: (socketId, callback) => {
            fetch('/api/pusher/auth', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                socket_id: socketId,
                channel_name: channel.name,
              }),
            })
              .then((response) => response.json())
              .then((data) => callback(null, data))
              .catch((error) => callback(error, null));
          },
        };
      },
    });
  }
  
  return pusherInstance;
}

// Экспортируем функцию для получения экземпляра
export const getPusherClientInstance = getPusherClient;

// Для обратной совместимости с существующим кодом
export let pusherClient: Pusher | null = null;

// Инициализируем при необходимости
if (typeof window !== 'undefined') {
  pusherClient = getPusherClient();
}