'use server'

import { prisma } from '@/app/lib/prisma'
import { getCurrentUser } from '@/app/lib/api/user'

export async function getUserContacts() {
    const currentUser = await getCurrentUser()
    if (!currentUser) return []
  
    try {
      const contacts = await prisma.contact.findMany({
        where: {
          ownerId: currentUser.id
        },
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              surname: true,
              email: true,
              phone: true,
              avatar: true,
              isPremium: true
            }
          }
        },
        orderBy: {
          contact: {
            name: 'asc'
          }
        }
      })
  
      // Преобразуем Date в string для клиента
      return contacts.map(contact => ({
        ...contact,
        createdAt: contact.createdAt.toISOString(),
        updatedAt: contact.updatedAt.toISOString(),
        contact: {
          ...contact.contact,
        }
      }))
    } catch (error) {
      console.error('Error fetching contacts:', error)
      return []
    }
  }

  export async function addContact(contactId: number, name?: string, notes?: string) {
    const currentUser = await getCurrentUser()
    if (!currentUser) throw new Error('Не авторизован')
  
    // Защита от добавления самого себя
    if (currentUser.id === contactId) {
      throw new Error('Нельзя добавить самого себя в контакты')
    }
  
    try {
      const contact = await prisma.contact.create({
        data: {
          ownerId: currentUser.id,
          contactId,
          name,
          notes
        },
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              surname: true,
              email: true,
              avatar: true
            }
          }
        }
      })
  
      return contact
    } catch (error) {
      console.error('Error adding contact:', error)
      throw new Error('Ошибка при добавлении в контакты')
    }
  }

export async function removeContact(contactId: number) {
  const currentUser = await getCurrentUser()
  if (!currentUser) throw new Error('Не авторизован')

  try {
    await prisma.contact.delete({
      where: {
        ownerId_contactId: {
          ownerId: currentUser.id,
          contactId
        }
      }
    })

    return { success: true }
  } catch (error) {
    console.error('Error removing contact:', error)
    throw new Error('Ошибка при удалении из контактов')
  }
}

export async function isUserInContacts(contactId: number): Promise<boolean> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return false

  try {
    const contact = await prisma.contact.findUnique({
      where: {
        ownerId_contactId: {
          ownerId: currentUser.id,
          contactId,
        },
      },
    })

    return !!contact
  } catch (error) {
    console.error('Error checking contact:', error)
    return false
  }
}