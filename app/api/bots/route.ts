import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/app/lib/prisma'
import { NewYearBot } from '@/app/lib/bots/new-year-bot'

export async function POST(request: NextRequest) {
  try {
    const { botToken, action, chatId, data } = await request.json()
    
    // Проверяем токен бота
    const bot = await prisma.bot.findUnique({
      where: { token: botToken, isActive: true }
    })

    if (!bot) {
      return NextResponse.json({ error: 'Invalid bot token' }, { status: 401 })
    }

    const newYearBot = NewYearBot.getInstance()

    switch (action) {
      case 'send_message':
        await newYearBot.sendMessage(chatId, data.content, data.imageUrl)
        break
        
      case 'start_game':
        await newYearBot.startGame(chatId)
        break
        
      case 'daily_routine':
        await newYearBot.startDailyRoutine(chatId)
        break
        
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Bot API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}