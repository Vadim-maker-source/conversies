import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: number
      name?: string | null
      email?: string | null
      image?: string | null
    }
    accessToken?: string
    provider?: string
  }

  interface User {
    id: string
    name?: string | null
    email: string
    image?: string | null
  }

  interface Profile {
    login?: string
    client_id?: string
    default_email?: string
    emails?: { value: string }[]
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
    id?: string
    accessToken?: string
    provider?: string
    yandexProfile?: Profile
  }
}