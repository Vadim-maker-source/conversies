'use client'

import { useState, useEffect } from 'react'
import { voteInPoll, getPollResults } from '@/app/lib/api/bot'
import { Poll, User } from '@prisma/client'

interface PollMessageProps {
  poll: Poll & {
    votes: Array<{
      id: number
      userId: number | null
      optionIndex: number
    }>
  }
  currentUser: User
  messageId: number
  isBot: boolean
}

export function PollMessage({ poll, currentUser, messageId, isBot }: PollMessageProps) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [results, setResults] = useState<Array<{
    option: string
    index: number
    votes: number
    percentage: number
  }> | null>(null)

  useEffect(() => {
    // Проверяем, голосовал ли уже пользователь
    const userVote = poll.votes.find(vote => vote.userId === currentUser.id)
    if (userVote) {
      setSelectedOption(userVote.optionIndex)
      setHasVoted(true)
      loadResults()
    }
  }, [poll.votes, currentUser.id])

  const loadResults = async () => {
    try {
      const pollResults = await getPollResults(poll.id)
      setResults(pollResults.results)
    } catch (error) {
      console.error('Error loading poll results:', error)
    }
  }

  const handleVote = async (optionIndex: number) => {
    if (hasVoted || !poll.isActive) return

    try {
      await voteInPoll(poll.id, optionIndex)
      setSelectedOption(optionIndex)
      setHasVoted(true)
      await loadResults()
    } catch (error) {
      console.error('Error voting:', error)
      alert('Ошибка при голосовании')
    }
  }

  const totalVotes = poll.votes.length

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mt-2">
      <div className="flex items-center space-x-2 mb-3">
        {isBot && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Бот</span>}
        <h3 className="font-semibold text-gray-900">{poll.question}</h3>
      </div>

      <div className="space-y-2">
        {poll.options.map((option, index) => {
          const optionVotes = poll.votes.filter(v => v.optionIndex === index).length
          const percentage = totalVotes > 0 ? (optionVotes / totalVotes) * 100 : 0
          const isCorrect = poll.correctAnswer === index
          const isSelected = selectedOption === index

          return (
            <button
              key={index}
              onClick={() => handleVote(index)}
              disabled={hasVoted || !poll.isActive}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                hasVoted
                  ? isCorrect
                    ? 'border-green-500 bg-green-50'
                    : isSelected
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 bg-gray-50'
                  : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'
              } ${!poll.isActive ? 'opacity-75' : ''}`}
            >
              <div className="flex justify-between items-center">
                <span className="flex-1">{option}</span>
                
                {hasVoted && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {optionVotes} ({percentage.toFixed(1)}%)
                    </span>
                    {isCorrect && <span className="text-green-600">✅</span>}
                  </div>
                )}
              </div>

              {hasVoted && (
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full ${
                      isCorrect ? 'bg-green-500' : isSelected ? 'bg-red-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-3 text-xs text-gray-500 flex justify-between">
        <span>Всего голосов: {totalVotes}</span>
        {poll.expiresAt && (
          <span>
            До: {new Date(poll.expiresAt).toLocaleTimeString('ru-RU')}
          </span>
        )}
      </div>

      {hasVoted && poll.correctAnswer !== null && (
        <div className="mt-3 p-2 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            {selectedOption === poll.correctAnswer
              ? '🎉 Правильный ответ!'
              : '💡 Попробуйте еще раз в следующем вопросе!'}
          </p>
        </div>
      )}
    </div>
  )
}