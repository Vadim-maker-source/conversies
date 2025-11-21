/**
 * Скрипт для инициализации новогоднего бота в базе данных
 * Запуск: npx tsx scripts/init-bot.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Инициализация новогоднего бота...')

  // Проверяем, существует ли уже бот
  const existingBot = await prisma.bot.findUnique({
    where: { name: 'Новогодний Бот' }
  })

  if (existingBot) {
    console.log('Бот уже существует:', existingBot)
    return
  }

  // Создаем бота
  const bot = await prisma.bot.create({
    data: {
      name: 'Новогодний Бот',
      description: 'Веселый бот для новогодних игр и развлечений! 🎄',
      avatar: '🎅',
      isActive: true
    }
  })

  console.log('Бот успешно создан:', bot)
}

main()
  .catch((e) => {
    console.error('Ошибка:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

