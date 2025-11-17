import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/app/lib/prisma";
import { compare } from "bcryptjs";
import { AuthOptions, SessionStrategy } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import YandexProvider from "next-auth/providers/yandex";

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma as any),
  session: {
    strategy: "jwt" as SessionStrategy,
  },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    YandexProvider({
      clientId: process.env.YANDEX_CLIENT_ID!,
      clientSecret: process.env.YANDEX_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
        twoFactorCode: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          throw new Error("Введите email");
        }

        // QR-логин
        if (credentials.password === "qr_login") {
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

        if (!user || !user.password) {
          throw new Error("Неверный email или пароль");
        }

        const isValid = await compare(credentials.password, user.password);
        if (!isValid) {
          throw new Error("Неверный email или пароль");
        }

        // Упрощенная проверка 2FA для демонстрации
        if (user.twoFactorEnabled && !credentials.twoFactorCode) {
          throw new Error("2FA_REQUIRED");
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
    signOut: "/",
    error: "/sign-in",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      if (account) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
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

    async signIn({ user, account, profile }) {
      // Для Яндекс OAuth
      if (account?.provider === "yandex") {
        try {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
          });
    
          if (existingUser) {
            const existingAccount = await prisma.account.findFirst({
              where: {
                userId: existingUser.id,
                provider: "yandex",
              },
            });
    
            if (!existingAccount) {
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
          } else {
            const newUser = await prisma.user.create({
              data: {
                name: profile?.real_name || profile?.display_name || user.name,
                email: user.email!,
                avatar: profile?.default_avatar_id 
                  ? `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200` 
                  : null,
              },
            });
    
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
          console.error('Yandex OAuth error:', error);
          return false;
        }
      }
      
      return true;
    },
  },
};