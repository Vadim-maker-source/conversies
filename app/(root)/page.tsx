"use client"

import Topbar from '@/components/Topbar'
import Bottombar from '@/components/Bottombar'
import Link from 'next/link'
import React, { useState, useEffect } from 'react'
import { User } from '../lib/types'
import { getCurrentUser } from '../lib/api/user'

const Page = () => {
  const [displayText, setDisplayText] = useState('')
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isTyping, setIsTyping] = useState(true)

  const [user, setUser] = useState<User | null>(null)
  
  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = await getCurrentUser();
      if(currentUser){
        setUser(currentUser)
      }
    }

    checkAuth()
  }, [])

  const words = [
    { text: 'удобно', color: 'text-blue-400', border: 'border-2 border-blue-400' },
    { text: 'надежно', color: 'text-green-400', border: 'border-2 border-green-400' },
    { text: 'современно', color: 'text-purple-400', border: 'border-2 border-purple-400' },
    { text: 'быстро', color: 'text-yellow-400', border: 'border-2 border-yellow-400' },
    { text: 'профессионально', color: 'text-red-400', border: 'border-2 border-red-400' },
    { text: 'эффективно', color: 'text-indigo-400', border: 'border-2 border-indigo-400' },
    { text: 'инновационно', color: 'text-pink-400', border: 'border-2 border-pink-400' }
  ]

  const descriptions = [
    {
      image: "/assets/images/chat-main.png",
      title: "Интуитивное общение",
      text: "Наша платформа предлагает простой и понятный интерфейс для общения. Без лишних сложностей и заморочек - только чистый диалог, который помогает достигать поставленных целей.",
      even: true
    },
    {
      image: "/assets/images/security.PNG",
      title: "Полная безопасность",
      text: "Ваши данные под надежной защитой. Мы используем передовые технологии шифрования и соблюдаем строгие стандарты конфиденциальности. Ваши разговоры остаются только между вами.",
      even: false
    },
    {
      image: "/assets/images/advantages.PNG",
      title: "Почему выбирают нас",
      text: "Сочетание современных технологий, человеческого подхода и постоянного развития. Мы не просто предоставляем сервис - мы создаем экосистему для эффективной коммуникации.",
      even: true
    },
    {
      image: "/assets/images/innovations.PNG",
      title: "Инновации в каждом диалоге",
      text: "Автоматизация рутинных задач, умные подсказки и аналитика разговоров. Мы помогаем сделать ваше общение более продуктивным и результативным.",
      even: false
    }
  ]

  const partneri = [
    {
      images: ["/assets/partneri/shadcn-logo.png"]
    },
    {
      images: ["/assets/partneri/next-js.png", "/assets/partneri/nextjs-13.svg"]
    },
    {
      images: ["/assets/partneri/Vercel_logo_2025.svg"]
    },
    {
      images: ["/assets/partneri/prisma-2.svg"]
    }
  ]

  useEffect(() => {
    const currentWord = words[currentWordIndex]
    
    if (isTyping && !isDeleting) {
      // Печатаем текст
      if (displayText.length < currentWord.text.length) {
        const timeout = setTimeout(() => {
          setDisplayText(currentWord.text.substring(0, displayText.length + 1))
        }, 100)
        return () => clearTimeout(timeout)
      } else {
        // Завершили печатание, ждем 2 секунды и начинаем удаление
        const timeout = setTimeout(() => {
          setIsDeleting(true)
        }, 2000)
        return () => clearTimeout(timeout)
      }
    }

    if (isDeleting) {
      // Удаляем текст
      if (displayText.length > 0) {
        const timeout = setTimeout(() => {
          setDisplayText(displayText.substring(0, displayText.length - 1))
        }, 50)
        return () => clearTimeout(timeout)
      } else {
        // Завершили удаление, переходим к следующему слову
        setIsDeleting(false)
        setCurrentWordIndex((prev) => (prev + 1) % words.length)
      }
    }
  }, [displayText, isDeleting, currentWordIndex, isTyping])

  const currentWord = words[currentWordIndex]

  return (
    <div className="min-h-screen w-full flex flex-col bg-transparent relative">
      <Topbar />
      
      {/* Верхняя секция с анимацией */}
      <div className="flex-1 flex items-center justify-center flex-col min-h-screen">
        <div className="text-center mb-8">
          <div className="text-4xl md:text-6xl font-bold text-white mb-8">
            Conversies -{' '}
            <span className={`${currentWord.color} transition-colors duration-300`}>
              {displayText}
            </span>
            <span className="animate-pulse">|</span>
          </div>
          <p className="text-gray-400 text-lg mt-4">
            Мы делаем ваше общение лучше
          </p>
        </div>
        
        <div className="mt-8">
          <Link href={user ? "/submain" : "/sign-up"}>
            <button 
              className={`
                w-md
                bg-[#0b0b0b]
                text-xl
                text-white
                px-8
                py-6
                rounded-xl
                cursor-pointer
                hover:bg-[#222121]
                duration-300
                outline-0
                ${currentWord.border}
                hover:scale-105
                transition-transform
              `}
            >
              {user ? "Перейти к общению" : "Зарегистрироваться"}
            </button>
          </Link>
        </div>
      </div>

      {/* Секция партнеров */}
      <div className="w-full max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-white text-center mb-12">
          Наши партнеры
        </h2>
        <div className="flex flex-wrap justify-between items-center gap-8">
          {partneri.map((partner, index) => (
            <div key={index} className="flex items-center gap-4">
              {partner.images.map((imageSrc, imgIndex) => (
                <img 
                  key={imgIndex}
                  src={imageSrc} 
                  alt={`Partner ${index + 1}`}
                  className="h-8 object-contain filter grayscale hover:grayscale-0 transition-all duration-300"
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Секция с описаниями */}
      <div className="w-full max-w-6xl mx-auto px-4 py-10">
        {descriptions.map((item, index) => (
          <div 
            key={index}
            className={`flex items-center justify-center gap-12 mb-20 ${
              item.even ? 'flex-row' : 'flex-row-reverse'
            }`}
          >
            <div className="w-[45%] flex justify-center">
              <img 
                src={item.image} 
                alt={item.title} 
                className="w-full max-w-md rounded-2xl shadow-2xl transition-transform hover:scale-105 duration-300" 
              />
            </div>
            <div className="w-[45%]">
              <h3 className="text-2xl font-bold text-white mb-4">
                {item.title}
              </h3>
              <p className="text-gray-300 text-lg leading-relaxed">
                {item.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Bottombar */}
      <Bottombar />
    </div>
  )
}

export default Page