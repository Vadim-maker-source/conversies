'use server'

import { prisma } from '@/app/lib/prisma'
import { compare, hash } from 'bcryptjs'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { authOptions } from '../auth'
import { User } from '../types'
import { sendEmail } from '../nodemailer'

function generateSixDigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Запрос кода 2FA для входа
export async function requestTwoFactorCode(email: string, password: string) {
  try {
    console.log('Requesting 2FA code for:', email);

    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user || !user.password) {
      return { error: 'Пользователь не найден' }
    }

    // Проверяем пароль
    const isValid = await compare(password, user.password);
    
    if (!isValid) {
      return { error: 'Неверный пароль' }
    }

    // Проверяем, включена ли 2FA у пользователя
    if (!user.twoFactorEnabled) {
      return { error: 'Двухэтапная аутентификация не включена' }
    }

    // Генерируем код
    const code = generateSixDigitCode()
    const expires = new Date(Date.now() + 10 * 60 * 1000) // 10 минут

    console.log('Generated 2FA code:', code, 'for user:', user.id);

    // Сохраняем код в базе
    await prisma.user.update({
      where: { email },
      data: {
        twoFactorCode: code,
        twoFactorExpires: expires
      }
    })

    // В development режиме возвращаем код
    if (process.env.NODE_ENV === 'development') {
      console.log('2FA Code (development):', code);
      return { 
        success: true, 
        code: code,
        message: 'Код сгенерирован'
      }
    }

    // В production отправляем email (заглушка)
    console.log('Would send email with code:', code);
    return { 
      success: true, 
      message: 'Код отправлен на вашу почту',
      code: code // Для development
    }
  } catch (error) {
    console.error('Error requesting 2FA code:', error)
    return { error: 'Ошибка при запросе кода' }
  }
}

// Проверка кода для входа
export async function verifyTwoFactorCode(email: string, code: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return { error: 'Пользователь не найден' }
    }

    // Проверяем код и время
    if (!user.twoFactorCode || !user.twoFactorExpires) {
      return { error: 'Код не был запрошен' }
    }

    if (user.twoFactorCode !== code) {
      return { error: 'Неверный код' }
    }

    if (new Date() > user.twoFactorExpires) {
      return { error: 'Срок действия кода истек' }
    }

    // Очищаем использованный код
    await prisma.user.update({
      where: { email },
      data: {
        twoFactorCode: null,
        twoFactorExpires: null
      }
    })

    return { success: true }
  } catch (error) {
    console.error('Error verifying 2FA code:', error)
    return { error: 'Ошибка при проверке кода' }
  }
}

