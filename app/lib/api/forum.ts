'use server'

import { revalidatePath } from "next/cache"
import { prisma } from "../prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth"
import { getCurrentUser } from "./user"
import { redirect } from "next/navigation"
import { uploadFile } from "./chat"
import { PostSubscriptionCheck, SubscriptionResponse, User } from "../types"
import { sendEmail } from "../nodemailer"

// Вспомогательные функции
function extractLinks(text: string): string {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>')
}

// 1. Получение категорий
export async function getForumCategories() {
  try {
    return await prisma.forumCategory.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { posts: true }
        }
      }
    })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return []
  }
}

// 2. Создание поста
export async function createForumPost(formData: FormData) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('Не авторизован')
    }

    const title = String(formData.get('title') || '').trim()
    const content = String(formData.get('content') || '').trim()
    const categoryIdRaw = formData.get('categoryId')
    const newCategoryRaw = String(formData.get('newCategory') || '').trim()
    const location = String(formData.get('location') || '').trim()
    
    if (!content.trim()) {
      throw new Error('Текст поста обязателен')
    }

    if (!categoryIdRaw && !newCategoryRaw) {
      throw new Error('Выберите категорию или создайте новую')
    }

    // Определяем категорию
    let categoryId: number
    if (newCategoryRaw) {
      const existingCategory = await prisma.forumCategory.findFirst({
        where: { 
          title: { 
            equals: newCategoryRaw, 
            mode: 'insensitive' 
          } 
        }
      })

      if (existingCategory) {
        categoryId = existingCategory.id
      } else {
        const slug = newCategoryRaw
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')

        const category = await prisma.forumCategory.create({
          data: {
            title: newCategoryRaw,
            slug,
            description: null
          }
        })
        categoryId = category.id
      }
    } else {
      categoryId = Number(categoryIdRaw)
    }

    // Загрузка изображений
    const uploadedImages: string[] = []
    const files = formData.getAll('images') as File[]
    
    for (const file of files) {
      if (file instanceof File && file.size > 0) {
        try {
          const fileData = new FormData()
          fileData.set('file', file)
          const uploaded = await uploadFile(fileData)
          uploadedImages.push(uploaded.url)
        } catch (error) {
          console.error('Error uploading image:', error)
        }
      }
    }

    // Создание поста
    const post = await prisma.forumPost.create({
      data: {
        title: title || `Пост от ${new Date().toLocaleDateString('ru-RU')}`,
        content: extractLinks(content),
        categoryId,
        authorId: user.id,
        location: location || null,
        images: uploadedImages,
        viewsCount: 0
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true
          }
        },
        category: true
      }
    })

    notifyAuthorSubscribers(user.id, post.id).catch(console.error)

    // Подписываем автора на свой пост
    await prisma.forumPostSubscription.upsert({
      where: {
        userId_postId: {
          userId: user.id,
          postId: post.id
        }
      },
      update: {},
      create: {
        userId: user.id,
        postId: post.id
      }
    })

    revalidatePath('/forum')
    revalidatePath(`/forum/category/${post.categoryId}`)
    
    return { success: true, postId: post.id }
  } catch (error) {
    console.error('Error creating forum post:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Ошибка при создании поста' 
    }
  }
}

export async function getForumPostById(postId: number) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id ? Number(session.user.id) : null

    const post = await prisma.forumPost.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            surname: true,
            avatar: true,
            username: true,
            isPremium: true,
            _count: {
              select: {
                forumPosts: true,
                forumComments: true
              }
            }
          }
        },
        category: true,
        tags: {
          include: {
            tag: true
          }
        },
        comments: {
          where: { parentId: null },
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                avatar: true,
                username: true,
                isPremium: true
              }
            },
            replies: {
              orderBy: { createdAt: 'asc' },
              include: {
                author: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true,
                    username: true
                  }
                }
              }
            },
            reactions: userId ? {
              where: { userId },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    username: true
                  }
                }
              }
            } : false
          }
        },
        reactions: userId ? {
          where: { userId }
        } : false,
        _count: {
          select: {
            comments: true,
            reactions: true,
            views: true
          }
        }
      }
    })

    if (!post) return null

    // Увеличиваем просмотры
    await prisma.forumPost.update({
      where: { id: postId },
      data: { viewsCount: { increment: 1 } }
    })

    // Добавляем просмотр от пользователя (если авторизован)
    if (userId) {
      await prisma.forumPostView.create({
        data: {
          postId,
          userId
        }
      })
    }

    // Получаем реакции с группировкой
    const reactionsGrouped = await prisma.forumReaction.groupBy({
      by: ['emoji'],
      where: { postId },
      _count: {
        emoji: true
      },
      orderBy: {
        _count: {
          emoji: 'desc'
        }
      }
    })
    
    const reactionsData = reactionsGrouped.map(r => ({
      emoji: r.emoji,
      count: r._count.emoji
    }))

    return {
      ...post,
      reactionsData // Добавляем сгруппированные реакции
    }
  } catch (error) {
    console.error('Error fetching forum post:', error)
    return null
  }
}

// 5. Добавление комментария
export async function addForumComment(data: {
    postId: number
    content: string
    parentId?: number
  }) {
    try {
      const session = await getCurrentUser()
      if (!session?.id) {
        return { error: 'Не авторизован' }
      }
  
      const comment = await prisma.forumComment.create({
        data: {
          postId: data.postId,
          content: extractLinks(data.content),
          parentId: data.parentId,
          authorId: Number(session.id)
        }
      })

      notifyPostSubscribers(data.postId, comment.id).catch(console.error)
  
      revalidatePath(`/forum/post/${data.postId}`)
      return { success: true, comment }
    } catch (error) {
      console.error('Error adding comment:', error)
      return { error: 'Ошибка при добавлении комментария' }
    }
  }

