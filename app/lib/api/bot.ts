'use server'

import { prisma } from '@/app/lib/prisma'
import { getCurrentUser } from '@/app/lib/api/user'
import { GameType } from '@/app/generated/prisma/enums'

// Новогодние слова для игры "Отгадывание слова"
const NEW_YEAR_WORDS = [
  'СНЕГОВИК',
  'ЕЛКА',
  'ПОДАРОК',
  'САЛЮТ',
  'ХЛОПУШКА',
  'МАНДАРИН',
  'ОЛЕНЬ',
  'САНКИ',
  'СНЕЖИНКА',
  'ГИРЛЯНДА',
  'ШАР',
  'ЗВЕЗДА',
  'КОНФЕТА',
  'СВЕЧА',
  'КОЛЬЦО',
  'БАТУТ',
  'ФЕЙЕРВЕРК',
  'МЕТЕЛЬ',
  'СУГРОБ',
  'МОРОЗ'
]

// Новогодние вопросы для квиза
const NEW_YEAR_QUIZ_QUESTIONS = [
  {
    question: 'В какой стране традиционно встречают Новый год под бой курантов?',
    options: ['Россия', 'Германия', 'Франция', 'Италия'],
    correctAnswer: 0
  },
  {
    question: 'Какой символ наступающего года по восточному календарю в 2024 году?',
    options: ['Дракон', 'Змея', 'Лошадь', 'Коза'],
    correctAnswer: 0
  },
  {
    question: 'Сколько бьет курантов в новогоднюю ночь?',
    options: ['10', '11', '12', '13'],
    correctAnswer: 2
  },
  {
    question: 'Какой напиток традиционно пьют в новогоднюю ночь в России?',
    options: ['Шампанское', 'Водка', 'Вино', 'Сок'],
    correctAnswer: 0
  },
  {
    question: 'Что принято делать под бой курантов?',
    options: ['Загадывать желание', 'Петь песни', 'Танцевать', 'Спать'],
    correctAnswer: 0
  },
  {
    question: 'Какой фильм традиционно показывают в новогоднюю ночь в России?',
    options: ['Ирония судьбы', 'Брильянтовая рука', 'Кавказская пленница', 'Операция Ы'],
    correctAnswer: 0
  },
  {
    question: 'Что символизирует елка на Новый год?',
    options: ['Вечность жизни', 'Богатство', 'Здоровье', 'Удачу'],
    correctAnswer: 0
  },
  {
    question: 'В каком месяце празднуют Новый год в России?',
    options: ['Декабре', 'Январе', 'Феврале', 'Марте'],
    correctAnswer: 1
  }
]

// Получить или создать новогоднего бота
export async function getOrCreateNewYearBot() {
  try {
    let bot = await prisma.bot.findUnique({
      where: { name: 'Новогодний Бот' }
    })

    if (!bot) {
      bot = await prisma.bot.create({
        data: {
          name: 'Новогодний Бот',
          description: 'Веселый бот для новогодних игр и развлечений! 🎄',
          avatar: '🎅',
          isActive: true
        }
      })
    }

    return bot
  } catch (error) {
    console.error('Error getting/creating bot:', error)
    throw error
  }
}

// Добавить бота в чат
export async function addBotToChat(botId: number, chatId: number) {
  try {
    const existingMember = await prisma.botMember.findUnique({
      where: {
        botId_chatId: {
          botId,
          chatId
        }
      }
    })

    if (existingMember) {
      return existingMember
    }

    return await prisma.botMember.create({
      data: {
        botId,
        chatId
      }
    })
  } catch (error) {
    console.error('Error adding bot to chat:', error)
    throw error
  }
}

// Удалить бота из чата
export async function removeBotFromChat(botId: number, chatId: number) {
  try {
    await prisma.botMember.delete({
      where: {
        botId_chatId: {
          botId,
          chatId
        }
      }
    })
  } catch (error) {
    console.error('Error removing bot from chat:', error)
    throw error
  }
}

// Отправить сообщение от бота
export async function sendBotMessage(
  botId: number,
  chatId: number,
  content: string,
  replyToId?: number
) {
  try {
    const message = await prisma.message.create({
      data: {
        content,
        userId: null, // Для ботов userId = null
        botId,
        chatId,
        messageId: replyToId
      },
      include: {
        bot: true,
        replyTo: {
          include: {
            user: true,
            bot: true
          }
        }
      }
    })

    await prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() }
    })

    return message
  } catch (error) {
    console.error('Error sending bot message:', error)
    throw error
  }
}

