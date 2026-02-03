'use client'

import Sidebar from "@/components/Sidebar"
import Snowfall from "@/components/Snowfall"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { User } from "../lib/types"
import { getCurrentUser } from "../lib/api/user"
import { updateOnlineStatus } from "../lib/api/online-status"
import { GlobalNotifications } from "@/components/GlobalNotifications"
import "@stream-io/video-react-sdk/dist/css/styles.css"
import { StreamProvider } from "@/video/StreamProvider"

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname()
  const showSidebar = pathname !== "/"

  const isWinterSeason = () => {
    const month = new Date().getMonth() + 1
    return month === 11 || month === 12 || month === 1
  }

  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    let isMounted = true

    const fetchUser = async () => {
      const currentUser = await getCurrentUser()
      if (currentUser && isMounted) {
        setUser(currentUser)
        await updateOnlineStatus(true)
      }
    }

    fetchUser()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    
      <div
        className={`flex ${showSidebar ? "max-h-screen" : "h-screen"} bg-black custom-scrollbar overflow-y-scroll relative`}
        style={{
          background: 'radial-gradient(circle at center, #7c3aed 0%, #0b0b0b 70%)',
        }}
      >
        {isWinterSeason() && <Snowfall />}
        <GlobalNotifications />
        {showSidebar && <Sidebar />}
        {children}
      </div>
  )
}

export default RootLayout
