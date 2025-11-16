'use client'

import Sidebar from "@/components/Sidebar"
import Snowfall from "@/components/Snowfall"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { User } from "../lib/types"
import { getCurrentUser } from "../lib/api/user"

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
        }
      }
  
      checkAuth()
    }, [])

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