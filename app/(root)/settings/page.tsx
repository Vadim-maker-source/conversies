'use client'

import { useState, useEffect, useRef, JSX, Key, JSXElementConstructor, ReactElement, ReactNode, ReactPortal, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { clearCache, getUserSettings, updatePassword, updateUserAvatar, updateUserSettings, buyPremium, getTwoFactorStatus, disableTwoFactor, enableTwoFactor, verifyTwoFactorEnable, addCoins, getLinkedDevices, removeDeviceSession, generatePublicLoginQRCode as generateDeviceLinkingToken, linkDeviceByToken, quickLoginWithQRCode, getCurrentUser } from '@/app/lib/api/user'
import { uploadAvatar } from '@/app/lib/api/chat'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { 
  faCamera,
  faTimes,
  faEdit,
  faShieldAlt,
  faBell,
  faCrown,
  faTrash,
  faKey,
  faPalette,
  faQuestionCircle,
  faEye,
  faLanguage,
  faArrowLeft,
  faCheck,
  faStar,
  faRocket,
  faShield,
  faVideo,
  faInfinity,
  faGift,
  faCoins,
  faShoppingCart,
  faMobileAlt,
  faRefresh,
  faQrcode,
  faLink
} from '@fortawesome/free-solid-svg-icons'
import { GiftsSection } from '@/components/GiftsSection'
import QRScanner from '@/components/QRScanner'
import { signIn } from 'next-auth/react'

interface CoinsSectionProps {
  settings: any
  onBack: () => void
  message: string
  loading: boolean
  onAddCoins: (coinsAmount: number) => void
}

function CoinsSection({ settings, onBack, message, loading, onAddCoins }: CoinsSectionProps) {
  const coinPackages = [
    { coins: 100, price: 200, bonus: 0, popular: false },
    { coins: 250, price: 480, bonus: 25, popular: true },
    { coins: 750, price: 1400, bonus: 150, popular: false },
    { coins: 1000, price: 1850, bonus: 200, popular: false }
  ]

  const [selectedPackage, setSelectedPackage] = useState<number | null>(null)

  const handleBuyClick = (coins: number) => {
    setSelectedPackage(coins)
    onAddCoins(coins)
  }

  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-white">Пополнение баланса</h2>
        <div className="flex items-center space-x-2 bg-purple-500/20 px-4 py-2 rounded-lg">
          <FontAwesomeIcon icon={faCoins} className="w-5 h-5 text-yellow-400" />
          <span className="text-white font-bold text-lg">
            {settings.coins || 0} монет
          </span>
        </div>
      </div>

      {/* Сообщение */}
      {message && (
        <div className={`p-4 rounded-lg mb-6 border ${
          message.includes('Ошибка') 
            ? 'bg-red-500/20 text-red-300 border-red-500/30' 
            : 'bg-green-500/20 text-green-300 border-green-500/30'
        }`}>
          {message}
        </div>
      )}

      <div className="bg-black/40 rounded-xl p-8 backdrop-blur-sm border border-gray-700">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <FontAwesomeIcon icon={faCoins} className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-white text-2xl font-bold mb-2">Пополните баланс монет</h3>
          <p className="text-gray-400 text-lg">
            Монеты используются для отправки подарков и других эксклюзивных функций
          </p>
        </div>

        {/* Пакеты монет */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {coinPackages.map((pkg, index) => (
            <div
              key={pkg.coins}
              className={`relative rounded-xl p-6 border-2 transition-all duration-300 ${
                pkg.popular
                  ? 'border-yellow-500 bg-yellow-500/10 transform scale-105'
                  : 'border-gray-600 bg-gray-800/50 hover:border-purple-500/50 hover:bg-purple-500/10'
              } ${selectedPackage === pkg.coins ? 'ring-2 ring-purple-500' : ''}`}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-yellow-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    ПОПУЛЯРНЫЙ
                  </span>
                </div>
              )}

              {pkg.bonus > 0 && (
                <div className="absolute -top-2 -right-2">
                  <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    +{pkg.bonus} бонус
                  </span>
                </div>
              )}

              <div className="text-center mb-4">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <FontAwesomeIcon icon={faCoins} className="w-6 h-6 text-yellow-400" />
                  <span className="text-2xl font-bold text-white">{pkg.coins}</span>
                </div>
                <p className="text-gray-400 text-sm">монет</p>
              </div>

              <div className="text-center mb-4">
                <span className="text-2xl font-bold text-white">{pkg.price}₽</span>
                {pkg.bonus > 0 && (
                  <p className="text-green-400 text-sm mt-1">
                    + {pkg.bonus} монет в подарок
                  </p>
                )}
              </div>

              <button
                onClick={() => handleBuyClick(pkg.coins)}
                disabled={loading && selectedPackage === pkg.coins}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                  pkg.popular
                    ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                    : 'bg-purple-500 text-white hover:bg-purple-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading && selectedPackage === pkg.coins ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Покупка...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <FontAwesomeIcon icon={faShoppingCart} className="w-4 h-4" />
                    <span>Купить</span>
                  </div>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Преимущества */}
        <div className="bg-gray-800/30 rounded-lg p-6 border border-gray-600">
          <h4 className="text-white font-semibold text-lg mb-4 text-center">
            Что можно делать с монетами?
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: faGift, text: 'Дарить подарки друзьям' },
              { icon: faStar, text: 'Открывать эксклюзивные функции' },
              { icon: faCrown, text: 'Получать специальные возможности' }
            ].map((item, index) => (
              <div key={index} className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <FontAwesomeIcon icon={item.icon} className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-gray-300 text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Информация о платежах */}
        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm">
            💳 Оплата проходит через защищенное соединение
          </p>
          <p className="text-gray-400 text-sm mt-1">
            🔒 Все платежи защищены. Возврат средств в течение 14 дней
          </p>
        </div>
      </div>
    </div>
  )
}

