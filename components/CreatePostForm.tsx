'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createForumPost } from '@/app/lib/api/forum'

interface Category {
  id: number
  title: string
  description: string | null
  _count: {
    posts: number
  }
}

interface CreatePostFormProps {
  categories: Category[]
}

export default function CreatePostForm({ categories }: CreatePostFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    // Лимит 5 изображений
    if (files.length + images.length > 5) {
      setError('Можно загрузить не более 5 изображений')
      return
    }

    // Проверка размера файлов (макс 5MB каждый)
    const oversizedFiles = files.filter(file => file.size > 5 * 1024 * 1024)
    if (oversizedFiles.length > 0) {
      setError('Размер каждого файла не должен превышать 5MB')
      return
    }

    setImages(prev => [...prev, ...files])
    
    // Создаем превью
    const newPreviews: string[] = []
    files.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        newPreviews.push(reader.result as string)
        if (newPreviews.length === files.length) {
          setImagePreviews(prev => [...prev, ...newPreviews])
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const formData = new FormData(e.currentTarget)
      
      // Добавляем изображения в FormData
      images.forEach(image => {
        formData.append('images', image)
      })

      const result = await createForumPost(formData)
      
      if (result.success) {
        router.push(`/forum/post/${result.postId}`)
        router.refresh()
      } else {
        setError(result.error || 'Ошибка при создании поста')
      }
    } catch (err) {
      setError('Произошла непредвиденная ошибка')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black-50/40 to-transparent">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link 
            href="/forum" 
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-3 py-1 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Назад к форуму
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold mt-4 text-white">Создать пост</h1>
          <p className="text-gray-100 mt-2">
            Поделитесь своими мыслями, вопросами или идеями
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Заголовок */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Заголовок (опционально)
              </label>
              <input
                name="title"
                placeholder="О чем вы хотите рассказать?"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-3 focus:ring-blue-500/30 focus:border-blue-500 transition-all outline-none"
                maxLength={200}
              />
              <p className="text-xs text-gray-500">
                Будет показано в ленте форума
              </p>
            </div>

            {/* Категория */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Категория <span className="text-red-500">*</span>
                </label>
                <select
                  name="categoryId"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-3 focus:ring-blue-500/30 focus:border-blue-500 transition-all outline-none appearance-none bg-white"
                  required
                >
                  <option value="">Выберите категорию</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.title} ({cat._count.posts})
                    </option>
                  ))}
                </select>
              </div>

              {selectedCategory === '' && (
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Или создайте новую категорию
                  </label>
                  <input
                    name="newCategory"
                    placeholder="Введите название категории"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-3 focus:ring-blue-500/30 focus:border-blue-500 transition-all outline-none"
                    maxLength={50}
                  />
                </div>
              )}
            </div>

            {/* Основной текст */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Текст поста <span className="text-red-500">*</span>
              </label>
              <textarea
                name="content"
                placeholder="Напишите здесь все, что хотите сказать..."
                rows={8}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-3 focus:ring-blue-500/30 focus:border-blue-500 transition-all outline-none resize-y min-h-[200px] max-h-[600px]"
                required
                minLength={10}
              />
              <p className="text-xs text-gray-500">
                Ссылки будут автоматически преобразованы в кликабельные
              </p>
            </div>

            {/* Местоположение */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Местоположение (опционально)
              </label>
              <input
                type="text"
                name="location"
                placeholder="Город, страна или место"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-3 focus:ring-blue-500/30 focus:border-blue-500 transition-all outline-none"
              />
            </div>

            {/* Изображения */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Изображения (опционально, максимум 5)
                </label>
                
                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative group">
                        <div className="aspect-square rounded-xl overflow-hidden border border-gray-200">
                          <img
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-90 hover:opacity-100 hover:scale-110 transition-all shadow-lg"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                          {images[index]?.name.substring(0, 15)}
                          {images[index]?.name.length > 15 ? '...' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {images.length < 5 && (
                  <div
                    className="border-3 border-dashed border-gray-300 rounded-2xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="text-gray-400 mb-4">
                      <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-700 font-medium">Нажмите для загрузки изображений</p>
                    <p className="text-sm text-gray-500 mt-2">
                      PNG, JPG, GIF до 5MB • {5 - images.length} из 5 доступно
                    </p>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                name="images"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="hidden"
              />
            </div>

            {/* Кнопки */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-8 border-t">
              <Link
                href="/forum"
                className="w-full sm:w-auto px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all text-center font-medium"
              >
                Отмена
              </Link>
              
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-lg hover:shadow-xl flex items-center justify-center gap-3"
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
                    Публикация...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Опубликовать
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Советы */}
        <div className="mt-8 bg-blue-50 rounded-2xl p-6 border border-blue-100">
          <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            Советы для лучшего поста
          </h3>
          <ul className="space-y-2 text-sm text-blue-700">
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>Будьте конкретны и пишите по делу</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>Используйте заголовок, который отражает суть</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>Добавьте изображения для наглядности</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>Выбирайте правильную категорию</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}