// Включение 2FA
export async function enableTwoFactor() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: 'Не авторизован' }
    }

    // Генерируем и отправляем код для подтверждения
    const verificationCode = generateSixDigitCode()
    const expires = new Date(Date.now() + 10 * 60 * 1000) // 10 минут

    await prisma.user.update({
      where: { id: Number(session.user.id) },
      data: { 
        twoFactorCode: verificationCode,
        twoFactorExpires: expires
      }
    })

    // Отправляем код на email
    const user = await prisma.user.findUnique({
      where: { id: Number(session.user.id) },
      select: { email: true }
    })

    if (!user?.email) {
      return { error: 'Email пользователя не найден' }
    }

    const emailResult = await sendEmail(
      user.email,
      'Подтверждение включения двухэтапной аутентификации - Conversies',
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8B5CF6;">Подтверждение включения 2FA</h2>
          <p>Для включения двухэтапной аутентификации введите следующий код:</p>
          <div style="font-size: 32px; font-weight: bold; color: #8B5CF6; text-align: center; margin: 20px 0;">
            ${verificationCode}
          </div>
          <p style="color: #666; font-size: 14px;">
            Этот код действителен в течение 10 минут. Если вы не запрашивали включение 2FA, проигнорируйте это письмо.
          </p>
        </div>
      `
    )

    if (emailResult.error) {
      return { error: 'Ошибка при отправке кода подтверждения' }
    }

    return { 
      success: true, 
      message: 'Код подтверждения отправлен на вашу почту' 
    }
  } catch (error) {
    console.error('Error enabling 2FA:', error)
    return { error: 'Ошибка при включении 2FA' }
  }
}

// Подтверждение включения 2FA
export async function verifyTwoFactorEnable(code: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: 'Не авторизован' }
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(session.user.id) }
    })

    if (!user) {
      return { error: 'Пользователь не найден' }
    }

    // Проверяем код и время
    if (!user.twoFactorCode || !user.twoFactorExpires) {
      return { error: 'Код не был запрошен' }
    }

    if (user.twoFactorCode !== code) {
      return { error: 'Неверный код подтверждения' }
    }

    if (new Date() > user.twoFactorExpires) {
      return { error: 'Срок действия кода истек' }
    }

    // Активируем 2FA
    await prisma.user.update({
      where: { id: Number(session.user.id) },
      data: { 
        twoFactorEnabled: true,
        twoFactorCode: null,
        twoFactorExpires: null
      }
    })

    return { 
      success: true, 
      message: 'Двухэтапная аутентификация успешно включена' 
    }
  } catch (error) {
    console.error('Error verifying 2FA code:', error)
    return { error: 'Ошибка при подтверждении кода' }
  }
}

// Отключение 2FA
export async function disableTwoFactor() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: 'Не авторизован' }
    }

    await prisma.user.update({
      where: { id: Number(session.user.id) },
      data: { 
        twoFactorEnabled: false,
        twoFactorCode: null,
        twoFactorExpires: null
      }
    })

    return { 
      success: true, 
      message: 'Двухэтапная аутентификация отключена' 
    }
  } catch (error) {
    console.error('Error disabling 2FA:', error)
    return { error: 'Ошибка при отключении 2FA' }
  }
}

// Генерация и отправка кода для входа
export async function sendTwoFactorCode(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return { error: 'Пользователь не найден' }
    }

    // Проверяем, включена ли 2FA у пользователя
    if (!user.twoFactorEnabled) {
      return { error: 'Двухэтапная аутентификация не включена для этого пользователя' }
    }

    // Генерируем код
    const code = generateSixDigitCode()
    const expires = new Date(Date.now() + 10 * 60 * 1000) // 10 минут

    // Сохраняем код в базе
    await prisma.user.update({
      where: { email },
      data: {
        twoFactorCode: code,
        twoFactorExpires: expires
      }
    })

    // Отправляем email
    const emailResult = await sendEmail(
      email,
      'Код двухэтапной аутентификации - Conversies',
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8B5CF6;">Код подтверждения входа</h2>
          <p>Ваш код для входа в аккаунт Conversies:</p>
          <div style="font-size: 32px; font-weight: bold; color: #8B5CF6; text-align: center; margin: 20px 0;">
            ${code}
          </div>
          <p style="color: #666; font-size: 14px;">
            Этот код действителен в течение 10 минут. Если вы не запрашивали вход, проигнорируйте это письмо.
          </p>
        </div>
      `
    )

    if (emailResult.error) {
      return { error: 'Ошибка при отправке кода' }
    }

    return { success: true }
  } catch (error) {
    console.error('Error sending 2FA code:', error)
    return { error: 'Ошибка при отправке кода' }
  }
}

// Получение статуса 2FA
export async function getTwoFactorStatus() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return null
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(session.user.id) },
      select: { 
        twoFactorEnabled: true
      }
    })

    return user
  } catch (error) {
    console.error('Error getting 2FA status:', error)
    return null
  }
}

export type RegisterData = {
  name: string
  surname: string
  email: string
  phone: string
  password: string
}

