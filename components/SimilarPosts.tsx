'use client'

import Link from 'next/link'

interface SimilarPost {
  id: number
  title: string
  author: {
    name: string | null
    username: string | null
    avatar: string | null
  }
  category: {
    title: string
  }
  _count: {
    comments: number
  }
  viewsCount: number
}

interface SimilarPostsProps {
  posts: SimilarPost[]
}

export default function SimilarPosts({ posts }: SimilarPostsProps) {
  if (posts.length === 0) return null

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Похожие посты</h3>
      <div className="space-y-4">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/forum/post/${post.id}`}
            className="block p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <h4 className="font-semibold text-gray-900 group-hover:text-blue-600 line-clamp-2 mb-2">
              {post.title}
            </h4>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center gap-2">
                {post.author.avatar ? (
                  <img 
                    src={post.author.avatar} 
                    alt={post.author.username || ''}
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs">
                    {post.author.name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <span>{post.author.username || post.author.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {post.viewsCount}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {post._count.comments}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}