import { getCurrentUser } from '@/app/lib/api/user'
import { StreamChat } from 'stream-chat'

const serverClient = StreamChat.getInstance(
  process.env.NEXT_PUBLIC_STREAM_API_KEY!,
  process.env.STREAM_SECRET_KEY!
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const chatId = searchParams.get('chatId')!

  const user = await getCurrentUser()

  const token = serverClient.createToken(String(user?.id.toString()))

  return Response.json({
    apiKey: process.env.NEXT_PUBLIC_STREAM_API_KEY,
    token,
    userId: user?.id.toString(),
    callId: `chat-${chatId}`,
  })
}
