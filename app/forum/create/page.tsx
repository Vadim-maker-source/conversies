import { getForumCategories } from '@/app/lib/api/forum'
import CreatePostForm from '@/components/CreatePostForm'

export default async function CreatePostPage() {
  const categories = await getForumCategories()
  
  return <CreatePostForm categories={categories} />
}