// 6. Переключение реакции
export async function toggleForumReaction(data: {
  emoji: string
  postId?: number
  commentId?: number
}) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: 'Не авторизован' }
    }

    const userId = Number(session.user.id)

    // 1. Находим существующую реакцию пользователя на этот пост/комментарий
    const existingUserReaction = await prisma.forumReaction.findFirst({
      where: {
        userId,
        postId: data.postId,
        commentId: data.commentId,
      }
    })

    // 2. Если у пользователя уже есть реакция
    if (existingUserReaction) {
      // 2a. Если пользователь нажимает на ту же реакцию - удаляем её
      if (existingUserReaction.emoji === data.emoji) {
        await prisma.forumReaction.delete({ 
          where: { id: existingUserReaction.id } 
        })
        return { success: true, action: 'removed', previousEmoji: existingUserReaction.emoji }
      } 
      // 2b. Если пользователь нажимает на другую реакцию - заменяем
      else {
        // Удаляем старую реакцию
        await prisma.forumReaction.delete({ 
          where: { id: existingUserReaction.id } 
        })
        
        // Создаем новую реакцию
        await prisma.forumReaction.create({
          data: {
            userId,
            emoji: data.emoji,
            postId: data.postId,
            commentId: data.commentId
          }
        })
        
        return { 
          success: true, 
          action: 'replaced', 
          previousEmoji: existingUserReaction.emoji,
          newEmoji: data.emoji 
        }
      }
    } 
    // 3. Если у пользователя нет реакции - создаем новую
    else {
      await prisma.forumReaction.create({
        data: {
          userId,
          emoji: data.emoji,
          postId: data.postId,
          commentId: data.commentId
        }
      })
      
      return { success: true, action: 'added', newEmoji: data.emoji }
    }

  } catch (error) {
    console.error('Error toggling reaction:', error)
    return { error: 'Ошибка при установке реакции' }
  }
}

// 7. Подписка/отписка от поста
export async function togglePostSubscription(postId: number): Promise<SubscriptionResponse> {
    try {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return { error: 'Не авторизован' }
      }
  
      const userId = Number(session.user.id)
  
      // Проверяем, что пользователь не пытается подписаться на свой пост
      const post = await prisma.forumPost.findUnique({
        where: { id: postId },
        select: { authorId: true }
      })
  
      if (!post) {
        return { error: 'Пост не найден' }
      }
  
      const existing = await prisma.forumPostSubscription.findUnique({
        where: {
          userId_postId: {
            userId,
            postId
          }
        }
      })
  
      if (existing) {
        // Отписываемся
        await prisma.forumPostSubscription.delete({
          where: { id: existing.id }
        })
        return { success: true, subscribed: false }
      } else {
        // Подписываемся
        await prisma.forumPostSubscription.create({
          data: {
            userId,
            postId
          }
        })
        return { success: true, subscribed: true }
      }
    } catch (error) {
      console.error('Error toggling subscription:', error)
      return { error: 'Ошибка подписки' }
    }
  }

// 8. Поиск постов
export async function searchForumPosts(query: string, page: number = 1, limit: number = 20) {
  try {
    const skip = (page - 1) * limit
    
    const [posts, total] = await Promise.all([
      prisma.forumPost.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } }
          ]
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatar: true,
              username: true
            }
          },
          category: true,
          _count: {
            select: { 
              comments: true,
              reactions: true
            }
          }
        }
      }),
      prisma.forumPost.count({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } }
          ]
        }
      })
    ])

    return {
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  } catch (error) {
    console.error('Error searching posts:', error)
    return { posts: [], pagination: { page: 1, limit, total: 0, pages: 0 } }
  }
}

// 9. Получение последних постов
export async function getRecentPosts(limit: number = 10) {
  try {
    return await prisma.forumPost.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        content: true,
        location: true,
        images: true,
        viewsCount: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            name: true,
            surname: true,
            username: true,
            avatar: true,
            isPremium: true
          }
        },
        category: {
          select: {
            id: true,
            title: true,
            slug: true
          }
        },
        _count: {
          select: {
            comments: true,
            reactions: true
          }
        }
      }
    })
  } catch (error) {
    console.error('Error fetching recent posts:', error)
    return []
  }
}

// 10. Получение популярных постов
export async function getPopularPosts(limit: number = 10) {
  try {
    return await prisma.forumPost.findMany({
      orderBy: [
        { viewsCount: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit,
      select: {
        id: true,
        title: true,
        content: true,
        location: true,
        images: true,
        viewsCount: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            name: true,
            surname: true,
            username: true,
            avatar: true,
            isPremium: true
          }
        },
        category: {
          select: {
            id: true,
            title: true,
            slug: true
          }
        },
        _count: {
          select: {
            comments: true,
            reactions: true
          }
        }
      }
    })
  } catch (error) {
    console.error('Error fetching popular posts:', error)
    return []
  }
}

// 11. Статистика форума
export async function getForumStats() {
  try {
    const [totalPosts, totalComments, totalUsers, recentActivity] = await Promise.all([
      prisma.forumPost.count(),
      prisma.forumComment.count(),
      prisma.user.count({
        where: {
          OR: [
            { forumPosts: { some: {} } },
            { forumComments: { some: {} } }
          ]
        }
      }),
      prisma.forumPost.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          createdAt: true,
          author: {
            select: {
              name: true,
              username: true
            }
          }
        }
      })
    ])

    return {
      totalPosts,
      totalComments,
      totalUsers,
      recentActivity
    }
  } catch (error) {
    console.error('Error fetching forum stats:', error)
    return null
  }
}

