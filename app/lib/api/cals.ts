import { StreamVideoClient } from '@stream-io/video-react-sdk'

export interface StreamCallData {
  apiKey: string
  token: string
  userId: string
  callId: string
}

export async function getStreamCallData(chatId: number): Promise<StreamCallData> {
  const res = await fetch(`/api/calls/stream?chatId=${chatId}`, {
    credentials: 'include',
  })

  if (!res.ok) {
    throw new Error('Failed to get Stream call data')
  }

  return res.json()
}