import { NextRequest, NextResponse } from 'next/server'
import { updateOnlineStatus, getUserStatus } from '@/app/lib/api/online-status'

/* ============================================================
   POST — обновление статуса (online/offline)
============================================================ */
export async function POST(request: NextRequest) {
  try {
    const { isOnline } = await request.json()

    const result = await updateOnlineStatus(isOnline)

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error updating status:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


/* ============================================================
   GET — получение статуса любого пользователя
============================================================ */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userIdParam = searchParams.get('userId')

    if (!userIdParam) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    const userId = Number(userIdParam)

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid userId' }, { status: 400 })
    }

    const status = await getUserStatus(userId)
    return NextResponse.json(status)
  } catch (err) {
    console.error('Error getting user status:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