// 12. Получение пользователя по username
export async function getUserByUsername(username: string): Promise<User | null> {
  if (!username) return null

  try {
    const userData = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        name: true,
        surname: true,
        bio: true,
        email: true,
        phone: true,
        isPremium: true,
        avatar: true,
        coins: true,
        username: true,
        place: true,
        password: true,
        notificationMode: true,
        twoFactorEnabled: true,
        lastSeen: true,
        isOnline: true,
        twoFactorCode: true,
        twoFactorExpires: true,
        createdAt: true,
        updatedAt: true,
        
        _count: {
          select: {
            forumPosts: true,
            forumComments: true,
            forumFollowing: true,
            forumFollowers: true
          }
        },

        forumPosts: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            title: true,
            content: true,
            createdAt: true,
            updatedAt: true,
            authorId: true,
            categoryId: true,
            location: true,
            images: true,
            isPinned: true,
            isLocked: true,
            viewsCount: true,
            category: {
              select: {
                title: true,
                slug: true
              }
            },
            _count: {
              select: {
                comments: true,
                reactions: true
              }
            }
          }
        },

        forumComments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            content: true,
            createdAt: true,
            updatedAt: true,
            authorId: true,
            postId: true,
            parentId: true,
            isEdited: true,
            post: {
              select: {
                id: true,
                title: true
              }
            }
          }
        }
      }
    })
    
    return userData as unknown as User
  } catch (error) {
    console.error('Error fetching user:', error)
    return null
  }
}

// 13. Подписка/отписка от пользователя
export async function toggleUserFollow(followingId: number) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: 'Не авторизован' }
    }

    const followerId = Number(session.user.id)

    if (followerId === followingId) {
      return { error: 'Нельзя подписаться на себя' }
    }

    const existing = await prisma.forumUserFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId
        }
      }
    })

    if (existing) {
      await prisma.forumUserFollow.delete({
        where: { id: existing.id }
      })
      return { success: true, following: false }
    } else {
      await prisma.forumUserFollow.create({
        data: {
          followerId,
          followingId
        }
      })
      return { success: true, following: true }
    }
  } catch (error) {
    console.error('Error toggling user follow:', error)
    return { error: 'Ошибка подписки' }
  }
}

// 14. Получение тегов
export async function getForumTags() {
  try {
    return await prisma.forumTag.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { posts: true }
        }
      }
    })
  } catch (error) {
    console.error('Error fetching forum tags:', error)
    return []
  }
}

// 15. Добавление тега к посту
export async function addTagToPost(postId: number, tagName: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: 'Не авторизован' }
    }

    // Проверяем, существует ли тег
    let tag = await prisma.forumTag.findFirst({
      where: { 
        name: { 
          equals: tagName, 
          mode: 'insensitive' 
        } 
      }
    })

    // Если тега нет, создаем его
    if (!tag) {
      const slug = tagName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
      
      tag = await prisma.forumTag.create({
        data: {
          name: tagName,
          slug
        }
      })
    }

    // Проверяем, не добавлен ли уже тег
    const existing = await prisma.forumPostTag.findUnique({
      where: {
        postId_tagId: {
          postId,
          tagId: tag.id
        }
      }
    })

    if (existing) {
      return { success: true, message: 'Тег уже добавлен' }
    }

    // Добавляем тег к посту
    await prisma.forumPostTag.create({
      data: {
        postId,
        tagId: tag.id
      }
    })

    revalidatePath(`/forum/post/${postId}`)
    return { success: true }
  } catch (error) {
    console.error('Error adding tag to post:', error)
    return { error: 'Ошибка при добавлении тега' }
  }
}

// 16. Удаление тега из поста
export async function removeTagFromPost(postId: number, tagId: number) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: 'Не авторизован' }
    }

    await prisma.forumPostTag.delete({
      where: {
        postId_tagId: {
          postId,
          tagId
        }
      }
    })

    revalidatePath(`/forum/post/${postId}`)
    return { success: true }
  } catch (error) {
    console.error('Error removing tag from post:', error)
    return { error: 'Ошибка при удалении тега' }
  }
}

// 17. Редактирование поста
export async function updateForumPost(postId: number, formData: FormData) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: 'Не авторизован' }
    }

    const userId = Number(session.user.id)
    
    // Проверяем права доступа
    const post = await prisma.forumPost.findUnique({
      where: { id: postId },
      select: { authorId: true }
    })

    if (!post) {
      return { error: 'Пост не найден' }
    }

    if (post.authorId !== userId) {
      return { error: 'Нет прав для редактирования' }
    }

    const title = String(formData.get('title') || '').trim()
    const content = String(formData.get('content') || '').trim()
    const location = String(formData.get('location') || '').trim()

    // Обновляем пост
    await prisma.forumPost.update({
      where: { id: postId },
      data: {
        title: title || undefined,
        content: extractLinks(content),
        location: location || undefined,
        updatedAt: new Date()
      }
    })

    revalidatePath(`/forum/post/${postId}`)
    return { success: true }
  } catch (error) {
    console.error('Error updating post:', error)
    return { error: 'Ошибка при редактировании поста' }
  }
}

