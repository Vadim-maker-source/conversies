'use client'

import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faGift, faSnowflake, faStar, faCoins, faGamepad } from '@fortawesome/free-solid-svg-icons'
import { getEventProgress, updateEventPoints, claimEventMilestone } from '@/app/lib/api/events'
import { toast } from 'sonner'
import SnowflakeGame from './SnowflakeGame'

interface EventModalProps {
    user: any
    onClose: () => void
}

interface Milestone {
    points: number
    giftId: number
    giftName: string
    giftPrice: number
    claimed: boolean
}

export default function EventModal({ user, onClose }: EventModalProps) {
    const [currentPoints, setCurrentPoints] = useState(0)
    const [milestones, setMilestones] = useState<Milestone[]>([])
    const [loading, setLoading] = useState(false)
    const [showGame, setShowGame] = useState(false)

    // Инициализируем milestones
    useEffect(() => {
        const initialMilestones: Milestone[] = [
            { points: 1000, giftId: 31, giftName: "Снежинка", giftPrice: 500, claimed: false },
            { points: 2000, giftId: 32, giftName: "Снеговик", giftPrice: 2500, claimed: false },
            { points: 3000, giftId: 33, giftName: "Санта Клаус", giftPrice: 2700, claimed: false },
            { points: 4000, giftId: 34, giftName: "Рождественская ёлка", giftPrice: 4100, claimed: false },
            { points: 5000, giftId: 35, giftName: "Новый год!", giftPrice: 5672, claimed: false }
        ]
        setMilestones(initialMilestones)
        loadProgress()
    }, [])

    const loadProgress = async () => {
        const progress = await getEventProgress()
        setCurrentPoints(progress.points)
        
        // Обновляем claimed статусы
        setMilestones(prev => prev.map(milestone => ({
            ...milestone,
            claimed: progress.claimedMilestones.includes(milestone.points)
        })))
    }

    const claimReward = async (milestone: Milestone) => {
        if (milestone.claimed) return
        
        setLoading(true)
        try {
            const result = await claimEventMilestone(milestone.points, milestone.giftId)
            
            if (result.success) {
                // Обновляем локальное состояние
                setMilestones(prev => prev.map(m => 
                    m.points === milestone.points 
                        ? { ...m, claimed: true }
                        : m
                ))
                toast.success(`Получен подарок: ${milestone.giftName}!`)
            } else {
                toast.error(result.error || 'Ошибка при получении награды')
            }
        } catch (error) {
            toast.error('Ошибка при получении награды')
        } finally {
            setLoading(false)
        }
    }

    const handleGameComplete = async (pointsEarned: number) => {
        const result = await updateEventPoints(pointsEarned)
        if (result.success) {
          setCurrentPoints(result.totalPoints)
          
          // Показываем соответствующее сообщение
          if (pointsEarned > 0) {
            toast.success(`🎉 +${pointsEarned} очков! Теперь у вас ${result.totalPoints} очков`)
          } else if (pointsEarned < 0) {
            toast.warning(`😅 ${pointsEarned} очков. Будьте осторожнее с бомбами!`)
          } else {
            toast.info(`🤔 0 очков. Попробуйте еще раз!`)
          }
          
          await loadProgress() // Обновляем статусы milestones
        } else {
          toast.error('Ошибка при начислении очков')
        }
      }

    const getProgressPercentage = () => {
        const maxPoints = 5000
        return Math.min((currentPoints / maxPoints) * 100, 100)
    }

    if (showGame) {
        return (
            <SnowflakeGame 
                onComplete={handleGameComplete}
                onClose={() => setShowGame(false)}
            />
        )
    }

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-blue-900 via-purple-900 to-blue-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border-2 border-white/20">
                {/* Header */}
                <div className="relative p-6 border-b border-white/20">
                    <div className="text-center">
                        <div className="flex items-center justify-center space-x-3 mb-2">
                            <FontAwesomeIcon icon={faSnowflake} className="w-8 h-8 text-blue-300 animate-pulse" />
                            <h2 className="text-3xl font-bold text-white">Зимний Ивент 2025</h2>
                            <FontAwesomeIcon icon={faSnowflake} className="w-8 h-8 text-blue-300 animate-pulse" />
                        </div>
                        <p className="text-blue-200 text-lg">
                            Соберите 5000 очков и получайте эксклюзивные подарки!
                        </p>
                    </div>
                    
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
                    >
                        <FontAwesomeIcon icon={faTimes} className="w-6 h-6" />
                    </button>
                </div>

                {/* Progress Section */}
                <div className="p-6 bg-white/5">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-white font-semibold">Ваш прогресс:</span>
                        <span className="text-yellow-400 font-bold text-xl">{currentPoints} / 5000 очков</span>
                    </div>
                    
                    <div className="w-full bg-gray-700 rounded-full h-6 mb-2">
                        <div 
                            className="bg-gradient-to-r from-blue-400 to-purple-500 h-6 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${getProgressPercentage()}%` }}
                        ></div>
                    </div>
                    
                    <div className="flex justify-between text-white text-sm">
                        <span>0</span>
                        <span>1000</span>
                        <span>2000</span>
                        <span>3000</span>
                        <span>4000</span>
                        <span>5000</span>
                    </div>
                </div>

                {/* Кнопка игры */}
                <div className="p-4 bg-white/10 border-y border-white/20">
                    <button
                        onClick={() => setShowGame(true)}
                        className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 transform flex items-center justify-center space-x-3 cursor-pointer"
                    >
                        <FontAwesomeIcon icon={faGamepad} className="w-6 h-6" />
                        <span>Зарабатывать очки</span>
                        <FontAwesomeIcon icon={faCoins} className="w-6 h-6 text-yellow-400" />
                    </button>
                    <p className="text-center text-blue-200 text-sm mt-2">
                        Сыграйте в мини-игру и получите до 5000 очков за раунд!
                    </p>
                </div>

                {/* Milestones Grid */}
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                    {milestones.map((milestone) => (
                        <div 
                            key={milestone.points}
                            className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                                currentPoints >= milestone.points
                                    ? milestone.claimed
                                        ? 'bg-green-500/20 border-green-500'
                                        : 'bg-yellow-500/20 border-yellow-500 animate-pulse'
                                    : 'bg-gray-700/50 border-gray-600'
                            }`}
                        >
                            <div className="text-center mb-3">
                                <div className="flex items-center justify-center space-x-2 mb-2">
                                    <FontAwesomeIcon 
                                        icon={faStar} 
                                        className={`w-5 h-5 ${
                                            milestone.claimed ? 'text-yellow-400' : 'text-gray-400'
                                        }`} 
                                    />
                                    <span className="text-white font-bold text-lg">{milestone.points} очков</span>
                                </div>
                                
                                <img 
                                    src={`/assets/gifts/${milestone.giftId}.png`} 
                                    alt={milestone.giftName}
                                    className="w-20 h-20 mx-auto mb-2"
                                />
                                
                                <h4 className="text-white font-semibold">{milestone.giftName}</h4>
                                <p className="text-gray-300 text-sm">{milestone.giftPrice} <FontAwesomeIcon icon={faCoins} className="w-6 h-6 text-yellow-400" /></p>
                            </div>

                            <button
                                onClick={() => claimReward(milestone)}
                                disabled={currentPoints < milestone.points || milestone.claimed || loading}
                                className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                                    milestone.claimed
                                        ? 'bg-green-600 text-white cursor-default'
                                        : currentPoints >= milestone.points
                                            ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                }`}
                            >
                                {milestone.claimed ? (
                                    <span className="flex items-center justify-center space-x-2">
                                        <FontAwesomeIcon icon={faGift} className="w-4 h-4" />
                                        <span>Получено</span>
                                    </span>
                                ) : currentPoints >= milestone.points ? (
                                    <span className="flex items-center justify-center space-x-2">
                                        <FontAwesomeIcon icon={faGift} className="w-4 h-4" />
                                        <span>Получить</span>
                                    </span>
                                ) : (
                                    `Нужно ${milestone.points - currentPoints} очков`
                                )}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Info Section */}
                <div className="p-4 border-t border-white/20 bg-black/30">
                    <div className="text-center text-gray-400 text-sm">
                        <p>💡 Очки начисляются за активность в приложении и мини-игры</p>
                        <p>🎁 Каждые 1000 очков - эксклюзивный подарок!</p>
                    </div>
                </div>
            </div>
        </div>
    )
}