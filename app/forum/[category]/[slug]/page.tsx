import { getForumPostsByCategory, getForumCategories } from '@/app/lib/api/forum'
import { notFound } from 'next/navigation'
import Link from 'next/link'

type Props = {
  params: { 
    category: string
    slug: string 
  }
  searchParams: { 
    page?: string 
    sort?: 'newest' | 'popular' | 'commented'
  }
}

export default async function CategoryBySlugPage({ params, searchParams }: Props) {
  // category должен быть 'category', а slug - это slug категории
  if (params.category !== 'category') notFound()
  
  // Получаем все категории чтобы найти нужную по slug
  const categories = await getForumCategories()
  const category = categories.find(cat => cat.slug === params.slug)
  
  if (!category) notFound()
  
  // Получаем посты
  const page = searchParams.page ? parseInt(searchParams.page) : 1
  const sort = searchParams.sort || 'newest'
  const { posts, pagination } = await getForumPostsByCategory(category.id, page, 20)
  
  // Сортируем посты если нужно
  let sortedPosts = [...posts]
  if (sort === 'popular') {
    sortedPosts.sort((a, b) => (b.viewsCount || 0) - (a.viewsCount || 0))
  } else if (sort === 'commented') {
    sortedPosts.sort((a, b) => (b._count?.comments || 0) - (a._count?.comments || 0))
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Декоративные элементы */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 py-8">
        {/* Хлебные крошки */}
        <nav className="mb-8">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <li>
              <Link href="/forum" className="hover:text-blue-600 transition-colors">
                Форум
              </Link>
            </li>
            <li className="flex items-center">
              <span className="mx-2">/</span>
              <Link 
                href={`/forum/category/${category.slug}`}
                className="hover:text-blue-600 transition-colors"
              >
                {category.title}
              </Link>
            </li>
          </ol>
        </nav>
        
        {/* Заголовок категории */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-8 mb-8 border border-blue-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-lg">
                  <span className="text-3xl">🏷️</span>
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                    {category.title}
                  </h1>
                  <p className="text-gray-600 text-lg">
                    {category.description || 'Обсуждения в этой категории'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/forum/create?category=${category.id}`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl font-medium"
              >
                <span className="text-xl">+</span>
                Создать пост
              </Link>
              
              <Link
                href={`/forum/category/${category.id}`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-xl hover:bg-gray-50 transition-all border border-blue-200 font-medium"
              >
                🔢 Посмотреть по ID
              </Link>
            </div>
          </div>
          
          {/* Статистика категории */}
          <div className="mt-6 pt-6 border-t border-blue-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                <div className="text-2xl font-bold text-blue-600">
                  {category._count?.posts || 0}
                </div>
                <div className="text-sm text-gray-600">Всего постов</div>
              </div>
              
              <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                <div className="text-2xl font-bold text-green-600">
                  {pagination.total}
                </div>
                <div className="text-sm text-gray-600">Постов в категории</div>
              </div>
              
              <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                <div className="text-2xl font-bold text-purple-600">
                  {sortedPosts.reduce((sum, post) => sum + (post._count?.comments || 0), 0)}
                </div>
                <div className="text-sm text-gray-600">Комментариев</div>
              </div>
              
              <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                <div className="text-2xl font-bold text-yellow-600">
                  {sortedPosts.reduce((sum, post) => sum + (post.viewsCount || 0), 0)}
                </div>
                <div className="text-sm text-gray-600">Просмотров</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Сортировка и фильтры */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-gray-900">
              Посты в категории ({pagination.total})
            </h2>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-sm text-gray-500">Сортировка:</div>
              <div className="flex bg-gray-100 rounded-xl p-1">
                <Link
                  href={`/forum/category/${category.slug}?sort=newest${searchParams.page ? `&page=${searchParams.page}` : ''}`}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    sort === 'newest' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Новые
                </Link>
                <Link
                  href={`/forum/category/${category.slug}?sort=popular${searchParams.page ? `&page=${searchParams.page}` : ''}`}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    sort === 'popular' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Популярные
                </Link>
                <Link
                  href={`/forum/category/${category.slug}?sort=commented${searchParams.page ? `&page=${searchParams.page}` : ''}`}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    sort === 'commented' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  С комментариями
                </Link>
              </div>
              
              <div className="text-sm text-gray-500">
                Страница {page} из {pagination.pages}
              </div>
            </div>
          </div>
        </div>
        
        {/* Список постов */}
        <div className="bg-white rounded-2xl shadow-sm border">
          {sortedPosts.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-6">📭</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                В этой категории еще нет постов
              </h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Будьте первым, кто создаст интересный пост в категории "{category.title}"
              </p>
              <Link
                href={`/forum/create?category=${category.id}`}
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl font-medium text-lg"
              >
                <span className="text-2xl">+</span>
                Создать первый пост
              </Link>
            </div>
          ) : (
            <>
              {/* Посты */}
              <div className="divide-y divide-gray-100">
                {sortedPosts.map((post, index) => (
                  <div 
                    key={post.id} 
                    className={`p-6 hover:bg-gray-50 transition-colors ${index === 0 ? 'rounded-t-2xl' : ''}`}
                  >
                    <Link href={`/forum/post/${post.id}`} className="group block">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            {post.isPinned && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                                📌 Закреплено
                              </span>
                            )}
                            <span className="text-sm text-gray-500">
                              #{post.id}
                            </span>
                          </div>
                          
                          <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 mb-3">
                            {post.title}
                          </h3>
                          
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-4">
                            <Link 
                              href={`/forum/profile/${post.author.username}`}
                              className="flex items-center gap-2 hover:text-blue-600"
                            >
                              {post.author.avatar ? (
                                <img 
                                  src={post.author.avatar} 
                                  alt={post.author.username || ''}
                                  className="w-8 h-8 rounded-full"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                  {post.author.name?.[0]?.toUpperCase() || '?'}
                                </div>
                              )}
                              <span className="font-medium">
                                {post.author.username || post.author.name}
                              </span>
                              {post.author.isPremium && (
                                <span className="text-xs bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-2 py-0.5 rounded">
                                  PRO
                                </span>
                              )}
                            </Link>
                            
                            <span>•</span>
                            
                            <span>
                              {new Date(post.createdAt).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            
                            <span>•</span>
                            
                            <span className="flex items-center gap-1">
                              <span>👁️</span>
                              {post.viewsCount || 0} просмотров
                            </span>
                          </div>
                          
                          <p className="text-gray-700 line-clamp-3 mb-4">
                            {post.content.replace(/<[^>]*>/g, '').substring(0, 300)}...
                          </p>
                          
                          {/* Теги */}
                          {post.tags && post.tags.length > 0 && (
  <div className="flex flex-wrap gap-2 mb-4">
    {post.tags.slice(0, 3).map((postTag: any) => (
      <span 
        key={postTag.tag.id}
        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors cursor-pointer"
      >
        #{postTag.tag.name}
      </span>
    ))}
    {post.tags.length > 3 && (
      <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs font-medium">
        +{post.tags.length - 3}
      </span>
    )}
  </div>
)}
                          
                          {/* Статистика поста */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-6 text-sm text-gray-600">
                              <span className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                {post._count?.comments || 0} комментариев
                              </span>
                              
                              <span className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905a3.61 3.61 0 01-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                </svg>
                                {post._count?.reactions || 0} реакций
                              </span>
                              
                              {post.location && (
                                <span className="flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                  </svg>
                                  {post.location}
                                </span>
                              )}
                            </div>
                            
                            <span className="text-blue-600 font-medium group-hover:text-blue-800">
                              Читать полностью →
                            </span>
                          </div>
                        </div>
                        
                        {/* Изображение поста */}
                        {post.images && post.images.length > 0 && (
                          <div className="ml-6 flex-shrink-0 hidden sm:block">
                            <div className="w-48 h-32 rounded-xl overflow-hidden shadow-md">
                              <img 
                                src={post.images[0]} 
                                alt="Изображение поста"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
              
              {/* Пагинация */}
              {pagination.pages > 1 && (
                <div className="px-6 py-8 border-t border-gray-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="text-sm text-gray-500">
                      Показано {sortedPosts.length} из {pagination.total} постов
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2">
                      {page > 1 && (
                        <Link
                          href={`/forum/category/${category.slug}?page=${page - 1}&sort=${sort}`}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                        >
                          ← Назад
                        </Link>
                      )}
                      
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                          const pageNum = i + 1
                          if (pageNum <= pagination.pages) {
                            return (
                              <Link
                                key={pageNum}
                                href={`/forum/category/${category.slug}?page=${pageNum}&sort=${sort}`}
                                className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-medium ${
                                  pageNum === page
                                    ? 'bg-blue-600 text-white'
                                    : 'border border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                {pageNum}
                              </Link>
                            )
                          }
                          return null
                        })}
                        
                        {pagination.pages > 5 && page < pagination.pages - 2 && (
                          <span className="px-2 text-gray-400">...</span>
                        )}
                        
                        {pagination.pages > 5 && page <= pagination.pages - 2 && (
                          <Link
                            href={`/forum/category/${category.slug}?page=${pagination.pages}&sort=${sort}`}
                            className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                          >
                            {pagination.pages}
                          </Link>
                        )}
                      </div>
                      
                      {page < pagination.pages && (
                        <Link
                          href={`/forum/category/${category.slug}?page=${page + 1}&sort=${sort}`}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                        >
                          Далее →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Пустой пост для создания */}
        {sortedPosts.length === 0 && (
          <div className="mt-8 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-100">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Создайте первый пост в этой категории!
              </h3>
              <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                Станьте первопроходцем в категории "{category.title}". 
                Поделитесь своими мыслями, задайте вопрос или начните интересное обсуждение.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href={`/forum/create?category=${category.id}`}
                  className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl font-medium text-lg"
                >
                  <span className="text-2xl">+</span>
                  Создать первый пост
                </Link>
                
                <Link
                  href="/forum"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-white text-gray-700 rounded-xl hover:bg-gray-50 transition-all border border-gray-300 font-medium"
                >
                  👁️ Посмотреть другие категории
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}