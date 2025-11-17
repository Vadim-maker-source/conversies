'use client'

import { getCurrentUser } from '@/app/lib/api/user'
import { User } from '@/app/lib/types'
import React, { useEffect, useState } from 'react'
import EventModal from './EventModal'

const Topbar = () => {
    const [user, setUser] = useState<User | null>(null)
    const [showEventModal, setShowEventModal] = useState(false)
    const [hasNewEvents, setHasNewEvents] = useState(false)

    useEffect(() => {
        const checkAuth = async () => {
            const currentUser = await getCurrentUser();
            if(currentUser){
                setUser(currentUser)
                checkNewEvents()
            }
        }

        checkAuth()
    }, [])

    const checkNewEvents = () => {
        const eventViewed = localStorage.getItem('eventViewed')
        setHasNewEvents(!eventViewed)
    }

    const handleEventClick = () => {
        setShowEventModal(true)
        setHasNewEvents(false)
        localStorage.setItem('eventViewed', 'true')
    }

    return (
        <>
            <div className="w-full bg-transparent px-6 py-4 absolute top-0 left-0 z-10">
                <div className="flex items-center justify-between">
                    {/* Левая часть - логотип */}
                    <div className="w-1/4 text-white text-2xl logo_font">Conversies</div>
                    
                    {/* Центральная часть - навигационные кнопки */}
                    <div className="flex items-center gap-8 justify-center flex-1">
                        <button className="text-gray-300 text-lg hover:text-white transition-colors duration-200 cursor-pointer font-semibold relative group">
                            Помощь
                            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-purple-600 transition-all duration-300 group-hover:w-full"></span>
                        </button>
                        <button className="text-gray-300 text-lg hover:text-white transition-colors duration-200 cursor-pointer font-semibold relative group">
                            О нас
                            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-purple-600 transition-all duration-300 group-hover:w-full"></span>
                        </button>
                        
                        {/* Кнопка ивентов для авторизованных пользователей */}
                        {user && (
                            <button 
                                onClick={handleEventClick}
                                className="text-gray-300 text-lg hover:text-white transition-colors duration-200 cursor-pointer font-semibold relative group"
                            >
                                Ивенты
                                {hasNewEvents && (
                                    <span className="absolute -top-1 -right-2 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                                )}
                                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-purple-600 transition-all duration-300 group-hover:w-full"></span>
                            </button>
                        )}
                        
                        <button className="text-gray-300 text-lg hover:text-white transition-colors duration-200 cursor-pointer font-semibold relative group">
                            Функции
                            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-purple-600 transition-all duration-300 group-hover:w-full"></span>
                        </button>
                        <button className="text-gray-300 text-lg hover:text-white transition-colors duration-200 cursor-pointer font-semibold relative group">
                            Тарифы
                            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-purple-600 transition-all duration-300 group-hover:w-full"></span>
                        </button>
                        <button className="text-gray-300 text-lg hover:text-white transition-colors duration-200 cursor-pointer font-semibold relative group">
                            Контакты
                            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-purple-600 transition-all duration-300 group-hover:w-full"></span>
                        </button>
                    </div>

                    {/* Правая часть - информация о пользователе */}
                    <div className="flex items-center gap-3 w-1/4 justify-end">
                        {user ? (
                            <>
                                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                    <img src={String(user.avatar)} alt={String(user.name)} className="rounded-full" />
                                </div>
                                <span className="text-white font-medium">
                                    {user.name || user.email}
                                </span>
                            </>
                        ) : (
                            <>
                                <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                    Г
                                </div>
                                <span className="text-gray-300 font-medium">
                                    Гость
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Модальное окно ивентов */}
            {showEventModal && user && (
                <EventModal 
                    user={user}
                    onClose={() => setShowEventModal(false)}
                />
            )}
        </>
    )
}

export default Topbar