// 18. Удаление поста
export async function deleteForumPost(postId: number) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: 'Не авторизован' }
    }

    const userId = Number(session.user.id)
    
    // Проверяем права доступа
    const post = await prisma.forumPost.findUnique({
      where: { id: postId },
      select: { authorId: true }
    })

    if (!post) {
      return { error: 'Пост не найден' }
    }

    if (post.authorId !== userId) {
      return { error: 'Нет прав для удаления' }
    }

    // Удаляем пост
    await prisma.forumPost.delete({
      where: { id: postId }
    })

    revalidatePath('/forum')
    return { success: true }
  } catch (error) {
    console.error('Error deleting post:', error)
    return { error: 'Ошибка при удалении поста' }
  }
}

// 19. Получение похожих постов
export async function getSimilarPosts(postId: number, limit: number = 5) {
  try {
    const post = await prisma.forumPost.findUnique({
      where: { id: postId },
      include: {
        tags: {
          include: {
            tag: true
          }
        },
        category: true
      }
    })

    if (!post) return []

    // Ищем посты в той же категории
    const similarPosts = await prisma.forumPost.findMany({
      where: {
        id: { not: postId },
        OR: [
          { categoryId: post.categoryId },
          {
            tags: {
              some: {
                tagId: {
                  in: post.tags.map(t => t.tagId)
                }
              }
            }
          }
        ]
      },
      take: limit,
      orderBy: { viewsCount: 'desc' },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true
          }
        },
        category: true,
        _count: {
          select: { comments: true }
        }
      }
    })

    return similarPosts
  } catch (error) {
    console.error('Error fetching similar posts:', error)
    return []
  }
}

// 20. Получение активности пользователя
export async function getUserActivity(userId: number, limit: number = 10) {
  try {
    const [posts, comments, reactions] = await Promise.all([
      prisma.forumPost.findMany({
        where: { authorId: userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          title: true,
          createdAt: true,
          category: {
            select: { title: true }
          }
        }
      }),
      prisma.forumComment.findMany({
        where: { authorId: userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          content: true,
          createdAt: true,
          post: {
            select: {
              id: true,
              title: true
            }
          }
        }
      }),
      prisma.forumReaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          emoji: true,
          createdAt: true,
          post: {
            select: {
              id: true,
              title: true
            }
          },
          comment: {
            select: {
              id: true,
              content: true
            }
          }
        }
      })
    ])

    return { posts, comments, reactions }
  } catch (error) {
    console.error('Error fetching user activity:', error)
    return { posts: [], comments: [], reactions: [] }
  }
}

// 21. Получение топовых авторов
export async function getTopAuthors(limit: number = 10) {
  try {
    const topAuthors = await prisma.user.findMany({
      where: {
        forumPosts: {
          some: {}
        }
      },
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
        isPremium: true,
        _count: {
          select: {
            forumPosts: true,
            forumComments: true
          }
        }
      },
      orderBy: {
        forumPosts: {
          _count: 'desc'
        }
      },
      take: limit
    })

    return topAuthors
  } catch (error) {
    console.error('Error fetching top authors:', error)
    return []
  }
}

// 22. Получение статистики поста
export async function getPostStats(postId: number) {
  try {
    const [views, comments, reactions] = await Promise.all([
      prisma.forumPostView.count({ where: { postId } }),
      prisma.forumComment.count({ where: { postId } }),
      prisma.forumReaction.count({ where: { postId } })
    ])

    return {
      views,
      comments,
      reactions,
      engagementRate: comments > 0 ? (comments / views * 100).toFixed(1) : '0'
    }
  } catch (error) {
    console.error('Error fetching post stats:', error)
    return null
  }
}

// 23. Закрепление/открепление поста
export async function togglePinPost(postId: number) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: 'Не авторизован' }
    }

    const userId = Number(session.user.id)
    
    // Проверяем права доступа (только админы или авторы)
    const post = await prisma.forumPost.findUnique({
      where: { id: postId },
      select: { authorId: true, isPinned: true }
    })

    if (!post) {
      return { error: 'Пост не найден' }
    }

    // Обновляем статус закрепления
    await prisma.forumPost.update({
      where: { id: postId },
      data: { isPinned: !post.isPinned }
    })

    revalidatePath('/forum')
    revalidatePath(`/forum/post/${postId}`)
    
    return { success: true, isPinned: !post.isPinned }
  } catch (error) {
    console.error('Error toggling pin:', error)
    return { error: 'Ошибка при закреплении поста' }
  }
}

