import { getForumPostById } from '@/app/lib/api/forum'
import { notFound } from 'next/navigation'

type Props = {
  params: { id: string }
}

export default async function ForumPostPage({ params }: Props) {
  const postId = Number(params.id)
  const post = await getForumPostById(postId)

  if (!post) notFound()

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <article className="space-y-2">
        <h1 className="text-2xl font-bold">{post.title}</h1>
        <p className="text-sm text-gray-500">
          Автор:{' '}
          <a
            href={`/forum/profile/${post.author.username}`}
            className="underline"
          >
            {post.author.username || post.author.name}
          </a>
        </p>
        <p>{post.content}</p>
      </article>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Комментарии</h2>

        {post.comments.length === 0 && (
          <p className="text-sm text-gray-500">Комментариев нет</p>
        )}

        {post.comments.map(comment => (
          <Comment key={comment.id} comment={comment} />
        ))}
      </section>
    </div>
  )
}

function Comment({ comment }: any) {
  return (
    <div className="border rounded p-3 space-y-2">
      <p className="text-sm font-medium">
        {comment.author.username || comment.author.name}
      </p>
      <p>{comment.content}</p>

      {comment.replies?.length > 0 && (
        <div className="pl-4 space-y-2 border-l">
          {comment.replies.map((reply: any) => (
            <div key={reply.id} className="text-sm">
              <span className="font-medium">
                {reply.author.username || reply.author.name}:
              </span>{' '}
              {reply.content}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
