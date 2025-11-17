'use client';

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [yandexLoading, setYandexLoading] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      console.log("SignIn result:", result);

      if (result?.error) {
        setError(result.error);
      } else if (result?.ok) {
        const callbackUrl = searchParams.get('callbackUrl') || '/';
        toast.success("Добро пожаловать в Conversies!");
        router.push(callbackUrl);
        router.refresh();
      } else {
        setError("Неизвестная ошибка при входе");
      }
    } catch (error: any) {
      console.error("SignIn error:", error);
      setError(error.message || "Произошла ошибка при входе");
    } finally {
      setLoading(false);
    }
  };

  const handleYandexLogin = async () => {
    setYandexLoading(true);
    setError(null);
    
    try {
      await signIn("yandex", {
        callbackUrl: searchParams.get('callbackUrl') || '/',
      });
    } catch (error) {
      setError("Ошибка при входе через Яндекс");
    } finally {
      setYandexLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Conversies</h1>
          <p className="text-gray-400">Современная платформа для общения</p>
        </div>

        <div className="w-full p-6 bg-black/40 backdrop-blur-sm rounded-xl border border-gray-700 shadow-2xl">
          <h2 className="text-2xl text-center font-bold mb-6 text-white">
            Вход в аккаунт
          </h2>
          
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="space-y-3">
              <input
                type="email"
                className="px-4 py-3 w-full rounded-lg bg-gray-800/60 border border-gray-600 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 outline-none transition-all duration-300"
                placeholder="Введите вашу почту"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                className="px-4 py-3 w-full rounded-lg bg-gray-800/60 border border-gray-600 text-white placeholder-gray-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 outline-none transition-all duration-300"
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                loading 
                  ? 'bg-gray-600 cursor-not-allowed' 
                  : 'bg-purple-500 hover:bg-purple-600 transform cursor-pointer'
              } text-white`}
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Входим...</span>
                </div>
              ) : (
                'Войти'
              )}
            </button>

            {error && (
              <div className="p-3 rounded-lg text-center bg-red-500/20 text-red-300 border border-red-500/30">
                {error}
              </div>
            )}
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-black/40 text-gray-400">или</span>
            </div>
          </div>

          <button
            onClick={handleYandexLogin}
            disabled={yandexLoading}
            className="w-full mb-4 bg-red-500 text-white py-3 px-4 rounded-lg hover:bg-red-600 transition-all duration-200 font-medium flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
          >
            <Image src="/assets/images/Yandex_icon.svg.png" alt="Яндекс" width={20} height={20} />
            <span>
              {yandexLoading ? "Вход..." : "Войти через Яндекс"}
            </span>
          </button>

          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              Ещё нет аккаунта?{' '}
              <a 
                href="/sign-up" 
                className="text-purple-500 hover:text-purple-400 font-medium transition-colors"
              >
                Зарегистрируйтесь
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}