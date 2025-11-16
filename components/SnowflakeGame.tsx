'use client'

import { useState, useEffect, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faSnowflake, faBomb, faPlay, faPause } from '@fortawesome/free-solid-svg-icons'

interface GameItem {
  id: number
  type: 'snowflake' | 'bomb'
  x: number
  y: number
  speed: number
}

interface SnowflakeGameProps {
  onComplete: (points: number) => void
  onClose: () => void
}

export default function SnowflakeGame({ onComplete, onClose }: SnowflakeGameProps) {
  const [gameActive, setGameActive] = useState(false)
  const [timeLeft, setTimeLeft] = useState(120) // 2 минуты
  const [score, setScore] = useState(0)
  const [items, setItems] = useState<GameItem[]>([])
  const [gameOver, setGameOver] = useState(false)
  const [itemId, setItemId] = useState(0)
  const [originalPoints, setOriginalPoints] = useState(0) // Исходные очки пользователя

  // Загружаем исходные очки при монтировании
  useEffect(() => {
    // Здесь можно загрузить исходные очки пользователя из БД
    // Пока используем 0 как начальное значение
    setOriginalPoints(0)
  }, [])

  // Таймер игры
  useEffect(() => {
    if (!gameActive || timeLeft <= 0) return

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          endGame()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [gameActive, timeLeft])

  // Генерация предметов
  useEffect(() => {
    if (!gameActive || timeLeft <= 0) return

    const interval = setInterval(() => {
      const newItem: GameItem = {
        id: itemId,
        type: Math.random() > 0.25 ? 'snowflake' : 'bomb', // 75% снежинки, 25% бомбы
        x: Math.random() * 90 + 5, // случайная позиция по X (от 5% до 95%)
        y: 0,
        speed: Math.random() * 1.5 + 0.5 // Уменьшенная скорость: 0.5-2.0 (было 1-3)
      }
      
      setItems(prev => [...prev, newItem])
      setItemId(prev => prev + 1)
    }, 600) // Увеличили интервал до 600ms для меньшего количества предметов

    return () => clearInterval(interval)
  }, [gameActive, timeLeft, itemId])

  // Анимация падения предметов
  useEffect(() => {
    if (!gameActive || timeLeft <= 0) return

    const animationFrame = requestAnimationFrame(() => {
      setItems(prev => 
        prev
          .map(item => ({
            ...item,
            y: item.y + item.speed
          }))
          .filter(item => item.y < 100) // Удаляем предметы, которые упали за экран
      )
    })

    return () => cancelAnimationFrame(animationFrame)
  }, [items, gameActive, timeLeft])

  const startGame = () => {
    setGameActive(true)
    setTimeLeft(120)
    setScore(0)
    setItems([])
    setGameOver(false)
    setItemId(0)
  }

  const endGame = useCallback(() => {
    setGameActive(false)
    setGameOver(true)
    
    // Рассчитываем финальные очки с учетом ограничений
    let finalScore = score
    
    // Если очки отрицательные и их абсолютное значение больше исходных очков
    if (score < 0 && Math.abs(score) > originalPoints) {
      // Сбрасываем до минимального возможного значения (0 или отрицательное, но не больше чем исходные очки)
      finalScore = -originalPoints
    }
    
    // Гарантируем, что очки не уйдут в глубокий минус
    finalScore = Math.max(finalScore, -originalPoints)
    
    onComplete(finalScore)
  }, [score, originalPoints, onComplete])

  const handleItemClick = useCallback((item: GameItem) => {
    if (!gameActive) return

    if (item.type === 'snowflake') {
      // За снежинку +100 очков
      setScore(prev => prev + 100)
    } else {
      // За бомбу -250 очков
      setScore(prev => {
        const newScore = prev - 250
        
        // Проверяем, не ушли ли мы в слишком большой минус
        if (newScore < -originalPoints) {
          return -originalPoints // Ограничиваем минус
        }
        
        return newScore
      })
    }

    // Удаляем предмет при клике
    setItems(prev => prev.filter(i => i.id !== item.id))
  }, [gameActive, originalPoints])

  const handleManualEnd = useCallback(() => {
    if (gameActive) {
      endGame()
    } else if (gameOver) {
      onClose()
    } else {
      startGame()
    }
  }, [gameActive, gameOver, endGame, onClose])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getItemIcon = (type: string) => {
    return type === 'snowflake' ? faSnowflake : faBomb
  }

  const getItemColor = (type: string) => {
    return type === 'snowflake' ? 'text-blue-300' : 'text-red-500'
  }

  const getScoreColor = () => {
    if (score > 0) return 'text-green-400'
    if (score < 0) return 'text-red-400'
    return 'text-yellow-400'
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl w-full max-w-2xl border-2 border-white/20 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/20 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">❄️ Ловля Снежинок</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} className="w-6 h-6" />
          </button>
        </div>

        {/* Game Info */}
        <div className="p-4 bg-white/5 flex justify-between items-center">
          <div className="text-center">
            <div className="text-white font-semibold">Время</div>
            <div className="text-yellow-400 font-bold text-xl">{formatTime(timeLeft)}</div>
          </div>
          
          <div className="text-center">
            <div className="text-white font-semibold">Очки</div>
            <div className={`font-bold text-xl ${getScoreColor()}`}>
              {score >= 0 ? '+' : ''}{score}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-white font-semibold">Предметы</div>
            <div className="flex space-x-2 text-sm">
              <FontAwesomeIcon icon={faSnowflake} className="w-4 h-4 text-blue-300" />
              <span className="text-white">+100</span>
              <FontAwesomeIcon icon={faBomb} className="w-4 h-4 text-red-500" />
              <span className="text-white">-250</span>
            </div>
          </div>
        </div>

        {/* Game Area */}
        <div 
          className="relative h-96 bg-gradient-to-b from-blue-800/30 to-purple-800/30 border-2 border-white/20 overflow-hidden cursor-crosshair"
          onClick={(e) => {
            // Обработка кликов по игровому полю
            if (!gameActive) return
            
            const rect = e.currentTarget.getBoundingClientRect()
            const x = ((e.clientX - rect.left) / rect.width) * 100
            const y = ((e.clientY - rect.top) / rect.height) * 100
            
            // Находим предмет в области клика
            const clickedItem = items.find(item => {
              const itemX = item.x
              const itemY = item.y
              const distance = Math.sqrt(Math.pow(x - itemX, 2) + Math.pow(y - itemY, 2))
              return distance < 8 // Увеличили радиус клика для удобства
            })
            
            if (clickedItem) {
              handleItemClick(clickedItem)
            }
          }}
        >
          {/* Падающие предметы */}
          {items.map((item) => (
            <div
              key={item.id}
              className={`absolute transition-all duration-150 ${
                item.type === 'snowflake' 
                  ? 'animate-pulse cursor-pointer hover:scale-110' 
                  : 'animate-bounce cursor-pointer hover:scale-110'
              }`}
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                transform: 'translate(-50%, -50%)',
                transition: 'transform 0.1s ease'
              }}
              onClick={() => handleItemClick(item)}
            >
              <FontAwesomeIcon 
                icon={getItemIcon(item.type)} 
                className={`w-8 h-8 ${getItemColor(item.type)} drop-shadow-lg filter brightness-125`}
              />
            </div>
          ))}

          {/* Start/Game Over Screen */}
          {!gameActive && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <div className="text-center text-white p-6 max-w-md">
                {gameOver ? (
                  <>
                    <h3 className="text-3xl font-bold mb-4">Игра Окончена!</h3>
                    <p className="text-2xl mb-2">Ваш результат:</p>
                    <p className={`text-4xl font-bold mb-4 ${getScoreColor()}`}>
                      {score >= 0 ? '+' : ''}{score} очков
                    </p>
                    <div className="text-lg mb-6 p-4 bg-white/10 rounded-lg">
                      {score > 2000 ? '🎉 Феноменальный результат! Вы мастер!' : 
                       score > 1000 ? '🎊 Отлично! Вы настоящий охотник за снежинками!' : 
                       score > 500 ? '👍 Хорошая игра! Продолжайте в том же духе!' : 
                       score > 0 ? '😊 Неплохо! С каждым разом будет лучше!' : 
                       score === 0 ? '🤔 Ничего страшного! Попробуйте еще раз!' :
                       '💪 Не сдавайтесь! В следующий раз получится лучше!'}
                    </div>
                    {score < 0 && (
                      <p className="text-yellow-400 text-sm mb-4">
                        💡 Осторожнее с бомбами! Они отнимают очки
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <h3 className="text-3xl font-bold mb-4">Ловля Снежинок</h3>
                    <div className="text-left space-y-3 mb-6 bg-white/10 p-4 rounded-lg">
                      <p className="flex items-center">
                        <FontAwesomeIcon icon={faSnowflake} className="w-5 h-5 text-blue-300 mr-2" />
                        <span>Кликайте на снежинки: <span className="text-green-400">+100 очков</span></span>
                      </p>
                      <p className="flex items-center">
                        <FontAwesomeIcon icon={faBomb} className="w-5 h-5 text-red-500 mr-2" />
                        <span>Избегайте бомбы: <span className="text-red-400">-250 очков</span></span>
                      </p>
                      <p className="flex items-center">
                        <span className="w-5 h-5 text-yellow-400 mr-2">⏱️</span>
                        <span>Время: <span className="text-yellow-400">2 минуты</span></span>
                      </p>
                      <p className="text-sm text-yellow-300 mt-2">
                        💡 Очки могут быть отрицательными, но не ниже вашего текущего баланса
                      </p>
                    </div>
                  </>
                )}
                
                <button
                  onClick={handleManualEnd}
                  className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white py-3 px-8 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105"
                >
                  <FontAwesomeIcon icon={gameOver ? faPlay : faPlay} className="w-5 h-5 mr-2" />
                  {gameOver ? 'Играть снова' : 'Начать игру'}
                </button>
                
                {gameOver && (
                  <button
                    onClick={onClose}
                    className="mt-3 bg-gray-600 hover:bg-gray-700 text-white py-2 px-6 rounded-lg font-medium transition-colors w-full"
                  >
                    Вернуться к ивенту
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-white/20 bg-black/30">
          <div className="flex justify-between items-center">
            <button
              onClick={endGame}
              disabled={!gameActive}
              className={`py-2 px-6 rounded-lg font-medium transition-colors ${
                gameActive 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              <FontAwesomeIcon icon={faTimes} className="w-4 h-4 mr-2" />
              Завершить игру
            </button>

            <div className="text-white text-sm text-center">
              <div className="text-yellow-400">💡 Кликайте точно по предметам!</div>
              <div className="text-xs text-gray-300 mt-1">
                Снежинки: +100 | Бомбы: -250
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}