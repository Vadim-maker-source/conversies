import { getForumPostById, getSimilarPosts, togglePinPost, getPostStats, getUserReaction } from '@/app/lib/api/forum'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/lib/auth'
import PostActions from '@/components/PostActions'
import ImageSlider from '@/components/ImageSlider'
import PostStats from '@/components/PostStats'
import CommentSection from '@/components/CommentSection'
import SimilarPosts from '@/components/SimilarPosts'
import ContentWithLinks from '@/components/ContentWithLinks'
import UserSubscribeButton from '@/components/UserSubscribeButton'

type Props = {
  params: { id: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

export default async function ForumPostPage({ params, searchParams }: Props) {
  const postId = Number(params.id)
  const [post, similarPosts, stats, session] = await Promise.all([
    getForumPostById(postId),
    getSimilarPosts(postId, 4),
    getPostStats(postId),
    getServerSession(authOptions)
  ])

  if (!post) notFound()

  const isAuthor = session?.user?.id && post.authorId === Number(session.user.id)
  const userId = session?.user?.id ? Number(session.user.id) : null

  const userReactions = session?.user?.id 
  ? post.reactions?.filter(r => r.userId === Number(session.user.id)) || []
  : []

  function getReactionCounts(reactions: any[] = []) {
    const counts: Record<string, number> = {}
    
    reactions.forEach(reaction => {
      const emoji = reaction.emoji
      counts[emoji] = (counts[emoji] || 0) + 1
    })
    
    return Object.entries(counts).map(([emoji, count]) => ({
      emoji,
      count
    }))
  }

  const userReaction = await getUserReaction(postId)

  return (
    <div className="min-h-screen">
      {/* Бэкграунд декорация */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-8">
        {/* Хлебные крошки */}
        <nav className="mb-8">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-gray-100">
            <li>
              <Link href="/forum" className="hover:text-gray-200 transition-colors">
                Форум
              </Link>
            </li>
            <li className="flex items-center">
              <span className="mx-2">/</span>
              <Link 
                href={`/forum/${post.category.slug}`}
                className="hover:text-gray-200 transition-colors"
              >
                {post.category.title}
              </Link>
            </li>
            <li className="flex items-center">
              <span className="mx-2">/</span>
              <span className="text-white font-medium truncate max-w-[200px]">
                {post.title}
              </span>
            </li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Основной контент */}
          <div className="lg:col-span-2 space-y-8">
            {/* Карточка поста */}
            <article className="bg-white/80 rounded-2xl shadow-xl overflow-hidden border border-gray-100">
              {/* Заголовок и мета-информация */}
              <div className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      {post.isPinned && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                          📌 Закреплено
                        </span>
                      )}
                      {post.isLocked && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                          🔒 Закрыто
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                        {post.category.title}
                      </span>
                    </div>
                    
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 mt-3 leading-tight w-full">
                      {post.title}
                    </h1>
                    
                    {/* Автор и дата */}
                    <div className="flex items-center gap-4 mb-6 w-96">
                      <Link 
                        href={`/forum/profile/${post.author.username}`}
                        className="group flex items-center gap-3"
                      >
                        <div className="relative">
                          {post.author.avatar ? (
                            <img 
                              src={post.author.avatar} 
                              alt={post.author.username || ''}
                              className="w-20 aspect-square rounded-full border-2 border-white shadow-lg"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg border-2 border-white shadow-lg">
                              {post.author.name?.[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                          {post.author.isPremium && (
                            <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white">
                              PRO
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                            {post.author.username || post.author.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(post.createdAt).toLocaleDateString('ru-RU', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </Link>
                      
                      {post.location && (
                        <div className="hidden md:flex items-center gap-2 text-gray-600 bg-gray-50 px-4 py-2 rounded-full w-84">
                          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm">{post.location}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Действия поста */}
                  <PostActions 
                    postId={post.id}
                    isAuthor={isAuthor}
                    isPinned={post.isPinned}
                    isLocked={post.isLocked}
                  />
                </div>

                {/* Местоположение (мобильная версия) */}
                {post.location && (
                  <div className="md:hidden mb-6">
                    <div className="flex items-center gap-2 text-gray-600 bg-gray-50 px-4 py-3 rounded-xl">
                      <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm">{post.location}</span>
                    </div>
                  </div>
                )}

                {/* Слайдер изображений */}
                {post.images && post.images.length > 0 && (
                  <div className="mb-8">
                    <ImageSlider images={post.images} />
                    <div className="text-center text-sm text-gray-500 mt-3">
                      {post.images.length} фотографий
                    </div>
                  </div>
                )}

                {/* Контент поста */}
                <div className="prose prose-lg max-w-none mb-8">
                  <ContentWithLinks content={post.content} />
                  
                  {/* Теги */}
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-8 pt-8 border-t border-gray-200">
                      {post.tags.map(({ tag }) => (
                        <Link
                          key={tag.id}
                          href={`/forum/tag/${tag.slug}`}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                        >
                          #{tag.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Статистика поста */}
                {stats && (
                  <div className="mt-8 pt-8 border-t border-gray-200">
                    <PostStats
        postId={postId}
        postData={{
          viewsCount: post.viewsCount || post._count?.views || 0,
          commentsCount: post._count?.comments || 0,
          reactionsCount: post._count?.reactions || 0,
          content: post.content,
          title: post.title,
          authorId: post.authorId
        }}
        userReaction={userReaction}
        initialReactions={post.reactionsData || []}
      />
                  </div>
                )}
              </div>
            </article>

            {/* Секция комментариев */}
            <CommentSection postId={post.id} initialComments={post.comments || []} />
          </div>

          {/* Боковая панель */}
          <div className="space-y-8">
            {/* Информация об авторе */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
  <h3 className="text-lg font-bold text-gray-900 mb-4">Об авторе</h3>
  <div className="space-y-4">
    <Link 
      href={`/forum/profile/${post.author.username}`}
      className="flex items-center gap-4 group"
    >
      <div className="relative">
        {post.author.avatar ? (
          <img
            src={post.author.avatar}
            alt={post.author.username || ''}
            className="w-16 h-16 rounded-full border-4 border-white shadow-lg"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-2xl border-4 border-white shadow-lg">
            {post.author.name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        {post.author.isPremium && (
          <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center border-2 border-white shadow-lg">
            PRO
          </div>
        )}
      </div>
      <div>
        <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
          {post.author.username || post.author.name}
        </div>
        <div className="text-sm text-gray-500">
          {post.author.surname && `${post.author.surname} `}
        </div>
      </div>
    </Link>

    <UserSubscribeButton 
      authorId={post.author.id}
      authorName={post.author.name || post.author.username || 'Автор'}
      userId={userId}
    />
    
    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
      <div className="text-center p-3 bg-blue-50 rounded-xl">
        <div className="text-2xl font-bold text-blue-700">
          {post.author._count?.forumPosts || 0}
        </div>
        <div className="text-xs text-blue-600">Постов</div>
      </div>
      <div className="text-center p-3 bg-green-50 rounded-xl">
        <div className="text-2xl font-bold text-green-700">
          {post.author._count?.forumComments || 0}
        </div>
        <div className="text-xs text-green-600">Комментариев</div>
      </div>
    </div>
    
    <Link 
      href={`/forum/profile/${post.author.username}`}
      className="block w-full text-center px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
    >
      👤 Посмотреть профиль
    </Link>
  </div>
</div>

            {/* Похожие посты */}
            {similarPosts.length > 0 && (
              <SimilarPosts posts={similarPosts} />
            )}

            {/* Информация о категории */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Категория</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                    <span className="text-2xl">🏷️</span>
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{post.category.title}</div>
                    <div className="text-sm text-gray-600">
                      {post.category.description || 'Без описания'}
                    </div>
                  </div>
                </div>
                
                <Link 
                  href={`/forum/category/${post.category.slug}`}
                  className="block w-full text-center px-4 py-3 bg-white hover:bg-gray-50 text-blue-600 font-medium rounded-xl border border-blue-200 transition-colors shadow-sm"
                >
                  📚 Все посты в категории
                </Link>
              </div>
            </div>

            {/* Правила форума */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Правила обсуждения</h3>
              <ul className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Будьте вежливы и уважайте других</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Не спамьте и не рекламируйте</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Следите за темой обсуждения</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Проверяйте информацию перед публикацией</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}