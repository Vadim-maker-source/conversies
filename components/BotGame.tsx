'use client'

import { useState } from 'react'
import { User, Message } from '@/app/lib/types'

interface BotGameProps {
  message: Message
  currentUser: User
  onVote: (message: Message, optionIndex: number) => void
}

export function BotGame({ 
  message, 
  currentUser,
  onVote 
}: BotGameProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [isVoting, setIsVoting] = useState(false)
  const [voteResult, setVoteResult] = useState<any>(null)

  // Извлекаем вопрос и варианты ответов из сообщения
  const extractGameData = () => {
    const content = message.content || ''
    const lines = content.split('\n')
    
    // Находим строку с вопросом
    const questionLine = lines.find(line => line.includes('🎄 *Новогодняя викторина!*'))
    const question = questionLine ? questionLine.replace('🎄 *Новогодняя викторина!*', '').trim() : ''
    
    // Извлекаем варианты ответов
    const options: string[] = []
    lines.forEach(line => {
      if (line.match(/^[❶❷❸❹❺❻❼❽❾⓿] /)) {
        const optionText = line.replace(/^[❶❷❸❹❺❻❼❽❾⓿] /, '').trim()
        if (optionText) {
          options.push(optionText)
        }
      }
    })

    // Извлекаем ID игры
    const gameIdMatch = content.match(/🎮 ID игры: (\d+)/)
    const gameId = gameIdMatch ? parseInt(gameIdMatch[1]) : null

    return { question, options, gameId }
  }

  const { question, options, gameId } = extractGameData()

  const handleVote = async (optionIndex: number) => {
    if (isVoting || selectedOption !== null || !gameId) return
    
    setIsVoting(true)
    setSelectedOption(optionIndex)
    
    try {
      await onVote(message, optionIndex)
      // Можно добавить дополнительную логику обработки результата
    } catch (error) {
      console.error('Error voting:', error)
      setSelectedOption(null)
    } finally {
      setIsVoting(false)
    }
  }

  const getOptionEmoji = (index: number) => {
    const emojis = ['❶', '❷', '❸', '❹', '❺', '❻', '❼', '❽', '❾', '⓿']
    return emojis[index] || '⓿'
  }

  if (!question || options.length === 0 || !gameId) {
    return null
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 my-2">
      <div className="flex items-center space-x-2 mb-3">
        <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white text-sm">
          🎮
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Новогодняя викторина</h3>
          <p className="text-sm text-gray-600">{question}</p>
        </div>
      </div>

      <div className="space-y-2">
        {options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleVote(index)}
            disabled={isVoting || selectedOption !== null}
            className={`w-full text-left p-3 rounded-lg border transition-all ${
              selectedOption === index
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
            } ${isVoting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="flex items-center space-x-3">
              <span className="text-lg">{getOptionEmoji(index)}</span>
              <span className="flex-1">{option}</span>
              {selectedOption === index && isVoting && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </button>
        ))}
      </div>

      {voteResult && (
        <div className={`mt-3 p-3 rounded-lg ${
          voteResult.isCorrect 
            ? 'bg-green-100 border border-green-200 text-green-800'
            : 'bg-red-100 border border-red-200 text-red-800'
        }`}>
          <div className="flex items-center space-x-2">
            <span className="text-lg">
              {voteResult.isCorrect ? '🎉' : '❌'}
            </span>
            <div>
              <p className="font-medium">
                {voteResult.isCorrect ? 'Правильно!' : 'Неправильно!'}
              </p>
              <p className="text-sm opacity-90">
                {voteResult.statistics?.totalVotes || 0} участников
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}