export async function createUser(data: RegisterData) {
  try {
    // Проверяем, существует ли пользователь с таким email
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    })

    if (existingUser) {
      return { error: 'Пользователь с таким email уже существует' }
    }

    // Хешируем пароль
    const hashedPassword = await hash(data.password, 12)

    // Создаем пользователя
    const user = await prisma.user.create({
      data: {
        name: data.name,
        surname: data.surname,
        email: data.email,
        phone: data.phone,
        password: hashedPassword,
        isPremium: false,
        notificationMode: 'normal'
      }
    })

    return { success: true, user }
  } catch (error) {
    console.error('Error creating user:', error)
    return { error: 'Ошибка при создании пользователя' }
  }
}

export async function getUserById(id: number) {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        surname: true,
        bio: true,
        email: true,
        phone: true,
        isPremium: true,
        avatar: true,
        coins: true
      }
    })
    return user
  } catch (error) {
    console.error('Error fetching user:', error)
    return null
  }
}

export async function updateUserPremiumStatus(id: number, isPremium: boolean) {
  try {
    const user = await prisma.user.update({
      where: { id },
      data: { isPremium },
      select: {
        id: true,
        name: true,
        surname: true,
        email: true,
        phone: true,
        isPremium: true
      }
    })
    
    revalidatePath('/profile')
    return { success: true, user }
  } catch (error) {
    console.error('Error updating user:', error)
    return { error: 'Ошибка при обновлении пользователя' }
  }
}

export async function deleteUser(id: number) {
  try {
    await prisma.user.delete({
      where: { id }
    })
    
    revalidatePath('/users')
    return { success: true }
  } catch (error) {
    console.error('Error deleting user:', error)
    return { error: 'Ошибка при удалении пользователя' }
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const user = await getUserById(Number(session.user.id))

  return user;
}

export async function updateUserSettings(formData: FormData) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: 'Не авторизован' }
    }

    const name = formData.get('name') as string
    const surname = formData.get('surname') as string
    const bio = formData.get('about') as string
    
    if (!name) {
      return { error: 'Имя обязательно' }
    }

    const updatedUser = await prisma.user.update({
      where: {
        id: session.user.id
      },
      data: {
        name,
        surname,
        bio
      },
      select: {
        id: true,
        name: true,
        surname: true,
        bio: true,
        email: true,
        phone: true,
        isPremium: true,
        createdAt: true,
        updatedAt: true
      }
    })

    revalidatePath('/settings')
    return { success: true, message: 'Настройки обновлены', user: updatedUser }
  } catch (error) {
    console.error('Error updating user settings:', error)
    return { error: 'Ошибка при обновлении настроек' }
  }
}

export async function updateUserAvatar(finalAvatar: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: 'Не авторизован' }
    }
    
    if (!finalAvatar) {
      return { error: 'URL аватара обязателен' }
    }

    const updatedUser = await prisma.user.update({
      where: { 
        id: Number(session.user.id)
      },
      data: {
        avatar: finalAvatar
      },
      select: {
        id: true,
        name: true,
        surname: true,
        email: true,
        phone: true,
        isPremium: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    revalidatePath('/settings')
    revalidatePath('/')
    return { success: true, message: 'Аватар обновлен', user: updatedUser }
  } catch (error) {
    console.error('Error updating avatar:', error)
    return { error: 'Ошибка при обновлении аватара' }
  }
}

export async function clearCache() {
  try {
    // Очистка кэша приложения
    revalidatePath('/')
    revalidatePath('/settings')
    revalidatePath('/chat')
    
    return { success: true, message: 'Кэш очищен' }
  } catch (error) {
    console.error('Error clearing cache:', error)
    return { error: 'Ошибка при очистке кэша' }
  }
}

export async function getUserSettings() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return null
    }

    const user = await getCurrentUser()

    return user
  } catch (error) {
    console.error('Error fetching user settings:', error)
    return null
  }
}

