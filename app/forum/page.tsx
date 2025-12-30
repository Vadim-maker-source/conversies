// app/forum/page.tsx
import Link from 'next/link'
import { Suspense } from 'react'
import { 
  getForumCategories, 
  getRecentPosts, 
  getPopularPosts, 
  getForumStats,
  getForumPostsByCategory  // Добавляем эту функцию
} from '@/app/lib/api/forum'
import ForumStats from '@/components/ForumStats'

export default async function ForumPage() {
  const [categories, recentPosts, popularPosts, stats] = await Promise.all([
    getForumCategories(),
    getRecentPosts(20),  // Увеличиваем до 20
    getPopularPosts(10),
    getForumStats()
  ])

  // Получаем последние посты из всех категорий
  const allPostsPromises = categories.map(category => 
    getForumPostsByCategory(category.id, 1, 5)
  )
  const allPostsResults = await Promise.all(allPostsPromises)

  // Собираем все посты в один массив
  const allPosts = allPostsResults.flatMap(result => result.posts)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 15)  // Ограничиваем до 15 последних постов

  return (
    <div className="min-h-screen">
      {/* Декоративные элементы */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-12">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold text-gray-100 mb-4">
                Форум
              </h1>
              <p className="text-lg text-gray-100 max-w-3xl">
                Обсуждайте, задавайте вопросы, делитесь опытом и находите единомышленников
              </p>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <Link
                href="/forum/create"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl font-medium"
              >
                <span className="text-xl">+</span>
                Создать пост
              </Link>
              
              <Link
                href="/forum/search"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 rounded-xl hover:bg-gray-50 transition-all border border-gray-200 shadow-sm font-medium"
              >
                <span>🔍</span>
                Поиск по форуму
              </Link>
            </div>
          </div>

          {/* Статистика */}
          {stats && (
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <ForumStats stats={stats} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Основной контент - все посты */}
          <div className="lg:col-span-3">
            {/* Блок всех последних постов */}
            <section className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-gray-100 mb-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-gray-900">
                  Последние посты со всего форума
                </h2>
                <div className="text-sm text-gray-500">
                  {allPosts.length} постов
                </div>
              </div>
              
              <Suspense fallback={<PostsLoading />}>
                <AllPostsList posts={allPosts} />
              </Suspense>
              
              <div className="mt-8 pt-8 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Показано {Math.min(allPosts.length, 15)} последних постов
                  </div>
                  <Link 
                    href="/forum/recent"
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Все посты по дате →
                  </Link>
                </div>
              </div>
            </section>

            {/* Популярные посты */}
            <section className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Популярные посты
                </h2>
                <Link 
                  href="/forum/popular"
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Все популярные →
                </Link>
              </div>
              
              <Suspense fallback={<PostsLoading />}>
                <PopularPostsList posts={popularPosts} />
              </Suspense>
            </section>
          </div>

          {/* Боковая панель */}
          <div className="space-y-6">
            {/* Список категорий */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">
                  Категории форума
                </h3>
                <span className="text-sm text-gray-500">
                  {categories.length} категорий
                </span>
              </div>
              
              <Suspense fallback={<CategoriesLoading />}>
                <CategoriesList categories={categories} />
              </Suspense>
              
              <div className="mt-6 pt-6 border-t border-gray-200">
                <Link 
                  href="/forum/categories"
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Все категории →
                </Link>
              </div>
            </div>

            {/* Быстрые действия */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Быстрые действия
              </h3>
              <div className="space-y-3">
                <Link
                  href="/forum/create"
                  className="flex items-center justify-between p-4 bg-white rounded-xl hover:shadow-md transition-all border border-blue-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600">✏️</span>
                    </div>
                    <div>
                      <div className="font-medium">Создать пост</div>
                      <div className="text-sm text-gray-500">Поделитесь идеей</div>
                    </div>
                  </div>
                  <span className="text-blue-600">→</span>
                </Link>
                
                <Link
                  href="/forum/profile/me"
                  className="flex items-center justify-between p-4 bg-white rounded-xl hover:shadow-md transition-all border border-blue-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <span className="text-green-600">👤</span>
                    </div>
                    <div>
                      <div className="font-medium">Мой профиль</div>
                      <div className="text-sm text-gray-500">Управление аккаунтом</div>
                    </div>
                  </div>
                  <span className="text-green-600">→</span>
                </Link>
                
                <Link
                  href="/forum/search"
                  className="flex items-center justify-between p-4 bg-white rounded-xl hover:shadow-md transition-all border border-blue-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <span className="text-purple-600">🔍</span>
                    </div>
                    <div>
                      <div className="font-medium">Поиск</div>
                      <div className="text-sm text-gray-500">Найти посты и темы</div>
                    </div>
                  </div>
                  <span className="text-purple-600">→</span>
                </Link>
              </div>
            </div>

            {/* Статистика активности */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Активность сегодня
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">Новые посты</div>
                  <div className="font-bold text-gray-900">
                    {allPosts.filter(post => 
                      new Date(post.createdAt).toDateString() === new Date().toDateString()
                    ).length}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">Новые комментарии</div>
                  <div className="font-bold text-gray-900">-</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">Активные пользователи</div>
                  <div className="font-bold text-gray-900">-</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Компонент для отображения всех постов
function AllPostsList({ posts }: { posts: any[] }) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Пока нет постов на форуме</p>
        <Link 
          href="/forum/create" 
          className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block"
        >
          Создайте первый пост
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {posts.map(post => (
        <div
          key={post.id}
          className="p-4 rounded-lg border hover:shadow-md transition-all"
        >
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <Link 
                href={`/forum/post/${post.id}`}
                className="group"
              >
                <h3 className="text-lg font-semibold group-hover:text-blue-600 mb-2">
                  {post.title}
                </h3>
              </Link>
              
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-3">
                <Link 
                  href={`/forum/profile/${post.author.username}`}
                  className="flex items-center gap-2 hover:text-blue-600"
                >
                  {post.author.avatar && (
                    <img 
                      src={post.author.avatar} 
                      alt={post.author.username || ''}
                      className="w-6 h-6 rounded-full"
                    />
                  )}
                  <span>{post.author.username || post.author.name}</span>
                  {post.author.isPremium && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                      PRO
                    </span>
                  )}
                </Link>
                
                <span>•</span>
                
                <Link 
                  href={`/forum/${post.category.slug}`}
                  className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                >
                  {post.category.title}
                </Link>
                
                <span>•</span>
                
                <span>{new Date(post.createdAt).toLocaleDateString('ru-RU')}</span>
                
                <span>•</span>
                
                <span>{post.viewsCount} просмотров</span>
              </div>
              
              <p className="text-gray-700 line-clamp-2">
                {post.content.replace(/<[^>]*>/g, '').substring(0, 200)}...
              </p>
              
              {/* Теги */}
              {post.tags && Array.isArray(post.tags) && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {post.tags.slice(0, 3).map((postTag: any) => (
                    postTag?.tag && (
                      <Link
                        key={postTag.tag.id}
                        href={`/forum/tag/${postTag.tag.slug}`}
                        className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200"
                      >
                        #{postTag.tag.name}
                      </Link>
                    )
                  ))}
                  {post.tags.length > 3 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-400 rounded text-xs">
                      +{post.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
              
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1 text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {post._count?.comments || 0}
                  </span>
                  
                  <span className="flex items-center gap-1 text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905a3.61 3.61 0 01-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                    {post._count?.reactions || 0}
                  </span>
                </div>
                
                <Link 
                  href={`/forum/post/${post.id}`}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Читать →
                </Link>
              </div>
            </div>
            
            {post.images && post.images.length > 0 && (
              <div className="flex-shrink-0">
                <div className="w-24 h-24 rounded-lg overflow-hidden">
                  <img 
                    src={post.images[0]} 
                    alt="Изображение поста"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// Компонент списка категорий
function CategoriesList({ categories }: { categories: any[] }) {
  if (categories.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-500 text-sm">Категорий пока нет</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {categories.map(category => (
        <Link
          key={category.id}
          href={`/forum/${category.slug}`}
          className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600">🏷️</span>
            </div>
            <div>
              <div className="font-medium text-gray-900 group-hover:text-blue-600">
                {category.title}
              </div>
              <div className="text-xs text-gray-500">
                {category._count?.posts || 0} постов
              </div>
            </div>
          </div>
          <span className="text-gray-400 group-hover:text-blue-400">→</span>
        </Link>
      ))}
    </div>
  )
}

// Компонент популярных постов
function PopularPostsList({ posts }: { posts: any[] }) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Популярных постов пока нет</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {posts.slice(0, 5).map(post => (
        <Link
          key={post.id}
          href={`/forum/post/${post.id}`}
          className="block p-4 rounded-xl border border-gray-200 hover:border-blue-200 hover:shadow-md transition-all"
        >
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-900 hover:text-blue-600 mb-2 line-clamp-1">
                {post.title}
              </h4>
              
              <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
                <span className="flex items-center gap-1">
                  👁️ {post.viewsCount}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  💬 {post._count?.comments || 0}
                </span>
                <span>•</span>
                <span>{new Date(post.createdAt).toLocaleDateString('ru-RU')}</span>
              </div>
              
              <p className="text-gray-600 text-sm line-clamp-2">
                {post.content.replace(/<[^>]*>/g, '').substring(0, 100)}...
              </p>
            </div>
            
            {post.images && post.images.length > 0 && (
              <div className="flex-shrink-0">
                <div className="w-20 h-20 rounded-lg overflow-hidden">
                  <img
                    src={post.images[0]}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}

// Компоненты загрузки
function CategoriesLoading() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="flex items-center justify-between p-3 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-200"></div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded w-24"></div>
                <div className="h-2 bg-gray-200 rounded w-16"></div>
              </div>
            </div>
            <div className="w-6 h-6 bg-gray-200 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  )
}

function PostsLoading() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="animate-pulse p-4 rounded-xl border">
          <div className="flex items-start gap-4">
            <div className="flex-1 space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="flex gap-4">
                <div className="h-3 bg-gray-200 rounded w-16"></div>
                <div className="h-3 bg-gray-200 rounded w-16"></div>
                <div className="h-3 bg-gray-200 rounded w-20"></div>
              </div>
              <div className="h-3 bg-gray-200 rounded w-full"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
            <div className="w-24 h-24 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      ))}
    </div>
  )
}