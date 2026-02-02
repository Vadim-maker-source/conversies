'use client'

import { ReactNode, useEffect, useState } from 'react'
import { StreamVideo, StreamVideoClient, UserRequest } from '@stream-io/video-react-sdk'
import { getCurrentUser } from '@/app/lib/api/user'
import { User as AppUser } from '@/app/lib/types'

type Props = { children: ReactNode }

export function StreamProvider({ children }: Props) {
  const [client, setClient] = useState<StreamVideoClient | null>(null)

  useEffect(() => {
    let isMounted = true

    const init = async () => {
      const user: AppUser | null = await getCurrentUser()
      if (!user || !isMounted) return

      const res = await fetch('/api/stream/token', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch Stream token')
        const data = await res.json()
      console.log('Stream token:', data.token)
      console.log('Stream Video token:', data.token)
      const token = data.token

      const streamUser: UserRequest = {
        id: user.id.toString(),
        name: user.name ?? 'User',
        image: user.avatar ?? undefined,
      }

      const streamClient = new StreamVideoClient({
        apiKey: process.env.NEXT_PUBLIC_STREAM_API_KEY!,
        user: streamUser,
        token,
      })

      setClient(streamClient)
    }

    init()

    return () => {
      isMounted = false
      client?.disconnectUser()
    }
  }, [])

  if (!client) return null

  return <StreamVideo client={client}>{children}</StreamVideo>
}
