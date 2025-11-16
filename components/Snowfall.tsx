'use client'

import { useEffect, useState } from 'react'

interface Snowflake {
  id: number
  left: number
  size: number
  opacity: number
  duration: number
  delay: number
}

export default function Snowfall() {
  const [snowflakes, setSnowflakes] = useState<Snowflake[]>([])

  useEffect(() => {
    // Создаем снежинки при монтировании
    const newSnowflakes: Snowflake[] = []
    for (let i = 0; i < 50; i++) {
      newSnowflakes.push({
        id: i,
        left: Math.random() * 100,
        size: Math.random() * 5 + 2,
        opacity: Math.random() * 0.7 + 0.3,
        duration: Math.random() * 10 + 10,
        delay: Math.random() * 5
      })
    }
    setSnowflakes(newSnowflakes)
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none z-20 overflow-hidden">
      {snowflakes.map((snowflake) => (
        <div
          key={snowflake.id}
          className="absolute top-0 rounded-full bg-white"
          style={{
            left: `${snowflake.left}%`,
            width: `${snowflake.size}px`,
            height: `${snowflake.size}px`,
            opacity: snowflake.opacity,
            animation: `fall ${snowflake.duration}s linear ${snowflake.delay}s infinite`,
            filter: 'blur(1px)'
          }}
        />
      ))}
      
      <style jsx>{`
        @keyframes fall {
          0% {
            transform: translateY(-100px) rotate(0deg);
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}