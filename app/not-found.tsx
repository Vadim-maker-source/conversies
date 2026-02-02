'use client'

import Snowfall from '@/components/Snowfall'
import Topbar from '@/components/Topbar'
import { useRouter } from 'next/navigation'
import React from 'react'

const NotFound = () => {
    const isWinterSeason = () => {
        const month = new Date().getMonth() + 1
        return month === 12 || month === 1 || month === 11
    }

    const router = useRouter()

    const handleGoBack = () => {
        router.back()
    }
  return (
    <div className="flex items-center justify-center w-full bg-black h-screen flex-col"
      style={{ 
        background: 'radial-gradient(circle at center, #7c3aed 0%, #0b0b0b 70%)',
      }}
    >
        <Topbar />
        {isWinterSeason() && <Snowfall />}
        <img src="/assets/images/not-found-trpr.png" alt="" className="aspect-square w-112 z-2" />
        <button className="py-3 w-[24%] text-center rounded-lg bg-purple-500 mt-8 text-white hover:bg-purple-400 cursor-pointer duration-300" onClick={() => handleGoBack()}>
            Вернуться
        </button>
    </div>
  )
}

export default NotFound