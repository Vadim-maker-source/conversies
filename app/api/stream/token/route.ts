import { getCurrentUser } from '@/app/lib/api/user'
import { StreamClient } from '@stream-io/node-sdk'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const streamClient = new StreamClient(
    process.env.NEXT_PUBLIC_STREAM_API_KEY!,
    process.env.STREAM_SECRET_KEY!
  )

  const token = streamClient.createToken(user.id.toString())

  return Response.json({
    token,
    user: {
      id: user.id.toString(),
      name: user.name ?? 'User',
      image: user.avatar ?? undefined,
    },
  })
}
