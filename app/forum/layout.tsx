'use client'

import { usePathname, useSearchParams } from "next/navigation"
import ScrollToTopButton from '@/components/ScrollToTopButton'
import { updateOnlineStatus } from "../lib/api/online-status"
import { getCurrentUser } from "../lib/api/user"
import { useEffect, useState, Suspense } from "react"
import { User } from "../lib/types"
import Snowfall from "@/components/Snowfall"

const ForumLayoutContent = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [user, setUser] = useState<User | null>(null)

  const isWinterSeason = () => {
    const month = new Date().getMonth() + 1
    return month === 12 || month === 1 || month === 11
  }

  useEffect(() => {
      const checkAuth = async () => {
        const currentUser = await getCurrentUser();
        if(currentUser){
          setUser(currentUser)
          // Устанавливаем статус "в сети" при загрузке
          await updateOnlineStatus(true)
        }
      }
  
      checkAuth()
    }, [])
  
    // Обработка событий для установки статуса "не в сети"
    useEffect(() => {
      const handleBeforeUnload = () => {
        // Устанавливаем статус "не в сети" при закрытии вкладки/браузера
        if (user) {
          navigator.sendBeacon('/api/update-status', JSON.stringify({ isOnline: false }))
        }
      }
  
      const handleVisibilityChange = () => {
        if (user) {
          // Если вкладка становится неактивной, устанавливаем статус "не в сети"
          if (document.hidden) {
            updateOnlineStatus(false)
          } else {
            updateOnlineStatus(true)
          }
        }
      }
  
      window.addEventListener('beforeunload', handleBeforeUnload)
      document.addEventListener('visibilitychange', handleVisibilityChange)
  
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        
        // Устанавливаем статус "не в сети" при размонтировании компонента
        if (user) {
          updateOnlineStatus(false)
        }
      }
    }, [user])

  return (
    <>
      <div
        className="min-h-screen w-full"
        style={{
          background: 'radial-gradient(circle at top center, #7c3aed 0%, #0b0b0b 70%)',
          backgroundAttachment: 'fixed'
        }}
      >
        {isWinterSeason() && <Snowfall />}
        {/* Главный контент */}
        <div className="relative">
          {children}
        </div>

        <ScrollToTopButton />
      </div>
    </>
  )
}

const ForumLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ForumLayoutContent>{children}</ForumLayoutContent>
    </Suspense>
  )
}

export default ForumLayout