import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/app/lib/prisma";
import { compare } from "bcryptjs";
import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import YandexProvider from "next-auth/providers/yandex";
import { sendTwoFactorCode, verifyTwoFactorCode } from "./api/user";

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma as unknown as any),
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    YandexProvider({
      clientId: process.env.YANDEX_CLIENT_ID!,
      clientSecret: process.env.YANDEX_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "login:email login:info"
        }
      }
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
        twoFactorCode: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email) {
          throw new Error("Введите email");
        }

        if (credentials.password === "qr_login") {
          // QR-логин - ищем пользователя по email
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });
    
          if (!user) throw new Error("Пользователь не найден");
    
          return {
            id: user.id.toString(),
            name: user.name,
            email: user.email,
          };
        }

        if (!credentials?.password) {
          throw new Error("Введите пароль");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) throw new Error("Неверный email или пароль");

        const isValid = await compare(credentials.password, user.password);
        if (!isValid) throw new Error("Неверный email или пароль");

        // Проверяем включена ли 2FA
        if (user.twoFactorEnabled) {
          if (!credentials.twoFactorCode) {
            const result = await sendTwoFactorCode(credentials.email);
            if (result.error) {
              throw new Error(result.error);
            }
            throw new Error("2FA_REQUIRED");
          }

          const verificationResult = await verifyTwoFactorCode(credentials.email, credentials.twoFactorCode);
          if (verificationResult.error) {
            throw new Error(verificationResult.error);
          }
        }

        return {
          id: user.id.toString(),
          name: user.name,
          email: user.email,
        };
      },
    }),
  ],
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // Сохраняем данные пользователя в токен при первом входе
      if (user) {
        token.id = user.id;
      }
      
      // Для OAuth сохраняем access token
      if (account) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
      }
      
      // Для Яндекс OAuth получаем дополнительные данные
      if (profile && account?.provider === "yandex") {
        token.yandexProfile = profile;
      }
      
      return token;
    },

    async session({ session, token }) {
      if (token.id) {
        session.user.id = Number(token.id);
      }
      if (token.accessToken) {
        session.accessToken = token.accessToken as string;
      }
      if (token.provider) {
        session.provider = token.provider as string;
      }
      return session;
    },

    async signIn({ user, account, profile, email }) {
      // Разрешаем вход через Яндекс OAuth
      if (account?.provider === "yandex") {
        try {
          // Проверяем, существует ли пользователь с таким email
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
          });
    
          if (existingUser) {
            // Проверяем, есть ли уже привязанный Яндекс аккаунт
            const existingAccount = await prisma.account.findFirst({
              where: {
                userId: existingUser.id,
                provider: "yandex",
              },
            });
    
            if (!existingAccount) {
              // Создаем связь аккаунта для существующего пользователя
              await prisma.account.create({
                data: {
                  userId: existingUser.id,
                  type: account.type,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  access_token: account.access_token,
                  expires_at: account.expires_at,
                  token_type: account.token_type,
                  scope: account.scope,
                },
              });
            }
    
            // Обновляем данные пользователя
            await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                name: profile?.real_name || profile?.display_name || existingUser.name,
                avatar: profile?.default_avatar_id 
                  ? `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200` 
                  : existingUser.avatar,
              },
            });
          } else {
            // Если пользователь не существует, создаем нового
            const newUser = await prisma.user.create({
              data: {
                name: profile?.real_name || profile?.display_name || user.name,
                email: user.email!,
                avatar: profile?.default_avatar_id 
                  ? `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200` 
                  : null,
              },
            });
    
            // Создаем связь аккаунта
            await prisma.account.create({
              data: {
                userId: newUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
              },
            });
          }
        } catch (error) {
          console.error('Error during Yandex OAuth sign in:', error);
          return false;
        }
        return true;
      }
      
      // Для credentials provider проверяем 2FA
      return true;
    },
  },
};