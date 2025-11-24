// app/api/update-status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { updateOnlineStatus } from '@/app/lib/api/online-status'

export async function POST(request: NextRequest) {
  try {
    const { isOnline } = await request.json()
    
    const result = await updateOnlineStatus(isOnline)
    
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}