// 24. Получение постов пользователя
export async function getUserPosts(userId: number, page: number = 1, limit: number = 20) {
  try {
    const skip = (page - 1) * limit
    
    const [posts, total] = await Promise.all([
      prisma.forumPost.findMany({
        where: { authorId: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          category: true,
          _count: {
            select: {
              comments: true,
              reactions: true
            }
          }
        }
      }),
      prisma.forumPost.count({
        where: { authorId: userId }
      })
    ])

    return {
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  } catch (error) {
    console.error('Error fetching user posts:', error)
    return { posts: [], pagination: { page: 1, limit, total: 0, pages: 0 } }
  }
}

export async function getForumReactionsByPost(postId: number) {
    try {
      const reactions = await prisma.forumReaction.groupBy({
        by: ['emoji'],
        where: { postId },
        _count: {
          emoji: true
        }
      })
      
      return reactions.map(r => ({
        emoji: r.emoji,
        count: r._count.emoji
      }))
    } catch (error) {
      console.error('Error getting reactions by post:', error)
      return []
    }
  }

  export async function getPostReactions(postId: number) {
    try {
      const reactions = await prisma.forumReaction.groupBy({
        by: ['emoji'],
        where: { postId },
        _count: {
          emoji: true
        }
      })
      
      return reactions.map(r => ({
        emoji: r.emoji,
        count: r._count.emoji
      }))
    } catch (error) {
      console.error('Error getting post reactions:', error)
      return []
    }
  }

  export async function getUserReaction(postId: number) {
    try {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return null
      }
  
      const userId = Number(session.user.id)
      
      const reaction = await prisma.forumReaction.findFirst({
        where: {
          userId,
          postId
        },
        select: {
          emoji: true
        }
      })
  
      return reaction
    } catch (error) {
      console.error('Error getting user reaction:', error)
      return null
    }
  }
  
  // Функция для получения всех реакций на пост с группировкой
  export async function getPostReactionsGrouped(postId: number) {
    try {
      const reactions = await prisma.forumReaction.groupBy({
        by: ['emoji'],
        where: { postId },
        _count: {
          emoji: true
        },
        orderBy: {
          _count: {
            emoji: 'desc'
          }
        }
      })
      
      return reactions.map(r => ({
        emoji: r.emoji,
        count: r._count.emoji
      }))
    } catch (error) {
      console.error('Error getting post reactions:', error)
      return []
    }
  }


  export async function toggleUserSubscription(authorId: number) {
    try {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return { error: 'Не авторизован' }
      }
  
      const followerId = Number(session.user.id)
  
      // Проверяем, что пользователь не пытается подписаться на себя
      if (followerId === authorId) {
        return { error: 'Нельзя подписаться на себя' }
      }
  
      const existing = await prisma.forumUserFollow.findUnique({
        where: {
          followerId_followingId: {
            followerId,
            followingId: authorId
          }
        }
      })
  
      if (existing) {
        // Отписываемся
        await prisma.forumUserFollow.delete({
          where: { id: existing.id }
        })
        
        return { success: true, subscribed: false }
      } else {
        // Подписываемся
        await prisma.forumUserFollow.create({
          data: {
            followerId,
            followingId: authorId
          }
        })
        
        // Отправляем уведомление автору о новом подписчике
        await sendNewAuthorSubscriberNotification(followerId, authorId).catch(console.error)
        
        return { success: true, subscribed: true }
      }
    } catch (error) {
      console.error('Error toggling user subscription:', error)
      return { error: 'Ошибка подписки' }
    }
  }





  export async function checkPostSubscription(postId: number): Promise<PostSubscriptionCheck> {
    try {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return { subscribed: false }
      }
  
      const userId = Number(session.user.id)
      
      const subscription = await prisma.forumPostSubscription.findUnique({
        where: {
          userId_postId: {
            userId,
            postId
          }
        }
      })
  
      return { subscribed: !!subscription }
    } catch (error) {
      console.error('Error checking subscription:', error)
      return { subscribed: false }
    }
  }

  export async function sendNewAuthorSubscriberNotification(followerId: number, followingId: number) {
    try {
      const [follower, following] = await Promise.all([
        prisma.user.findUnique({
          where: { id: followerId },
          select: {
            name: true,
            username: true
          }
        }),
        prisma.user.findUnique({
          where: { id: followingId },
          select: {
            email: true,
            name: true,
            username: true
          }
        })
      ])
  
      if (!follower || !following?.email) {
        return { error: 'Пользователи не найдены' }
      }
  
      const userName = follower.name || follower.username || 'Новый подписчик'
      const authorName = following.name || following.username || 'Автор'
  
      return sendEmailNotification({
        toEmail: following.email,
        subject: `👤 ${userName} подписался на вас`,
        type: 'user_subscription',
        authorName: authorName,
        userName: userName
      })
    } catch (error) {
      console.error('Error sending new author subscriber notification:', error)
      return { error: 'Ошибка отправки уведомления о новом подписчике' }
    }
  }
  
  // Функция для отправки уведомления автору об отписке
  export async function sendUserUnsubscriptionNotification(followerId: number, followingId: number) {
    try {
      const [follower, following] = await Promise.all([
        prisma.user.findUnique({
          where: { id: followerId },
          select: {
            name: true,
            username: true
          }
        }),
        prisma.user.findUnique({
          where: { id: followingId },
          select: {
            email: true,
            name: true,
            username: true
          }
        })
      ])
  
      if (!follower || !following?.email) {
        return { error: 'Пользователи не найдены' }
      }
  
      const userName = follower.name || follower.username || 'Бывший подписчик'
      const authorName = following.name || following.username || 'Автор'
  
      return sendEmailNotification({
        toEmail: following.email,
        subject: `👤 ${userName} отписался от вас`,
        type: 'user_subscription',
        authorName: authorName,
        userName: userName
      })
    } catch (error) {
      console.error('Error sending user unsubscription notification:', error)
      return { error: 'Ошибка отправки уведомления об отписке' }
    }
  }
  
  // Функция для проверки подписки на автора
  export async function checkUserSubscription(authorId: number) {
    try {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return { subscribed: false }
      }
  
      const userId = Number(session.user.id)
      
      // Проверяем, что пользователь не пытается подписаться на себя
      if (userId === authorId) {
        return { subscribed: false, error: 'Нельзя подписаться на себя' }
      }
  
      const subscription = await prisma.forumUserFollow.findUnique({
        where: {
          followerId_followingId: {
            followerId: userId,
            followingId: authorId
          }
        }
      })
  
      return { subscribed: !!subscription }
    } catch (error) {
      console.error('Error checking user subscription:', error)
      return { subscribed: false }
    }
  }
  
  // Функция для отправки уведомлений на почту
  export async function sendEmailNotification(data: {
    toEmail: string
    subject: string
    type: 'new_comment' | 'new_post' | 'post_subscription' | 'user_subscription'
    postId?: number
    commentId?: number
    authorName?: string
    postTitle?: string
    userName?: string
  }) {
    try {
      const { 
        toEmail, 
        subject, 
        type, 
        postId, 
        authorName, 
        postTitle,
        userName 
      } = data
      
      // Базовый URL приложения
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      
      let htmlContent = ''
      let buttonText = ''
      let buttonUrl = ''
      
      // Генерация HTML контента в зависимости от типа уведомления
      if (type === 'new_comment') {
        buttonText = 'Посмотреть комментарий'
        buttonUrl = `${appUrl}/forum/post/${postId}#comment-${data.commentId}`
        
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h2 style="color: #2563eb; margin-bottom: 20px;">💬 Новый комментарий</h2>
              
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                <p style="margin: 0; color: #4b5563; font-size: 16px;">
                  У поста <strong>"${postTitle}"</strong> появился новый комментарий
                  ${authorName ? ` от <strong>${authorName}</strong>` : ''}
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${buttonUrl}" 
                   style="background-color: #2563eb; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 6px; font-weight: bold;
                          display: inline-block; font-size: 16px;">
                  ${buttonText}
                </a>
              </div>
              
              <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; 
                         font-size: 14px; color: #6b7280;">
                <p style="margin: 5px 0;">📌 Это автоматическое уведомление о новом комментарии к посту, на который вы подписаны.</p>
                <p style="margin: 5px 0;">🔕 Чтобы отписаться от уведомлений, перейдите в настройки поста.</p>
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #9ca3af;">
              <p>© ${new Date().getFullYear()} Conversies Forum. Все права защищены.</p>
            </div>
          </div>
        `
      } 
      else if (type === 'new_post') {
        buttonText = 'Читать пост'
        buttonUrl = `${appUrl}/forum/post/${postId}`
        
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h2 style="color: #059669; margin-bottom: 20px;">📝 Новый пост</h2>
              
              <div style="margin-bottom: 25px;">
                <p style="color: #4b5563; font-size: 16px; margin-bottom: 10px;">
                  Автор <strong>${authorName}</strong> опубликовал новый пост:
                </p>
                <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; 
                           padding: 15px; border-radius: 4px;">
                  <h3 style="color: #065f46; margin: 0 0 10px 0;">${postTitle}</h3>
                </div>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${buttonUrl}" 
                   style="background-color: #059669; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 6px; font-weight: bold;
                          display: inline-block; font-size: 16px;">
                  ${buttonText}
                </a>
              </div>
              
              <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; 
                         font-size: 14px; color: #6b7280;">
                <p style="margin: 5px 0;">📌 Это автоматическое уведомление о новом посте от автора, на которого вы подписаны.</p>
                <p style="margin: 5px 0;">🔕 Чтобы отписаться от автора, перейдите в его профиль.</p>
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #9ca3af;">
              <p>© ${new Date().getFullYear()} Conversies Forum. Все права защищены.</p>
            </div>
          </div>
        `
      }
      else if (type === 'post_subscription') {
        buttonText = 'Перейти к посту'
        buttonUrl = `${appUrl}/forum/post/${postId}`
        
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h2 style="color: #7c3aed; margin-bottom: 20px;">✅ Подписка оформлена</h2>
              
              <div style="text-align: center; margin: 30px 0;">
                <div style="background-color: #f5f3ff; border-radius: 50%; width: 80px; height: 80px; 
                           display: inline-flex; align-items: center; justify-content: center; 
                           margin-bottom: 20px;">
                  <span style="font-size: 36px;">🔔</span>
                </div>
                <h3 style="color: #5b21b6; margin-bottom: 10px;">Вы подписались на пост!</h3>
                <p style="color: #4b5563; font-size: 16px;">
                  Теперь вы будете получать уведомления о новых комментариях к посту:<br>
                  <strong>"${postTitle}"</strong>
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${buttonUrl}" 
                   style="background-color: #7c3aed; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 6px; font-weight: bold;
                          display: inline-block; font-size: 16px;">
                  ${buttonText}
                </a>
              </div>
              
              <div style="background-color: #fef3c7; border-radius: 8px; padding: 15px; margin-top: 25px;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                  💡 <strong>Что вы будете получать:</strong><br>
                  • Уведомления о новых комментариях<br>
                  • Уведомления о важных обновлениях поста
                </p>
              </div>
              
              <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; 
                         font-size: 14px; color: #6b7280;">
                <p style="margin: 5px 0;">🔕 Чтобы отписаться от уведомлений, перейдите на страницу поста и нажмите "Отписаться".</p>
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #9ca3af;">
              <p>© ${new Date().getFullYear()} Conversies Forum. Все права защищены.</p>
            </div>
          </div>
        `
      }
      else if (type === 'user_subscription') {
        buttonText = 'Перейти к профилю'
        buttonUrl = `${appUrl}/profile/${data.authorName || ''}`
        
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h2 style="color: #dc2626; margin-bottom: 20px;">👥 Подписка на автора</h2>
              
              <div style="text-align: center; margin: 30px 0;">
                <div style="background-color: #fee2e2; border-radius: 50%; width: 80px; height: 80px; 
                           display: inline-flex; align-items: center; justify-content: center; 
                           margin-bottom: 20px;">
                  <span style="font-size: 36px;">👤</span>
                </div>
                <h3 style="color: #991b1b; margin-bottom: 10px;">Вы подписались на автора!</h3>
                <p style="color: #4b5563; font-size: 16px;">
                  Теперь вы будете получать уведомления о новых постах от:<br>
                  <strong>${authorName}</strong>
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${buttonUrl}" 
                   style="background-color: #dc2626; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 6px; font-weight: bold;
                          display: inline-block; font-size: 16px;">
                  ${buttonText}
                </a>
              </div>
              
              <div style="background-color: #f0f9ff; border-radius: 8px; padding: 15px; margin-top: 25px;">
                <p style="margin: 0; color: #0369a1; font-size: 14px;">
                  📝 <strong>Что вы будете получать:</strong><br>
                  • Уведомления о новых постах<br>
                  • Информацию о важных обновлениях от автора
                </p>
              </div>
              
              <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px; 
                         font-size: 14px; color: #6b7280;">
                <p style="margin: 5px 0;">🔕 Чтобы отписаться от автора, перейдите в его профиль и нажмите "Отписаться".</p>
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #9ca3af;">
              <p>© ${new Date().getFullYear()} Conversies Forum. Все права защищены.</p>
            </div>
          </div>
        `
      }
  
      // Отправляем email через Nodemailer
      const emailResult = await sendEmail(toEmail, subject, htmlContent)
      
      if (emailResult.error) {
        console.error('Failed to send notification email:', emailResult.error)
        return { error: 'Ошибка отправки уведомления' }
      }
  
      console.log('Email notification sent successfully to:', toEmail, {
        type,
        postId,
        subject
      })
  
      return { success: true, messageId: emailResult.result?.messageId }
    } catch (error) {
      console.error('Error sending email notification:', error)
      return { error: 'Ошибка отправки уведомления' }
    }
  }
  
  // Функция для отправки уведомлений при новом комментарии
  export async function notifyPostSubscribers(postId: number, commentId: number) {
    try {
      // Получаем информацию о посте и комментарии
      const [post, comment] = await Promise.all([
        prisma.forumPost.findUnique({
          where: { id: postId },
          include: {
            author: {
              select: {
                email: true,
                name: true,
                username: true
              }
            }
          }
        }),
        prisma.forumComment.findUnique({
          where: { id: commentId },
          include: {
            author: {
              select: {
                name: true,
                username: true
              }
            }
          }
        })
      ])
  
      if (!post || !comment) {
        return { error: 'Пост или комментарий не найдены' }
      }
  
      // Получаем всех подписчиков поста (кроме автора комментария)
      const subscriptions = await prisma.forumPostSubscription.findMany({
        where: {
          postId,
          user: {
            id: { not: comment.authorId }
          }
        },
        include: {
          user: {
            select: {
              email: true,
              notificationMode: true,
              name: true,
              username: true
            }
          }
        }
      })
  
      console.log(`Найдено ${subscriptions.length} подписчиков для уведомления`)
  
      // Отправляем уведомления всем подписчикам
      const notifications = subscriptions.map(async (subscription) => {
        // Проверяем настройки уведомлений пользователя
        if (subscription.user.notificationMode === 'none') {
          console.log(`Пропускаем уведомление для ${subscription.user.email} - уведомления отключены`)
          return
        }
  
        const userName = subscription.user.name || subscription.user.username || 'Подписчик'
        const commentAuthorName = comment.author.name || comment.author.username || 'Пользователь'
  
        console.log(`Отправляем уведомление для ${subscription.user.email} о новом комментарии`)
  
        return sendEmailNotification({
          toEmail: subscription.user.email || '',
          subject: `💬 Новый комментарий к посту "${post.title}"`,
          type: 'new_comment',
          postId: post.id,
          commentId: comment.id,
          postTitle: post.title,
          authorName: commentAuthorName,
          userName: userName
        }).catch(error => {
          console.error(`Ошибка отправки уведомления для ${subscription.user.email}:`, error)
        })
      })
  
      await Promise.all(notifications)
  
      console.log(`Уведомления отправлены ${subscriptions.length} подписчикам`)
  
      return { success: true, notified: subscriptions.length }
    } catch (error) {
      console.error('Error notifying post subscribers:', error)
      return { error: 'Ошибка отправки уведомлений' }
    }
  }
  
  // Функция для отправки уведомлений при новом посте
  export async function notifyAuthorSubscribers(authorId: number, postId: number) {
    try {
      // Получаем информацию о авторе и посте
      const [author, post] = await Promise.all([
        prisma.user.findUnique({
          where: { id: authorId },
          select: {
            name: true,
            username: true,
            email: true
          }
        }),
        prisma.forumPost.findUnique({
          where: { id: postId },
          select: {
            title: true,
            content: true
          }
        })
      ])
  
      if (!author || !post) {
        return { error: 'Автор или пост не найдены' }
      }
  
      // Получаем всех подписчиков автора
      const followers = await prisma.forumUserFollow.findMany({
        where: {
          followingId: authorId
        },
        include: {
          follower: {
            select: {
              email: true,
              notificationMode: true,
              name: true,
              username: true
            }
          }
        }
      })
  
      console.log(`Найдено ${followers.length} подписчиков автора для уведомления`)
  
      // Отправляем уведомления всем подписчикам
      const notifications = followers.map(async (follow) => {
        // Проверяем настройки уведомлений пользователя
        if (follow.follower.notificationMode === 'none') {
          console.log(`Пропускаем уведомление для ${follow.follower.email} - уведомления отключены`)
          return
        }
  
        const userName = follow.follower.name || follow.follower.username || 'Подписчик'
        const authorName = author.name || author.username || 'Автор'
  
        console.log(`Отправляем уведомление для ${follow.follower.email} о новом посте`)
  
        return sendEmailNotification({
          toEmail: follow.follower.email || '',
          subject: `📝 Новый пост от ${authorName}`,
          type: 'new_post',
          postId: postId,
          postTitle: post.title,
          authorName: authorName,
          userName: userName
        }).catch(error => {
          console.error(`Ошибка отправки уведомления для ${follow.follower.email}:`, error)
        })
      })
  
      await Promise.all(notifications)
  
      console.log(`Уведомления отправлены ${followers.length} подписчикам автора`)
  
      return { success: true, notified: followers.length }
    } catch (error) {
      console.error('Error notifying author subscribers:', error)
      return { error: 'Ошибка отправки уведомлений' }
    }
  }

  export async function getForumPostsByCategory(categoryId: number, page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit
      
      const [posts, total] = await Promise.all([
        prisma.forumPost.findMany({
          where: { categoryId },
          orderBy: [
            { isPinned: 'desc' },
            { createdAt: 'desc' }
          ],
          skip,
          take: limit,
          include: {
            author: {
              select: {
                id: true,
                name: true,
                avatar: true,
                username: true,
                isPremium: true
              }
            },
            category: true,
            tags: {  // Добавляем теги
              include: {
                tag: true
              }
            },
            _count: {
              select: { 
                comments: true,
                reactions: true
              }
            }
          }
        }),
        prisma.forumPost.count({
          where: { categoryId }
        })
      ])
  
      return {
        posts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    } catch (error) {
      console.error('Error fetching posts by category:', error)
      return { posts: [], pagination: { page: 1, limit, total: 0, pages: 0 } }
    }
  }