function ClearCacheModal({ isOpen, onClose, onConfirm }: { 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void;
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-sm mx-4">
        <h3 className="text-lg font-semibold text-white mb-2">Очистка кэша</h3>
        <p className="text-gray-300 mb-4">
          Вы уверены, что хотите очистить кэш приложения? Это действие нельзя отменить.
        </p>
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
          >
            Очистить
          </button>
        </div>
      </div>
    </div>
  )
}

function ActionSelection({ 
  settings, 
  onActionSelect,
  getUserAvatar 
}: { 
  settings: any;
  onActionSelect: (action: string) => void;
  getUserAvatar: () => JSX.Element;
}) {
  const actionButtons = [
    { id: 'edit-profile', icon: faEdit, label: 'Профиль', color: 'text-purple-400' },
    { id: 'security', icon: faShieldAlt, label: 'Безопасность', color: 'text-purple-400' },
    { id: 'two-factor', icon: faKey, label: '2FA Аутентификация', color: 'text-purple-400' },
    { id: 'notifications', icon: faBell, label: 'Уведомления', color: 'text-purple-400' },
    { id: 'appearance', icon: faPalette, label: 'Внешний вид', color: 'text-purple-400' },
    { id: 'privacy', icon: faEye, label: 'Приватность', color: 'text-purple-400' },
    { id: 'language', icon: faLanguage, label: 'Язык', color: 'text-purple-400' },
    { id: 'premium', icon: faCrown, label: 'Premium', color: 'text-yellow-400' },
    { id: 'clear-cache', icon: faTrash, label: 'Очистить кэш', color: 'text-purple-400' },
    { id: 'link-devices', icon: faLink, label: 'Связать устройства', color: 'text-purple-400' },
    { id: 'coins', icon: faCoins, label: 'Пополнить баланс', color: 'text-purple-400' },
    { id: 'present', icon: faGift, label: 'Подарки', color: 'text-purple-400' },
    { id: 'help', icon: faQuestionCircle, label: 'Помощь', color: 'text-purple-400' },
  ]

  return (
    <div className="h-screen bg-black/40 p-6 w-full overflow-y-scroll">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Настройки</h1>
          <p className="text-gray-400 text-lg">Управление вашим аккаунтом</p>
        </div>

        {/* Профиль пользователя */}
        <div className="flex flex-col items-center mb-12">
          {getUserAvatar()}
          <div className="mt-6 text-center">
            <h2 className="text-2xl font-semibold text-white">
              {settings.name} {settings.surname}
            </h2>
            <p className="text-gray-400 mt-2">
              {settings.email}
            </p>
            {settings.isPremium && (
              <div className="inline-flex items-center space-x-2 mt-3 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full">
                <FontAwesomeIcon icon={faCrown} className="w-4 h-4 text-white" />
                <span className="text-white font-medium text-sm">PREMIUM</span>
              </div>
            )}
          </div>
        </div>

        {/* Действия колонной */}
        <div className="max-w-md mx-auto">
          <div className="space-y-3">
            {actionButtons.map((button) => (
              <button
                key={button.id}
                onClick={() => onActionSelect(button.id)}
                className="w-full flex items-center space-x-4 bg-black/40 rounded-xl p-4 backdrop-blur-sm border border-gray-700 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all duration-300 group"
              >
                <div className={`p-3 rounded-lg bg-gray-800 group-hover:bg-purple-500/20 transition-colors ${button.color}`}>
                  <FontAwesomeIcon icon={button.icon} className="w-5 h-5" />
                </div>
                <span className="text-white font-medium group-hover:text-purple-300 transition-colors text-left flex-1">
                  {button.label}
                </span>
                <FontAwesomeIcon 
                  icon={faArrowLeft} 
                  className="w-4 h-4 text-gray-400 group-hover:text-purple-300 transform rotate-180 transition-colors" 
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Компонент конкретного действия (100% ширины)
// Компонент конкретного действия (100% ширины)
function ActionPage({ 
  action, 
  settings, 
  onBack, 
  getUserAvatar,
  message,
  loading,
  passwordLoading,
  showClearCacheModal,
  setShowClearCacheModal,
  onUpdateProfile,
  onChangePassword,
  onClearCache,
  onBuyPremium,
  fileInputRef,
  showAvatarMenu,
  setShowAvatarMenu,
  onAvatarClick,
  onFileInputClick,
  onFileInputChange,
  onRemoveAvatar,
  uploadingAvatar,
  avatarMenuRef,
  passwordForm,
  setPasswordForm,
  setSettings,
  twoFactorStatus,
  showTwoFactorModal,
  setShowTwoFactorModal,
  twoFactorCode,
  setTwoFactorCode,
  onEnableTwoFactor,
  onVerifyTwoFactor,
  onDisableTwoFactor,
  handleAddCoins,
  generateLinkingQRCode,
  loadLinkedDevices,
  handleRemoveDevice,
  linkedDevices,
  qrCodeData,
  setShowQRScanner,
  handleQRScan,
  showQRScanner
}: any) {
  const renderActionContent = () => {
    switch (action) {
      case 'two-factor':
        return (
          <div className="max-w-2xl mx-auto w-full">
            <h2 className="text-3xl font-bold text-white mb-8">Двухэтапная аутентификация</h2>
            
            <div className="bg-black/40 rounded-xl p-8 backdrop-blur-sm border border-gray-700">
              {twoFactorStatus?.twoFactorEnabled ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FontAwesomeIcon icon={faShieldAlt} className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-white text-xl font-semibold mb-2">2FA включена</h3>
                  <p className="text-gray-400 mb-6">
                    Двухэтапная аутентификация защищает ваш аккаунт. При каждом входе будет отправляться код на вашу почту.
                  </p>
                  <button
                    onClick={onDisableTwoFactor}
                    disabled={loading}
                    className="bg-red-500 text-white py-3 px-6 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Отключение...' : 'Отключить 2FA'}
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FontAwesomeIcon icon={faShieldAlt} className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-white text-xl font-semibold mb-2">Защитите ваш аккаунт</h3>
                  <p className="text-gray-400 mb-6">
                    Включайте двухэтапную аутентификацию для дополнительной безопасности. 
                    При каждом входе будет отправляться код на вашу почту.
                  </p>
                  <button
                    onClick={onEnableTwoFactor}
                    disabled={loading}
                    className="bg-purple-500 text-white py-3 px-6 rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Настройка...' : 'Включить 2FA'}
                  </button>
                </div>
              )}
            </div>

            {/* Модальное окно для подтверждения кода */}
            {showTwoFactorModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-gray-800 rounded-xl p-6 max-w-sm w-full mx-4">
                  <h3 className="text-white text-lg font-semibold mb-4">Подтвердите включение 2FA</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Код отправлен на вашу почту. Введите его ниже:
                  </p>
                  <input
                    type="text"
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-center text-lg font-mono mb-4 border border-gray-600 focus:border-purple-500 outline-none"
                    placeholder="000000"
                    maxLength={6}
                  />
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowTwoFactorModal(false)}
                      className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={onVerifyTwoFactor}
                      disabled={twoFactorCode.length !== 6 || loading}
                      className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors"
                    >
                      {loading ? 'Проверка...' : 'Подтвердить'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )

      case 'edit-profile':
        return (
          <div className="max-w-2xl mx-auto w-full">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-white">Редактирование профиля</h2>
            </div>
            
            <div className="bg-black/40 rounded-xl p-8 backdrop-blur-sm border border-gray-700">
              {/* Avatar Section */}
              <div className="flex items-center space-x-6 mb-8">
                <div className="relative">
                  <div className="relative group">
                    {getUserAvatar()}
                    <button
                      type="button"
                      onClick={onAvatarClick}
                      className="absolute inset-0 w-24 h-24 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer border-2 border-white/30"
                    >
                      <FontAwesomeIcon icon={faCamera} className="w-6 h-6 text-white" />
                    </button>
                  </div>

                  {/* Меню выбора аватара */}
                  {showAvatarMenu && (
                    <>
                      <div 
                        className="fixed inset-0 bg-black/20 z-40"
                        onClick={() => setShowAvatarMenu(false)}
                      />
                      
                      <div 
                        ref={avatarMenuRef}
                        className="absolute top-full left-0 mt-2 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl z-50 min-w-48 overflow-hidden"
                      >
                        <div className="p-2">
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={onFileInputChange}
                            accept="image/*"
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={onFileInputClick}
                            disabled={uploadingAvatar}
                            className="w-full px-4 py-3 text-left text-white hover:bg-gray-700 rounded-lg flex items-center space-x-3 disabled:opacity-50 cursor-pointer transition-colors"
                          >
                            <FontAwesomeIcon icon={faCamera} className="w-4 h-4 text-purple-400" />
                            <span className="flex-1">
                              {uploadingAvatar ? 'Загрузка...' : 'Загрузить фото'}
                            </span>
                          </button>
                          
                          {settings.avatar && (
                            <>
                              <div className="h-px bg-gray-600 my-2"></div>
                              <button
                                type="button"
                                onClick={onRemoveAvatar}
                                disabled={uploadingAvatar}
                                className="w-full px-4 py-3 text-left text-red-400 hover:bg-gray-700 rounded-lg flex items-center space-x-3 disabled:opacity-50 cursor-pointer transition-colors"
                              >
                                <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
                                <span className="flex-1">Удалить фото</span>
                              </button>
                            </>
                          )}
                          
                          <div className="h-px bg-gray-600 my-2"></div>
                          <button
                            type="button"
                            onClick={() => setShowAvatarMenu(false)}
                            className="w-full px-4 py-3 text-left text-gray-400 hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <h3 className="text-white font-medium text-lg">Аватар профиля</h3>
                  <p className="text-gray-400 text-sm">Нажмите на аватар для изменения</p>
                </div>
              </div>

              {/* Name Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    Имя *
                  </label>
                  <input
                    type="text"
                    value={settings.name}
                    onChange={(e) => setSettings((prev: any) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-600"
                    placeholder="Введите имя"
                    required
                  />
                </div>
                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    Фамилия *
                  </label>
                  <input
                    type="text"
                    value={settings.surname}
                    onChange={(e) => setSettings((prev: any) => ({ ...prev, surname: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-600"
                    placeholder="Введите фамилию"
                    required
                  />
                </div>
              </div>

              <button
                onClick={onUpdateProfile}
                disabled={loading}
                className="w-full bg-purple-500 text-white py-3 px-4 rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </div>
          </div>
        )

      case 'security':
        return (
          <div className="max-w-2xl mx-auto w-full">
            <h2 className="text-3xl font-bold text-white mb-8">Безопасность</h2>
            <div className="bg-black/40 rounded-xl p-8 backdrop-blur-sm border border-gray-700">
              <form onSubmit={onChangePassword} className="space-y-6">
                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    Текущий пароль
                  </label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm((prev: any) => ({ ...prev, currentPassword: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-600"
                    placeholder="Введите текущий пароль"
                  />
                </div>
                
                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    Новый пароль
                  </label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((prev: any) => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-600"
                    placeholder="Введите новый пароль"
                  />
                </div>
                
                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    Подтвердите новый пароль
                  </label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm((prev: any) => ({ ...prev, confirmPassword: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-600"
                    placeholder="Подтвердите новый пароль"
                  />
                </div>

                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="w-full bg-purple-500 text-white py-3 px-4 rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {passwordLoading ? 'Изменение...' : 'Изменить пароль'}
                </button>
              </form>
            </div>
          </div>
        )

      case 'premium':
        return (
          <div className="max-w-4xl mx-auto w-full">
            <h2 className="text-3xl font-bold text-white mb-8">Conversies Premium</h2>
            
            {settings.isPremium ? (
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-8 text-center">
                <FontAwesomeIcon icon={faCrown} className="w-16 h-16 text-white mb-4" />
                <h3 className="text-white font-bold text-2xl mb-4">🎉 Вы уже Premium пользователь!</h3>
                <p className="text-white/90 text-lg mb-6">
                  Вам доступны все эксклюзивные функции платформы
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                  {[
                    { icon: faRocket, text: 'Приоритетная поддержка' },
                    { icon: faShield, text: 'Расширенная безопасность' },
                    { icon: faVideo, text: 'HD видеозвонки' },
                    { icon: faInfinity, text: 'Безлимитные чаты' },
                    { icon: faStar, text: 'Эксклюзивные стикеры' },
                    { icon: faGift, text: 'Специальные функции' }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center space-x-3 bg-white/20 rounded-lg p-4">
                      <FontAwesomeIcon icon={item.icon} className="w-5 h-5 text-white" />
                      <span className="text-white font-medium">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl p-8">
                <div className="text-center mb-8">
                  <FontAwesomeIcon icon={faCrown} className="w-16 h-16 text-white mb-4" />
                  <h3 className="text-white font-bold text-3xl mb-4">Получите Conversies Premium</h3>
                  <p className="text-white/90 text-xl mb-6">
                    Расширенные возможности для комфортного общения
                  </p>
                  <div className="text-4xl font-bold text-white mb-2">299₽<span className="text-lg font-normal">/месяц</span></div>
                  <p className="text-white/80">или 2 990₽ за год</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {[
                    { icon: faCheck, text: 'Приоритетная поддержка 24/7' },
                    { icon: faCheck, text: 'Расширенная безопасность' },
                    { icon: faCheck, text: 'HD видеозвонки до 50 человек' },
                    { icon: faCheck, text: 'Безлимитное облачное хранилище' },
                    { icon: faCheck, text: 'Эксклюзивные стикеры и темы' },
                    { icon: faCheck, text: 'Расширенная статистика чатов' },
                    { icon: faCheck, text: 'Кастомные реакции и эмодзи' },
                    { icon: faCheck, text: 'Ранний доступ к новым функциям' }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <FontAwesomeIcon icon={item.icon} className="w-5 h-5 text-white" />
                      <span className="text-white font-medium">{item.text}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={onBuyPremium}
                  disabled={loading}
                  className="w-full bg-white text-orange-500 py-4 px-6 rounded-lg font-bold text-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Активация...' : 'Активировать Premium'}
                </button>
                
                <p className="text-center text-white/80 mt-4 text-sm">
                  ✓ Гарантия возврата в течение 14 дней
                </p>
              </div>
            )}
          </div>
        )

      case 'clear-cache':
        return (
          <div className="max-w-2xl mx-auto w-full">
            <h2 className="text-3xl font-bold text-white mb-8">Очистка кэша</h2>
            <div className="bg-black/40 rounded-xl p-8 backdrop-blur-sm border border-gray-700 text-center">
              <FontAwesomeIcon icon={faTrash} className="w-16 h-16 text-purple-400 mb-4" />
              <h4 className="text-white font-medium text-xl mb-2">Очистить кэш приложения</h4>
              <p className="text-gray-400 mb-6 text-lg">
                Это действие удалит все временные данные и файлы кэша. 
                Приложение может работать медленнее при следующем запуске.
              </p>
              <button 
                onClick={() => setShowClearCacheModal(true)}
                className="bg-purple-500 text-white py-3 px-8 rounded-lg hover:bg-purple-600 transition-colors font-medium text-lg"
              >
                Очистить кэш
              </button>
            </div>
          </div>
        )

        case 'present':
  return (
    <GiftsSection 
      settings={settings}
      onBack={onBack}
      message={message}
      loading={loading}
    />
  )

  case 'coins':
  return (
    <CoinsSection 
      settings={settings}
      onBack={onBack}
      message={message}
      loading={loading}
      onAddCoins={handleAddCoins}
    />
  )

  case 'link-devices':
  return (
    <div className="max-w-4xl mx-auto w-full">
      <h2 className="text-3xl font-bold text-white mb-8">Связать устройства</h2>
      
      <div className="bg-black/40 rounded-xl p-8 backdrop-blur-sm border border-gray-700">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <FontAwesomeIcon icon={faCamera} className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-white text-2xl font-bold mb-2">Сканирование QR-кода</h3>
          <p className="text-gray-400 text-lg">
            Отсканируйте QR-код с другого устройства для связывания
          </p>
        </div>

        <div className="space-y-6">
          <button
            onClick={() => setShowQRScanner(true)}
            className="w-full bg-green-500 text-white py-4 px-6 rounded-lg hover:bg-green-600 transition-colors font-medium text-lg flex items-center justify-center space-x-3"
          >
            <FontAwesomeIcon icon={faCamera} className="w-6 h-6" />
            <span>Сканировать QR-код</span>
          </button>

          <div className="space-y-3 text-sm text-gray-300">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                1
              </div>
              <span>Откройте Conversies на другом устройстве</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                2
              </div>
              <span>Перейдите на страницу входа</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                3
              </div>
              <span>Нажмите "Сгенерировать QR-код"</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                4
              </div>
              <span>Наведите камеру на QR-код</span>
            </div>
          </div>
        </div>
      </div>

      {/* Компонент сканирования */}
      {showQRScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowQRScanner(false)}
        />
      )}
    </div>
  )

      default:
        return (
          <div className="max-w-2xl mx-auto w-full">
            <h2 className="text-3xl font-bold text-white mb-8">
              {action === 'two-factor' && '2FA Аутентификация'}
              {action === 'notifications' && 'Уведомления'}
              {action === 'appearance' && 'Внешний вид'}
              {action === 'privacy' && 'Приватность'}
              {action === 'language' && 'Язык'}
              {action === 'help' && 'Помощь'}
            </h2>
            <div className="bg-black/40 rounded-xl p-8 backdrop-blur-sm border border-gray-700 text-center">
              <div className="text-gray-400 text-lg mb-4">
                {action === 'two-factor' && '🔒 Двухфакторная аутентификация'}
                {action === 'notifications' && '🔔 Настройки уведомлений'}
                {action === 'appearance' && '🎨 Внешний вид интерфейса'}
                {action === 'privacy' && '👀 Настройки приватности'}
                {action === 'language' && '🌍 Язык интерфейса'}
                {action === 'help' && '❓ Помощь и поддержка'}
              </div>
              <p className="text-gray-400 mb-6">Этот раздел находится в разработке</p>
              <div className="animate-pulse text-purple-400">
                Скоро будет доступно...
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-black/40 p-6 w-full">
      <div className="max-w-full">
        {/* Кнопка назад */}
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-white hover:text-gray-300 transition-colors px-4 py-3 rounded-lg hover:bg-white/10 mb-8"
        >
          <FontAwesomeIcon icon={faArrowLeft} className="w-4 h-4" />
          <span>Вернуться к настройкам</span>
        </button>

        {/* Сообщение */}
        {message && (
          <div className={`p-4 rounded-lg mb-6 border max-w-4xl mx-auto ${
            message.includes('Ошибка') 
              ? 'bg-red-500/20 text-red-300 border-red-500/30' 
              : 'bg-green-500/20 text-green-300 border-green-500/30'
          }`}>
            {message}
          </div>
        )}

        {/* Контент действия */}
        {renderActionContent()}
      </div>
    </div>
  )
}

function SettingsContent() {
  const [settings, setSettings] = useState({
    name: '',
    surname: '',
    avatar: '',
    isPremium: false,
    coins: 0
  })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [premiumLoading, setPremiumLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showAvatarMenu, setShowAvatarMenu] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [showClearCacheModal, setShowClearCacheModal] = useState(false)
  const [currentAction, setCurrentAction] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const avatarMenuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  const [twoFactorStatus, setTwoFactorStatus] = useState<any>(null)
const [showTwoFactorModal, setShowTwoFactorModal] = useState(false)
const [twoFactorCode, setTwoFactorCode] = useState('')

const handleAddCoins = async (coinsAmount: number) => {
  setLoading(true)
  setMessage('')

  try {
    const result = await addCoins(coinsAmount)
    if (result.error) {
      setMessage(result.error)
    } else {
      setMessage(`🎉 Баланс успешно пополнен на ${coinsAmount} монет!`)
      const updatedSettings = await getUserSettings()
      if (updatedSettings) {
        setSettings({name: updatedSettings.name || '',
          surname: updatedSettings.surname || '',
          avatar: updatedSettings.avatar || '',
          isPremium: updatedSettings.isPremium || false,
          coins: updatedSettings.coins || 0})
      }
    }
  } catch (error) {
    setMessage('Ошибка при пополнении баланса')
  } finally {
    setLoading(false)
  }
}

// Функции для 2FA:
const handleEnableTwoFactor = async () => {
  setLoading(true)
  try {
    const result = await enableTwoFactor()
    if (result.error) {
      setMessage(result.error)
    } else {
      setMessage(result.message!)
      setShowTwoFactorModal(true)
    }
  } catch (error) {
    setMessage('Ошибка при настройке 2FA')
  } finally {
    setLoading(false)
  }
}

const handleVerifyTwoFactor = async () => {
  setLoading(true)
  try {
    const result = await verifyTwoFactorEnable(twoFactorCode)
    if (result.error) {
      setMessage(result.error)
    } else {
      setMessage(result.message!)
      setTwoFactorStatus({ twoFactorEnabled: true })
      setShowTwoFactorModal(false)
      setTwoFactorCode('')
    }
  } catch (error) {
    setMessage('Ошибка при подтверждении кода')
  } finally {
    setLoading(false)
  }
}

const handleDisableTwoFactor = async () => {
  setLoading(true)
  try {
    const result = await disableTwoFactor()
    if (result.error) {
      setMessage(result.error)
    } else {
      setMessage(result.message!)
      setTwoFactorStatus({ twoFactorEnabled: false })
    }
  } catch (error) {
    setMessage('Ошибка при отключении 2FA')
  } finally {
    setLoading(false)
  }
}

// Загрузите статус при монтировании
useEffect(() => {
  loadTwoFactorStatus()
}, [])

const loadTwoFactorStatus = async () => {
  const status = await getTwoFactorStatus()
  setTwoFactorStatus(status)
}

  useEffect(() => {
    loadSettings()
    
    // Проверяем URL параметры
    const action = searchParams.get('action')
    if (action) {
      setCurrentAction(action)
    }
  }, [searchParams])

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target as Node)) {
        setShowAvatarMenu(false)
      }
    }

    if (showAvatarMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAvatarMenu])

  const loadSettings = async () => {
    try {
      const userSettings = await getUserSettings()
      if (userSettings) {
        setSettings({
          name: String(userSettings.name) || String(''),
          surname: userSettings.surname || '',
          avatar: userSettings.avatar || '',
          isPremium: userSettings.isPremium || false,
          coins: Number(userSettings.coins)
        })
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  const handleActionSelect = (action: string) => {
    setCurrentAction(action)
    router.push(`/settings?action=${action}`, { scroll: false })
  }

  const handleBackToSettings = () => {
    setCurrentAction(null)
    router.push('/settings', { scroll: false })
  }

  const handleUpdateProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const formData = new FormData()
      formData.append('name', settings.name)
      formData.append('surname', settings.surname)

      const result = await updateUserSettings(formData)
      if (result.error) {
        setMessage(result.error)
      } else {
        setMessage('Профиль успешно обновлен!')
      }
    } catch (error) {
      setMessage('Ошибка при обновлении настроек')
    } finally {
      setLoading(false)
    }
  }

  const [linkedDevices, setLinkedDevices] = useState<any[]>([])
const [qrCodeData, setQrCodeData] = useState('')

const [showQRScanner, setShowQRScanner] = useState(false)

// Функция для обработки отсканированного QR-кода
const handleQRScan = async (scannedData: string) => {
  setLoading(true);
  setMessage('');
  
  try {
    const data = JSON.parse(scannedData);
    
    if (data.type === 'quick_login') {
      // Получаем текущего пользователя (того, кто сканирует)
      const currentUser = await getCurrentUser();
      
      if (!currentUser) {
        setMessage('Вы не авторизованы');
        return;
      }

      // Связываем устройство - создаем сессию для текущего пользователя
      const result = await quickLoginWithQRCode(data.token, {
        deviceInfo: {
          browser: navigator.userAgent,
          platform: navigator.platform,
          type: 'web'
        },
        userAgent: navigator.userAgent
      }, currentUser.email); // Передаем email текущего пользователя
      
      if (result.error) {
        setMessage(result.error);
      } else {
        setMessage('Устройство успешно связано!');
        setShowQRScanner(false);
        
        // Обновляем страницу
        router.refresh();
      }
    } else {
      setMessage('Неизвестный тип QR-кода');
    }
  } catch (error) {
    setMessage('Ошибка при обработке QR-кода');
    console.error('QR scan error:', error);
  } finally {
    setLoading(false);
  }
};

// Функция для генерации QR-кода
const generateLinkingQRCode = async () => {
  setLoading(true)
  setMessage('')
  
  try {
    const result = await generateDeviceLinkingToken()
    if (result.error) {
      setMessage(result.error)
    } else {
      setMessage('QR-код сгенерирован! Токен действителен 5 минут.')
      // Формируем данные для QR-кода
      setQrCodeData(JSON.stringify({
        type: 'device_linking',
        token: result.token,
        expiresAt: result.expiresAt
      }))
    }
  } catch (error) {
    setMessage('Ошибка при генерации QR-кода')
  } finally {
    setLoading(false)
  }
}

// Функция для загрузки связанных устройств
const loadLinkedDevices = async () => {
  const result = await getLinkedDevices()
  if (result.success) {
    setLinkedDevices(result.devices || [])
  }
}

// Функция для отвязывания устройства
const handleRemoveDevice = async (deviceId: string) => {
  const result = await removeDeviceSession(deviceId)
  if (result.success) {
    setMessage('Устройство успешно отвязано')
    loadLinkedDevices()
  } else {
    setMessage(result.error || 'Ошибка при отвязывании устройства')
  }
}

// Загружаем устройства при монтировании
useEffect(() => {
  if (currentAction === 'link-devices') {
    loadLinkedDevices()
  }
}, [currentAction])

  const handleBuyPremium = async () => {
    setPremiumLoading(true)
    setMessage('')

    try {
      const result = await buyPremium()
      if (result.error) {
        setMessage(result.error)
      } else {
        setMessage(result.message!)
        setSettings(prev => ({ ...prev, isPremium: true }))
      }
    } catch (error) {
      setMessage('Ошибка при активации Premium')
    } finally {
      setPremiumLoading(false)
    }
  }

  const handleAvatarClick = () => {
    setShowAvatarMenu(!showAvatarMenu)
  }

  const handleFileInputClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    try {
      const uploadResult = await uploadAvatar(file)
      
      const result = await updateUserAvatar(uploadResult.url)
      if (result.error) {
        setMessage(result.error)
      } else {
        setMessage('Аватар успешно обновлен!')
        setSettings(prev => ({ ...prev, avatar: uploadResult.url }))
        setShowAvatarMenu(false)
      }
    } catch (error) {
      console.error('Error uploading avatar:', error)
      setMessage('Ошибка при загрузке аватара')
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true)
    try {
      const result = await updateUserAvatar('')
      if (result.error) {
        setMessage(result.error)
      } else {
        setMessage('Аватар успешно удален!')
        setSettings(prev => ({ ...prev, avatar: '' }))
        setShowAvatarMenu(false)
      }
    } catch (error) {
      console.error('Error removing avatar:', error)
      setMessage('Ошибка при удалении аватара')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordLoading(true)
    setMessage('')

    try {
      const formData = new FormData()
      formData.append('currentPassword', passwordForm.currentPassword)
      formData.append('newPassword', passwordForm.newPassword)
      formData.append('confirmPassword', passwordForm.confirmPassword)

      const result = await updatePassword(formData)
      if (result.error) {
        setMessage(result.error)
      } else {
        setMessage('Пароль успешно изменен!')
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        })
      }
    } catch (error) {
      setMessage('Ошибка при изменении пароля')
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleClearCache = async () => {
    const result = await clearCache()
    setMessage(result.message!)
    setShowClearCacheModal(false)
  }

  const getUserAvatar = () => {
    if (settings.avatar) {
      return (
        <img 
          src={settings.avatar} 
          alt="Avatar" 
          className="w-32 h-32 rounded-full object-cover border-4 border-purple-500"
        />
      )
    }
    return (
      <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white text-4xl font-bold shadow-lg border-4 border-purple-500">
        {settings.name?.[0]?.toUpperCase()}{settings.surname?.[0]?.toUpperCase()}
      </div>
    )
  }

  // Если выбрано действие, показываем страницу действия, иначе - выбор действий
  if (currentAction) {
    return (
      <>
        <ActionPage
          action={currentAction}
          settings={settings}
          onBack={handleBackToSettings}
          getUserAvatar={getUserAvatar}
          message={message}
          loading={loading}
          passwordLoading={passwordLoading}
          showClearCacheModal={showClearCacheModal}
          setShowClearCacheModal={setShowClearCacheModal}
          onUpdateProfile={handleUpdateProfile}
          onChangePassword={handleChangePassword}
          onClearCache={handleClearCache}
          onBuyPremium={handleBuyPremium}
          fileInputRef={fileInputRef}
          showAvatarMenu={showAvatarMenu}
          setShowAvatarMenu={setShowAvatarMenu}
          onAvatarClick={handleAvatarClick}
          onFileInputClick={handleFileInputClick}
          onFileInputChange={handleFileInputChange}
          onRemoveAvatar={handleRemoveAvatar}
          uploadingAvatar={uploadingAvatar}
          avatarMenuRef={avatarMenuRef}
          passwordForm={passwordForm}
          setPasswordForm={setPasswordForm}
          setSettings={setSettings}
          twoFactorStatus={twoFactorStatus}
          showTwoFactorModal={showTwoFactorModal}
          setShowTwoFactorModal={setShowTwoFactorModal}
          twoFactorCode={twoFactorCode}
          setTwoFactorCode={setTwoFactorCode}
          onEnableTwoFactor={handleEnableTwoFactor}
          onVerifyTwoFactor={handleVerifyTwoFactor}
          onDisableTwoFactor={handleDisableTwoFactor}
          handleAddCoins={handleAddCoins}
          generateLinkingQRCode={generateLinkingQRCode}
          handleRemoveDevice={handleRemoveDevice}
          qrCodeData={qrCodeData}
          linkedDevices={linkedDevices}
          setShowQRScanner={setShowQRScanner}
          showQRScanner={showQRScanner}
          handleQRScan={handleQRScan}
        />
        <ClearCacheModal 
          isOpen={showClearCacheModal}
          onClose={() => setShowClearCacheModal(false)}
          onConfirm={handleClearCache}
        />
      </>
    )
  }

  return (
    <ActionSelection
      settings={settings}
      onActionSelect={handleActionSelect}
      getUserAvatar={getUserAvatar}
    />
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black/40 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">Настройки</h1>
            <p className="text-gray-400 text-lg">Загрузка...</p>
          </div>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
          </div>
        </div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  )
}