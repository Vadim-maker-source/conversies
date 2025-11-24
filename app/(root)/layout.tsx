'use client'

import Sidebar from "@/components/Sidebar"
import Snowfall from "@/components/Snowfall"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { User } from "../lib/types"
import { getCurrentUser } from "../lib/api/user"
import { updateOnlineStatus } from "../lib/api/online-status"

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname()
  const showSidebar = pathname !== "/"

  // Проверяем зимний период (декабрь-январь)
  const isWinterSeason = () => {
    const month = new Date().getMonth() + 1
    return month === 12 || month === 1 || month === 11
  }

  const [user, setUser] = useState<User | null>(null)
    
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
    <div 
      className={`flex ${showSidebar ? "max-h-screen" : "h-screen"} bg-black custom-scrollbar overflow-y-scroll relative`}
      style={{ 
        background: 'radial-gradient(circle at center, #7c3aed 0%, #0b0b0b 70%)',
      }}
    >
      {/* Снежинки только в зимний период */}
      {isWinterSeason() && <Snowfall />}
      
      {showSidebar && <Sidebar />}
      {children}
    </div>
  )
}
  
export default RootLayout