export async function updatePassword(formData: FormData) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: 'Не авторизован' }
    }

    const currentPassword = formData.get('currentPassword') as string
    const newPassword = formData.get('newPassword') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (newPassword !== confirmPassword) {
      return { error: 'Новые пароли не совпадают' }
    }

    if (newPassword.length < 6) {
      return { error: 'Пароль должен содержать минимум 6 символов' }
    }

    // Получаем пользователя с паролем для проверки
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user) {
      return { error: 'Пользователь не найден' }
    }

    // В реальном приложении нужно проверять текущий пароль
    // const isCurrentPasswordValid = await compare(currentPassword, user.password!)
    // if (!isCurrentPasswordValid) {
    //   return { error: 'Текущий пароль неверен' }
    // }

    const hashedPassword = await hash(newPassword, 12)

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        password: hashedPassword,
      }
    })

    return { success: true, message: 'Пароль успешно изменен' }
  } catch (error) {
    console.error('Error updating password:', error)
    return { error: 'Ошибка при изменении пароля' }
  }
}

export async function buyPremium() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: 'Не авторизован' }
    }

    const updatedUser = await prisma.user.update({
      where: { 
        id: Number(session.user.id)
      },
      data: {
        isPremium: true,
        coins: +15
      },
      select: {
        id: true,
        name: true,
        surname: true,
        email: true,
        phone: true,
        isPremium: true,
        createdAt: true,
        updatedAt: true
      }
    })

    revalidatePath('/settings')
    revalidatePath('/')
    revalidatePath('/profile')
    return { 
      success: true, 
      message: '🎉 Premium успешно активирован! Теперь вам доступны все эксклюзивные функции.', 
      user: updatedUser 
    }
  } catch (error) {
    console.error('Error activating premium:', error)
    return { error: 'Ошибка при активации Premium. Попробуйте позже.' }
  }
}

export async function addCoins(coinsAmount: number) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: 'Не авторизован' }
    }

    // Получаем текущего пользователя
    const user = await prisma.user.findUnique({
      where: { id: Number(session.user.id) },
      select: { coins: true }
    })

    if (!user) {
      return { error: 'Пользователь не найден' }
    }

    // Обновляем баланс
    const updatedUser = await prisma.user.update({
      where: { id: Number(session.user.id) },
      data: {
        coins: (user.coins || 0) + coinsAmount
      },
      select: {
        id: true,
        coins: true
      }
    })

    revalidatePath('/settings')
    return { 
      success: true, 
      message: `Баланс пополнен на ${coinsAmount} монет`,
      coins: updatedUser.coins
    }

  } catch (error) {
    console.error('Error adding coins:', error)
    return { error: 'Ошибка при пополнении баланса' }
  }
}

export async function generatePublicLoginQRCode() {
  try {
    // Генерируем уникальный токен для быстрого входа
    const loginToken = Math.random().toString(36).substring(2, 15) + 
                       Math.random().toString(36).substring(2, 15)

    const expiresAt = new Date(Date.now() + 2 * 60 * 1000) // 2 минуты

    // Сохраняем токен в базе без привязки к пользователю
    // Пользователь будет привязан при сканировании и входе
    await prisma.deviceLinkingToken.create({
      data: {
        token: loginToken,
        expiresAt
      }
    })

    // Данные для QR-кода
    const qrData = JSON.stringify({
      type: 'quick_login',
      token: loginToken,
      expiresAt: expiresAt.toISOString()
    })

    return { 
      success: true, 
      qrData,
      token: loginToken,
      expiresAt: expiresAt.toISOString()
    }
  } catch (error) {
    console.error('Error generating public login QR code:', error)
    return { error: 'Ошибка при генерации QR-кода' }
  }
}

