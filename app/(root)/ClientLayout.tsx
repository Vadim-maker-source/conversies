'use client';

import Sidebar from "@/components/Sidebar";
import Snowfall from "@/components/Snowfall";
import { usePathname } from "next/navigation";
import { GlobalNotifications } from "@/components/GlobalNotifications";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const showSidebar = pathname !== "/";

  const isWinterSeason = () => {
    const month = new Date().getMonth() + 1;
    return month === 11 || month === 12 || month === 1;
  };

  return (
    <div
      className={`flex ${
        showSidebar ? "max-h-screen" : "h-screen"
      } bg-black custom-scrollbar overflow-y-scroll relative`}
      style={{
        background: "radial-gradient(circle at center, #7c3aed 0%, #0b0b0b 70%)",
      }}
    >
      {isWinterSeason() && <Snowfall />}
      <GlobalNotifications />
      {showSidebar && <Sidebar />}
      {children}
    </div>
  );
}
