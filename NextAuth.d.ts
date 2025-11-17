// NextAuth.d.ts
import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: number
      name?: string | null
      email?: string | null
    } & DefaultSession["user"]
    accessToken?: string
    provider?: string
  }

  interface User extends DefaultUser {
    id: string
    name?: string | null
    email: string
  }

  interface Profile {
    login?: string
    client_id?: string
    default_email?: string
    emails?: string[]
    default_avatar_id?: string
    is_avatar_empty?: boolean
    psuid?: string
    real_name?: string
    first_name?: string
    last_name?: string
    display_name?: string
    sex?: string
    default_phone?: {
      id: number
      number: string
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    accessToken?: string
    provider?: string
    yandexProfile?: Profile
  }
}