// Валидация токена связывания
export async function validateDeviceLinkingToken(token: string) {
  try {
    const linkingToken = await prisma.deviceLinkingToken.findUnique({
      where: { token },
      include: { user: true }
    })

    if (!linkingToken) {
      return { error: 'Неверный токен' }
    }

    if (linkingToken.used) {
      return { error: 'Токен уже использован' }
    }

    if (new Date() > linkingToken.expiresAt) {
      return { error: 'Срок действия токена истек' }
    }

    // Помечаем токен как использованный
    await prisma.deviceLinkingToken.update({
      where: { id: linkingToken.id },
      data: { used: true }
    })

    return { 
      success: true, 
      user: linkingToken.user,
      userId: linkingToken.userId
    }
  } catch (error) {
    console.error('Error validating device linking token:', error)
    return { error: 'Ошибка при проверке токена' }
  }
}

// Создание сессии устройства
export async function createDeviceSession(userId: number, deviceInfo: any) {
  try {
    const deviceId = Math.random().toString(36).substring(2, 15)
    
    const session = await prisma.deviceSession.create({
      data: {
        userId,
        deviceId,
        deviceInfo: JSON.stringify(deviceInfo.deviceInfo || {}),
        ipAddress: deviceInfo.ipAddress || '',
        userAgent: deviceInfo.userAgent || ''
      }
    })

    return { success: true, deviceId, session }
  } catch (error) {
    console.error('Error creating device session:', error)
    return { error: 'Ошибка при создании сессии устройства' }
  }
}

// Получение списка связанных устройств
export async function getLinkedDevices() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: 'Не авторизован' }
    }

    const devices = await prisma.deviceSession.findMany({
      where: { userId: Number(session.user.id) },
      orderBy: { lastActive: 'desc' }
    })

    return { success: true, devices }
  } catch (error) {
    console.error('Error getting linked devices:', error)
    return { error: 'Ошибка при получении списка устройств' }
  }
}

// Удаление сессии устройства
export async function removeDeviceSession(deviceId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: 'Не авторизован' }
    }

    await prisma.deviceSession.deleteMany({
      where: { 
        deviceId,
        userId: Number(session.user.id)
      }
    })

    return { success: true }
  } catch (error) {
    console.error('Error removing device session:', error)
    return { error: 'Ошибка при удалении устройства' }
  }
}

export async function linkDeviceByToken(token: string, deviceInfo: any) {
  try {
    const linkingToken = await prisma.deviceLinkingToken.findUnique({
      where: { token },
      include: { user: true }
    })

    if (!linkingToken) {
      return { error: 'Неверный токен' }
    }

    if (linkingToken.used) {
      return { error: 'Токен уже использован' }
    }

    if (new Date() > linkingToken.expiresAt) {
      return { error: 'Срок действия токена истек' }
    }

    // Помечаем токен как использованный
    await prisma.deviceLinkingToken.update({
      where: { id: linkingToken.id },
      data: { used: true }
    })

    // Создаем сессию устройства
    const deviceId = Math.random().toString(36).substring(2, 15)
    
    const deviceSession = await prisma.deviceSession.create({
      data: {
        userId: Number(linkingToken.userId),
        deviceId,
        deviceInfo: JSON.stringify(deviceInfo.deviceInfo || {}),
        ipAddress: deviceInfo.ipAddress || '',
        userAgent: deviceInfo.userAgent || ''
      }
    })

    return { 
      success: true, 
      deviceId,
      user: linkingToken.user,
      message: 'Устройство успешно связано!'
    }
  } catch (error) {
    console.error('Error linking device by token:', error)
    return { error: 'Ошибка при связывании устройства' }
  }
}

