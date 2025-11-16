import React from 'react'

const Bottombar = () => {
  return (
    <div className="w-full bg-black/60 py-6 border-t border-gray-500 mt-20">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          
          {/* Центральная часть - дополнительная информация */}
          <div className="text-gray-400 text-sm text-center lg:text-left">
            <p>Ваш надежный партнер в мире коммуникаций</p>
          </div>

          <div className="flex items-center">
            
            <div className="text-gray-400 text-sm">
              © 2025 Conversies. Все права защищены.
            </div>
          </div>
          
          {/* Правая часть - контакты или ссылки */}
          <div className="text-gray-400 text-sm text-center lg:text-right">
            <p>Почта: Vadimbureev380@yandex.ru</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Bottombar