// app/api/livekit/token/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/app/lib/api/user'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const roomName = searchParams.get('room')
    
    if (!roomName) {
      return NextResponse.json({ error: 'Room name is required' }, { status: 400 })
    }

    // const token = await generateLiveKitToken(
    //   roomName,
    //   `user-${currentUser.id}`,
    //   JSON.stringify({
    //     userId: currentUser.id,
    //     name: currentUser.name,
    //     surname: currentUser.surname,
    //     avatar: currentUser.avatar
    //   })
    // )

    return
  } catch (error) {
    console.error('Error generating LiveKit token:', error)
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    )
  }
}