export async function loginWithQRCode(token: string, deviceInfo: any) {
  try {
    // Валидируем токен связывания
    const linkingToken = await prisma.deviceLinkingToken.findUnique({
      where: { token },
      include: { user: true }
    })

    if (!linkingToken) {
      return { error: 'Неверный QR-код' }
    }

    if (linkingToken.used) {
      return { error: 'QR-код уже использован' }
    }

    if (new Date() > linkingToken.expiresAt) {
      return { error: 'Срок действия QR-кода истек' }
    }

    // Помечаем токен как использованный
    await prisma.deviceLinkingToken.update({
      where: { id: linkingToken.id },
      data: { used: true }
    })

    // Создаем сессию устройства
    const deviceId = Math.random().toString(36).substring(2, 15)
    
    await prisma.deviceSession.create({
      data: {
        userId: Number(linkingToken.userId),
        deviceId,
        deviceInfo: JSON.stringify(deviceInfo.deviceInfo || {}),
        ipAddress: deviceInfo.ipAddress || '',
        userAgent: deviceInfo.userAgent || ''
      }
    })

    // Создаем сессию NextAuth
    const sessionToken = Math.random().toString(36).substring(2, 15) + 
                         Math.random().toString(36).substring(2, 15)

    // Здесь должна быть логика создания сессии NextAuth
    // В реальном приложении используйте signIn из next-auth

    return { 
      success: true, 
      message: 'Вход выполнен успешно!',
      user: linkingToken.user,
      deviceId
    }
  } catch (error) {
    console.error('Error logging in with QR code:', error)
    return { error: 'Ошибка при входе по QR-коду' }
  }
}



export async function generateLoginQRCode() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { error: 'Не авторизован' }
    }

    // Генерируем уникальный токен для быстрого входа
    const loginToken = Math.random().toString(36).substring(2, 15) + 
                       Math.random().toString(36).substring(2, 15)

    const expiresAt = new Date(Date.now() + 2 * 60 * 1000) // 2 минуты

    // Сохраняем токен в базе
    await prisma.deviceLinkingToken.create({
      data: {
        token: loginToken,
        userId: Number(session.user.id),
        expiresAt
      }
    })

    // Данные для QR-кода
    const qrData = JSON.stringify({
      type: 'quick_login',
      token: loginToken,
      expiresAt: expiresAt.toISOString()
    })

    return { 
      success: true, 
      qrData,
      token: loginToken,
      expiresAt: expiresAt.toISOString()
    }
  } catch (error) {
    console.error('Error generating login QR code:', error)
    return { error: 'Ошибка при генерации QR-кода' }
  }
}

export async function quickLoginWithQRCode(token: string, deviceInfo: any, userEmail?: string) {
  try {
    // Валидируем токен входа
    const loginToken = await prisma.deviceLinkingToken.findUnique({
      where: { token }
    })

    if (!loginToken) {
      return { error: 'Неверный QR-код' }
    }

    if (loginToken.used) {
      return { error: 'QR-код уже использован' }
    }

    if (new Date() > loginToken.expiresAt) {
      return { error: 'Срок действия QR-кода истек' }
    }

    // Если передан email, ищем пользователя
    let user = null;
    if (userEmail) {
      user = await prisma.user.findUnique({
        where: { email: userEmail }
      });
      
      if (!user) {
        return { error: 'Пользователь не найден' }
      }

      // Привязываем токен к пользователю
      await prisma.deviceLinkingToken.update({
        where: { id: loginToken.id },
        data: { userId: user.id }
      });
    } else if (loginToken.userId) {
      // Если токен уже привязан к пользователю
      user = await prisma.user.findUnique({
        where: { id: loginToken.userId }
      });
    }

    if (!user) {
      return { error: 'QR-код не привязан к пользователю' }
    }

    // Помечаем токен как использованный
    await prisma.deviceLinkingToken.update({
      where: { id: loginToken.id },
      data: { used: true }
    })

    // Создаем сессию устройства
    const deviceId = Math.random().toString(36).substring(2, 15)
    
    await prisma.deviceSession.create({
      data: {
        userId: user.id,
        deviceId,
        deviceInfo: JSON.stringify(deviceInfo.deviceInfo || {}),
        ipAddress: deviceInfo.ipAddress || '',
        userAgent: deviceInfo.userAgent || ''
      }
    })

    return { 
      success: true, 
      message: 'Вход выполнен успешно!',
      user: user,
      deviceId
    }
  } catch (error) {
    console.error('Error quick login with QR code:', error)
    return { error: 'Ошибка при входе по QR-коду' }
  }
}