//   export async function notifyAuthorSubscribers(authorId: number, postId: number) {
//     try {
//       // Получаем информацию о авторе и посте
//       const [author, post] = await Promise.all([
//         prisma.user.findUnique({
//           where: { id: authorId },
//           select: {
//             name: true,
//             username: true,
//             email: true
//           }
//         }),
//         prisma.forumPost.findUnique({
//           where: { id: postId },
//           select: {
//             title: true,
//             content: true
//           }
//         })
//       ])
  
//       if (!author || !post) {
//         return { error: 'Автор или пост не найдены' }
//       }
  
//       // Получаем всех подписчиков автора
//       const followers = await prisma.forumUserFollow.findMany({
//         where: {
//           followingId: authorId
//         },
//         include: {
//           follower: {
//             select: {
//               email: true,
//               notificationMode: true,
//               name: true,
//               username: true
//             }
//           }
//         }
//       })
  
//       // Отправляем уведомления всем подписчикам
//       const notifications = followers.map(async (follow) => {
//         // Проверяем настройки уведомлений пользователя
//         if (follow.follower.notificationMode === 'none') {
//           return
//         }
  
//         const userName = follow.follower.name || follow.follower.username || 'Подписчик'
//         const authorName = author.name || author.username || 'Автор'
  
//         return sendEmailNotification({
//           toEmail: follow.follower.email || '',
//           subject: `📝 Новый пост от ${authorName}`,
//           type: 'new_post',
//           postId: postId,
//           postTitle: post.title,
//           authorName: authorName,
//           userName: userName
//         })
//       })
  