// Обработка команды /start
export async function handleBotStartCommand(botId: number, chatId: number, userId: number) {
  try {
    // Проверяем, есть ли бот в чате
    const botMember = await prisma.botMember.findUnique({
      where: {
        botId_chatId: {
          botId,
          chatId
        }
      }
    })

    if (!botMember) {
      await addBotToChat(botId, chatId)
    }

    const menuMessage = `🎄 Добро пожаловать в Новогодний Бот! 🎄

Выберите игру:
1️⃣ /quiz - Новогодний квиз
2️⃣ /word - Отгадывание слова

Просто напишите команду, чтобы начать игру!`

    await sendBotMessage(botId, chatId, menuMessage)
  } catch (error) {
    console.error('Error handling /start command:', error)
    throw error
  }
}

// Создать квиз (5 рандомных вопросов как опросы)
export async function createQuiz(botId: number, chatId: number) {
  try {
    // Деактивируем предыдущие активные викторины в этом чате
    await prisma.botGame.updateMany({
      where: {
        botId,
        chatId,
        type: 'POLL',
        isActive: true
      },
      data: {
        isActive: false
      }
    })

    // Выбираем 5 рандомных вопросов
    const shuffled = [...NEW_YEAR_QUIZ_QUESTIONS].sort(() => Math.random() - 0.5)
    const selectedQuestions = shuffled.slice(0, 5)

    // Создаем опросы для каждого вопроса
    const games = []
    for (let i = 0; i < selectedQuestions.length; i++) {
      const question = selectedQuestions[i]
      const game = await prisma.botGame.create({
        data: {
          botId,
          chatId,
          type: 'POLL',
          title: `Новогодний квиз - Вопрос ${i + 1}`,
          question: question.question,
          options: question.options,
          correctAnswer: question.correctAnswer, // Сохраняем правильный ответ для статистики
          isActive: true,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 часа
        }
      })
      games.push(game)

      // Отправляем сообщение с опросом
      let messageText = `🎯 Вопрос ${i + 1}/5\n\n${question.question}\n\n`
      question.options.forEach((option, index) => {
        messageText += `${index + 1}. ${option}\n`
      })
      messageText += `\n🎮 ID игры: ${game.id}\n\nГолосуйте, выбрав вариант ответа!`

      await sendBotMessage(botId, chatId, messageText)
    }

    return games
  } catch (error) {
    console.error('Error creating quiz:', error)
    throw error
  }
}

// Создать игру "Отгадывание слова"
export async function createWordGuessGame(botId: number, chatId: number) {
  try {
    const randomWord = NEW_YEAR_WORDS[Math.floor(Math.random() * NEW_YEAR_WORDS.length)]
    const maskedWord = '_'.repeat(randomWord.length)
    const maxAttempts = 7

    const game = await prisma.botGame.create({
      data: {
        botId,
        chatId,
        type: GameType.WORD_GUESS,
        title: 'Отгадывание слова',
        question: 'Угадайте новогоднее слово!',
        options: [],
        wordToGuess: randomWord,
        guessedLetters: [],
        attempts: 0,
        maxAttempts,
        isActive: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 часа
      }
    })

    const messageText = `🔤 Отгадывание слова!\n\nСлово: ${maskedWord}\n\nПопыток осталось: ${maxAttempts}\n\nНапишите букву или слово целиком!`

    await sendBotMessage(botId, chatId, messageText)

    return game
  } catch (error) {
    console.error('Error creating word guess game:', error)
    throw error
  }
}

// Голосование в опросе (для викторины)
export async function voteInPoll(gameId: number, optionIndex: number) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) throw new Error('Не авторизован')

    const game = await prisma.botGame.findUnique({
      where: { id: gameId },
      include: { votes: true }
    })

    if (!game || !game.isActive) {
      throw new Error('Опрос не найден или неактивен')
    }

    if (optionIndex < 0 || optionIndex >= game.options.length) {
      throw new Error('Неверный вариант ответа')
    }

    // Проверяем, не голосовал ли уже пользователь
    const existingVote = await prisma.botVote.findUnique({
      where: {
        gameId_userId: {
          gameId: game.id,
          userId: currentUser.id
        }
      }
    })

    if (existingVote) {
      // Если пользователь уже голосовал, обновляем его голос
      await prisma.botVote.update({
        where: { id: existingVote.id },
        data: { optionIndex }
      })
    } else {
      // Создаем новый голос
      await prisma.botVote.create({
        data: {
          gameId: game.id,
          userId: currentUser.id,
          optionIndex
        }
      })
    }

    // Возвращаем обновленную статистику
    return getPollStatistics(gameId)
  } catch (error) {
    console.error('Error voting in poll:', error)
    throw error
  }
}

