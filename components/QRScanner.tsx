// components/QRScanner.tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCamera, faQrcode, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons'

interface QRScannerProps {
  onScan: (data: string) => void
  onClose: () => void
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [scanning, setScanning] = useState(true)
  const [error, setError] = useState<string>('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startCamera = useCallback(async () => {
    try {
      setError('')
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
      }
    } catch (err) {
      setError('Не удалось получить доступ к камере')
      console.error('Camera error:', err)
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }, [])

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !scanning) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    // Устанавливаем размеры canvas как у video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Рисуем текущий кадр
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Получаем данные изображения для анализа
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    
    // Простая проверка на QR-код (в реальном приложении используйте библиотеку jsQR)
    analyzeFrame(imageData)
  }, [scanning])

  const analyzeFrame = useCallback((imageData: ImageData) => {
    // Здесь будет логика распознавания QR-кода
    // Для демонстрации используем простую эмуляцию
    setTimeout(() => {
      if (scanning) {
        // Эмуляция найденного QR-кода
        const mockQRData = JSON.stringify({
          type: 'device_linking',
          token: 'mock_token_' + Date.now(),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        })
        
        onScan(mockQRData)
        setScanning(false)
        stopCamera()
      }
    }, 2000)
  }, [scanning, onScan, stopCamera])

  // Запускаем камеру при монтировании
  useState(() => {
    startCamera()
    
    const interval = setInterval(() => {
      if (scanning) {
        captureFrame()
      }
    }, 1000)

    return () => {
      clearInterval(interval)
      stopCamera()
    }
  })

  const handleRetry = () => {
    setScanning(true)
    setError('')
    startCamera()
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
      <div className="relative w-full max-w-md mx-4">
        {/* Заголовок */}
        <div className="absolute top-4 left-0 right-0 z-10 flex justify-between items-center px-4">
          <h2 className="text-white text-lg font-semibold">Сканирование QR-кода</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 transition-colors p-2"
          >
            <FontAwesomeIcon icon={faTimes} className="w-6 h-6" />
          </button>
        </div>

        {/* Область сканирования */}
        <div className="relative bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-96 object-cover"
          />
          
          {/* Оверлей для сканирования */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="border-2 border-white rounded-lg w-64 h-64 relative">
              {/* Угловые маркеры */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white"></div>
              
              {/* Анимация сканирования */}
              {scanning && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-green-500 animate-pulse"></div>
              )}
            </div>
          </div>

          {/* Сообщения */}
          <div className="absolute bottom-4 left-0 right-0 text-center">
            {error ? (
              <div className="text-red-400 bg-black/70 py-2 rounded">
                {error}
              </div>
            ) : scanning ? (
              <div className="text-white bg-black/70 py-2 rounded">
                Наведите камеру на QR-код
              </div>
            ) : (
              <div className="text-green-400 bg-black/70 py-2 rounded flex items-center justify-center space-x-2">
                <FontAwesomeIcon icon={faCheck} className="w-4 h-4" />
                <span>QR-код распознан!</span>
              </div>
            )}
          </div>
        </div>

        {/* Кнопки управления */}
        <div className="flex space-x-3 mt-4">
          {error && (
            <button
              onClick={handleRetry}
              className="flex-1 bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              Повторить
            </button>
          )}
          
          <button
            onClick={onClose}
            className="flex-1 bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Отмена
          </button>
        </div>

        {/* Скрытый canvas для анализа кадров */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  )
}