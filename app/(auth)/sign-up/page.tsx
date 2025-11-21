'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { createUser } from '@/app/lib/api/user'
import Image from 'next/image'

type FormData = {
  name: string
  surname: string
  email: string
  phone: string
  password: string
  confirmPassword: string
}

export default function SignUpPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [yandexLoading, setYandexLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    surname: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  })

  const searchParams = useSearchParams();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const validateStep1 = () => {
    if (!formData.name.trim() || !formData.surname.trim()) {
      setError('Пожалуйста, заполните все поля')
      return false
    }
    return true
  }

  const validateStep2 = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/
    
    if (!formData.email.trim() || !formData.phone.trim()) {
      setError('Пожалуйста, заполните все поля')
      return false
    }
    
    if (!emailRegex.test(formData.email)) {
      setError('Пожалуйста, введите корректный email')
      return false
    }
    
    if (!phoneRegex.test(formData.phone)) {
      setError('Пожалуйста, введите корректный номер телефона')
      return false
    }
    
    return true
  }

  const validateStep3 = () => {
    if (!formData.password || !formData.confirmPassword) {
      setError('Пожалуйста, заполните все поля')
      return false
    }
    
    if (formData.password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов')
      return false
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают')
      return false
    }
    
    return true
  }

  const handleNext = () => {
    setError('')
    
    if (step === 1 && validateStep1()) {
      setStep(2)
    } else if (step === 2 && validateStep2()) {
      setStep(3)
    }
  }

  const handleYandexLogin = async () => {
    setYandexLoading(true);
    
    try {
      const result = await signIn("yandex", {
        redirect: false,
        callbackUrl: searchParams.get('callbackUrl') || '/',
      });

      if (result?.error) {
        setError("Ошибка при входе через Яндекс");
      }
    } catch (error) {
      setError("Ошибка при входе через Яндекс");
    } finally {
      setYandexLoading(false);
    }
  };

  const handleBack = () => {
    setError('')
    setStep(step - 1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!validateStep3()) return
    
    setLoading(true)

    try {
      const result = await createUser({
        name: formData.name,
        surname: formData.surname,
        email: formData.email,
        phone: formData.phone,
        password: formData.password
      })

      if (result.error) {
        setError(result.error)
        setLoading(false)
        return
      }

      const signInResult = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false
      })

      if (signInResult?.error) {
        setError('Ошибка при входе. Пожалуйста, войдите вручную.')
        router.push('/sign-in')
      } else {
        router.push('/submain')
      }
    } catch (err) {
      setError('Произошла ошибка при регистрации')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-transparent p-4">
            <div className="w-full max-w-md">
              <div className="w-full p-6 bg-black/40 backdrop-blur-sm rounded-xl border border-gray-700 shadow-2xl">
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                  <span className="text-white">Загрузка...</span>
                </div>
              </div>
            </div>
          </div>
        }>
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-[340px] md:w-sm space-y-8 bg-black/40 py-6 px-14 rounded-2xl">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Регистрация
          </h2>
          <div className="mt-4 flex justify-center">
            <div className="flex space-x-2">
              {[1, 2, 3].map((number) => (
                <div
                  key={number}
                  className={`w-3 h-3 rounded-full ${
                    step === number ? 'bg-purple-500' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Шаг 1: Имя и фамилия */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-white">
                  Имя
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="mt-1 duration-200 appearance-none relative block w-full px-4 py-2 border border-gray-300 placeholder-gray-500 text-white rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                  placeholder="Введите ваше имя"
                />
              </div>
              <div>
                <label htmlFor="surname" className="block text-sm font-medium text-white">
                  Фамилия
                </label>
                <input
                  id="surname"
                  name="surname"
                  type="text"
                  required
                  value={formData.surname}
                  onChange={handleInputChange}
                  className="mt-1 duration-200 appearance-none relative block w-full px-4 py-2 border border-gray-300 placeholder-gray-500 text-white rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                  placeholder="Введите вашу фамилию"
                />
              </div>
            </div>
          )}

          {/* Шаг 2: Email и телефон */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-white">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="mt-1 duration-200 appearance-none relative block w-full px-4 py-2 border border-gray-300 placeholder-gray-500 text-white rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                  placeholder="Введите ваш email"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-white">
                  Телефон
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="mt-1 duration-200 appearance-none relative block w-full px-4 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                  placeholder="Введите ваш телефон"
                />
              </div>
            </div>
          )}

          {/* Шаг 3: Пароль */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-white">
                  Пароль
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="mt-1 duration-200 appearance-none relative block px-4 py-2 w-full border border-gray-300 placeholder-gray-500 text-white rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                  placeholder="Введите пароль"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-white">
                  Подтвердите пароль
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="mt-1 duration-200 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-white rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                  placeholder="Повторите пароль"
                />
              </div>
            </div>
          )}

          <div className="flex space-x-4">
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Назад
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Далее
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Регистрация...' : 'Зарегистрироваться'}
              </button>
            )}
          </div>

          <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full border-t border-gray-600"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                              <span className="px-2 bg-black/40 text-gray-400">или</span>
                            </div>
                          </div>
                          <button
                            onClick={handleYandexLogin}
                            disabled={yandexLoading}
                            className="w-full mb-4 bg-purple-500 text-white py-3 px-4 rounded-lg hover:bg-purple-600 transition-all duration-200 font-medium flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                          >
                            <Image src="/assets/images/Yandex_icon.svg.png" alt="Яндекс" width={30} height={30} />
                            <span>
                              {yandexLoading ? "Вход..." : "Войти через Яндекс"}
                            </span>
                          </button>

          <div className="text-center">
            <a
              href="/sign-in"
              className="font-medium text-white hover:underline"
            >
              Уже есть аккаунт? <span className="text-purple-500">Войдите</span>
            </a>
          </div>
        </form>
      </div>
    </div>
    </Suspense>
  )
}