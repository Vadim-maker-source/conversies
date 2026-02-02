'use client'

import { CallControls } from '@/video/CallControls'
import { StreamCall, SpeakerLayout, useStreamVideoClient, Call } from '@stream-io/video-react-sdk'
import { useState } from 'react'

type Props = {
  roomId: string
  onClose: () => void
}

export function CallInterface({ roomId, onClose }: Props) {
  const client = useStreamVideoClient()
  const [call, setCall] = useState<Call | null>(null)
  const [joined, setJoined] = useState(false)

  const handleJoin = async () => {
    if (!client) return
    const newCall = client.call('default', roomId)

    console.log('Client:', client)
console.log('Call before join:', newCall)
    setCall(newCall)
    await newCall.join({ create: true })
    setJoined(true)
  }

  if (!joined) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-500">
        <button
          onClick={handleJoin}
          className="px-6 py-3 bg-green-600 rounded text-white"
        >
          Join Call
        </button>
      </div>
    )
  }

  if (!call) return null

  return (
    <div className="fixed inset-0 bg-black w-full h-screen z-500">
      <StreamCall call={call}>
  <SpeakerLayout />
  <CallControls
    call={call}
    onLeave={async () => {
      await call.leave();
      onClose();
    }}
  />
</StreamCall>
    </div>
  )
}