//       await Promise.all(notifications)
  
//       return { success: true, notified: followers.length }
//     } catch (error) {
//       console.error('Error notifying author subscribers:', error)
//       return { error: 'Ошибка отправки уведомлений' }
//     }
//   }
  
//   // Функция для отправки уведомления о успешной подписке на пост
//   export async function sendPostSubscriptionConfirmation(userId: number, postId: number) {
//     try {
//       const [user, post] = await Promise.all([
//         prisma.user.findUnique({
//           where: { id: userId },
//           select: {
//             email: true,
//             name: true,
//             username: true
//           }
//         }),
//         prisma.forumPost.findUnique({
//           where: { id: postId },
//           select: {
//             title: true,
//             author: {
//               select: {
//                 name: true,
//                 username: true
//               }
//             }
//           }
//         })
//       ])
  
//       if (!user?.email || !post) {
//         return { error: 'Пользователь или пост не найдены' }
//       }
  
//       const userName = user.name || user.username || 'Пользователь'
//       const authorName = post.author.name || post.author.username || 'Автор'
  
//       return sendEmailNotification({
//         toEmail: user.email,
//         subject: `✅ Вы подписались на пост "${post.title}"`,
//         type: 'post_subscription',
//         postId: postId,
//         postTitle: post.title,
//         authorName: authorName,
//         userName: userName
//       })
//     } catch (error) {
//       console.error('Error sending subscription confirmation:', error)
//       return { error: 'Ошибка отправки подтверждения подписки' }
//     }
//   }
  
//   // Функция для отправки уведомления о успешной подписке на автора
//   export async function sendUserSubscriptionConfirmation(followerId: number, followingId: number) {
//     try {
//       const [follower, following] = await Promise.all([
//         prisma.user.findUnique({
//           where: { id: followerId },
//           select: {
//             email: true,
//             name: true,
//             username: true
//           }
//         }),
//         prisma.user.findUnique({
//           where: { id: followingId },
//           select: {
//             name: true,
//             username: true
//           }
//         })
//       ])
  
//       if (!follower?.email || !following) {
//         return { error: 'Пользователи не найдены' }
//       }
  
//       const userName = follower.name || follower.username || 'Пользователь'
//       const authorName = following.name || following.username || 'Автор'
  
//       return sendEmailNotification({
//         toEmail: follower.email,
//         subject: `👥 Вы подписались на ${authorName}`,
//         type: 'user_subscription',
//         authorName: authorName,
//         userName: userName
//       })
//     } catch (error) {
//       console.error('Error sending user subscription confirmation:', error)
//       return { error: 'Ошибка отправки подтверждения подписки' }
//     }
//   }