// Получить статистику голосования для опроса
export async function getPollStatistics(gameId: number) {
  try {
    const game = await prisma.botGame.findUnique({
      where: { id: gameId },
      include: {
        votes: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true,
                avatar: true
              }
            }
          }
        }
      }
    })

    if (!game) {
      throw new Error('Опрос не найден')
    }

    // Подсчитываем голоса по каждому варианту
    const voteCounts = game.options.map((_, index) => {
      const votes = game.votes.filter(v => v.optionIndex === index)
      return {
        optionIndex: index,
        option: game.options[index],
        count: votes.length,
        percentage: game.votes.length > 0 
          ? Math.round((votes.length / game.votes.length) * 100) 
          : 0,
        votes: votes.map(v => ({
          userId: v.userId,
          userName: v.user.name || v.user.surname || 'Пользователь',
          votedAt: v.votedAt
        }))
      }
    })

    return {
      gameId: game.id,
      question: game.question,
      options: game.options,
      correctAnswer: game.correctAnswer,
      totalVotes: game.votes.length,
      voteCounts,
      isActive: game.isActive
    }
  } catch (error) {
    console.error('Error getting poll statistics:', error)
    throw error
  }
}

// Получить все активные опросы в чате
export async function getActivePolls(chatId: number) {
  try {
    const polls = await prisma.botGame.findMany({
      where: {
        chatId,
        type: 'POLL',
        isActive: true
      },
      include: {
        votes: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                surname: true,
                avatar: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    return polls.map(game => ({
      gameId: game.id,
      question: game.question,
      options: game.options,
      correctAnswer: game.correctAnswer,
      totalVotes: game.votes.length,
      voteCounts: game.options.map((_, index) => {
        const votes = game.votes.filter(v => v.optionIndex === index)
        return {
          optionIndex: index,
          option: game.options[index],
          count: votes.length,
          percentage: game.votes.length > 0 
            ? Math.round((votes.length / game.votes.length) * 100) 
            : 0
        }
      }),
      isActive: game.isActive
    }))
  } catch (error) {
    console.error('Error getting active polls:', error)
    throw error
  }
}

// Обработка ответа в игре "Отгадывание слова"
export async function handleWordGuessAnswer(
  botId: number,
  chatId: number,
  userId: number,
  guess: string
) {
  try {
    const activeGame = await prisma.botGame.findFirst({
      where: {
        botId,
        chatId,
        type: GameType.WORD_GUESS,
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (!activeGame || !activeGame.wordToGuess) {
      await sendBotMessage(botId, chatId, '❌ Активная игра не найдена. Используйте /word для начала новой игры.')
      return
    }

    const word = activeGame.wordToGuess.toUpperCase()
    const guessUpper = guess.trim().toUpperCase()
    const user = await prisma.user.findUnique({ where: { id: userId } })
    const userName = user?.name || 'Пользователь'

    // Если угадали слово целиком
    if (guessUpper === word) {
      await sendBotMessage(
        botId,
        chatId,
        `🎉 ${userName} угадал слово "${word}"! Поздравляем! 🎊`
      )

      await prisma.botGame.update({
        where: { id: activeGame.id },
        data: { isActive: false }
      })
      return
    }

    // Если угадали одну букву
    if (guessUpper.length === 1) {
      const letter = guessUpper[0]
      
      if (!/[А-ЯЁ]/.test(letter)) {
        await sendBotMessage(botId, chatId, '❌ Пожалуйста, введите русскую букву.')
        return
      }

      if (activeGame.guessedLetters.includes(letter)) {
        await sendBotMessage(botId, chatId, `❌ Буква "${letter}" уже была названа.`)
        return
      }

      const newGuessedLetters = [...activeGame.guessedLetters, letter]
      const isInWord = word.includes(letter)
      const newAttempts = (activeGame.attempts || 0) + 1

      let maskedWord = ''
      for (let i = 0; i < word.length; i++) {
        if (newGuessedLetters.includes(word[i])) {
          maskedWord += word[i]
        } else {
          maskedWord += '_'
        }
      }

      if (isInWord) {
        if (maskedWord === word) {
          await sendBotMessage(
            botId,
            chatId,
            `🎉 ${userName} угадал слово "${word}"! Поздравляем! 🎊`
          )
          await prisma.botGame.update({
            where: { id: activeGame.id },
            data: { isActive: false }
          })
          return
        } else {
          await sendBotMessage(
            botId,
            chatId,
            `✅ Буква "${letter}" есть в слове!\n\nСлово: ${maskedWord}\nПопыток осталось: ${(activeGame.maxAttempts || 7) - newAttempts}`
          )
        }
      } else {
        const remainingAttempts = (activeGame.maxAttempts || 7) - newAttempts
        if (remainingAttempts <= 0) {
          await sendBotMessage(
            botId,
            chatId,
            `❌ Игра окончена! Слово было: "${word}"`
          )
          await prisma.botGame.update({
            where: { id: activeGame.id },
            data: { isActive: false }
          })
          return
        } else {
          await sendBotMessage(
            botId,
            chatId,
            `❌ Буквы "${letter}" нет в слове.\n\nСлово: ${maskedWord}\nПопыток осталось: ${remainingAttempts}`
          )
        }
      }

      await prisma.botGame.update({
        where: { id: activeGame.id },
        data: {
          guessedLetters: newGuessedLetters,
          attempts: newAttempts
        }
      })
    } else {
      // Неправильное слово целиком
      const newAttempts = (activeGame.attempts || 0) + 1
      const remainingAttempts = (activeGame.maxAttempts || 7) - newAttempts

      if (remainingAttempts <= 0) {
        await sendBotMessage(
          botId,
          chatId,
          `❌ Игра окончена! Слово было: "${word}"`
        )
        await prisma.botGame.update({
          where: { id: activeGame.id },
          data: { isActive: false }
        })
      } else {
        let maskedWord = ''
        for (let i = 0; i < word.length; i++) {
          if (activeGame.guessedLetters.includes(word[i])) {
            maskedWord += word[i]
          } else {
            maskedWord += '_'
          }
        }

        await sendBotMessage(
          botId,
          chatId,
          `❌ Неправильно! Это не "${guess}".\n\nСлово: ${maskedWord}\nПопыток осталось: ${remainingAttempts}`
        )

        await prisma.botGame.update({
          where: { id: activeGame.id },
          data: {
            attempts: newAttempts
          }
        })
      }
    }
  } catch (error) {
    console.error('Error handling word guess answer:', error)
    throw error
  }
}

// Обработка сообщения от пользователя (определение команды)
export async function processBotCommand(
  chatId: number,
  userId: number,
  content: string
) {
  try {
    const bot = await getOrCreateNewYearBot()
    
    // Проверяем, есть ли бот в чате
    const botMember = await prisma.botMember.findUnique({
      where: {
        botId_chatId: {
          botId: bot.id,
          chatId
        }
      }
    })

    // Если бота нет в чате, добавляем его при команде /start
    if (!botMember && content.trim() === '/start') {
      await addBotToChat(bot.id, chatId)
      await handleBotStartCommand(bot.id, chatId, userId)
      return true
    }

    // Если бота нет в чате, игнорируем команды
    if (!botMember) {
      return false
    }

    const command = content.trim().toLowerCase()

    if (command === '/start') {
      await handleBotStartCommand(bot.id, chatId, userId)
      return true
    }

    if (command === '/quiz') {
      await createQuiz(bot.id, chatId)
      return true
    }

    if (command === '/word') {
      await createWordGuessGame(bot.id, chatId)
      return true
    }

    // Проверяем, есть ли активная игра
    // Проверяем активные опросы (викторина теперь работает как опросы)
    const activePolls = await prisma.botGame.findMany({
      where: {
        botId: bot.id,
        chatId,
        type: 'POLL',
        isActive: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    // Если есть активные опросы, пользователь может голосовать через UI компонента
    // Здесь мы не обрабатываем текстовые ответы, так как голосование происходит через API

    const activeWordGame = await prisma.botGame.findFirst({
      where: {
        botId: bot.id,
        chatId,
        type: GameType.WORD_GUESS,
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (activeWordGame) {
      // Пытаемся обработать как ответ в игре "Отгадывание слова"
      await handleWordGuessAnswer(bot.id, chatId, userId, command)
      return true
    }

    return false
  } catch (error) {
    console.error('Error processing bot command:', error)
    return false
  }
}

