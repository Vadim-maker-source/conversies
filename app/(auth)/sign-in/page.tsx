'use client';

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";

// Вынесите основную логику в отдельный компонент
function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [yandexLoading, setYandexLoading] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams(); // Теперь это безопасно

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      const result = await signIn("credentials", {
        email,
        password,
        twoFactorCode: showTwoFactor ? twoFactorCode : twoFactorCode,
        redirect: false,
      });

      if (result?.error) {
        if (result.error === "2FA_REQUIRED") {
          setShowTwoFactor(true);
          setError("Код отправлен на вашу почту");
        } else {
          setError(result.error);
        }
      } else {
        const callbackUrl = searchParams.get('callbackUrl') || '/';
        toast.success("Добро пожаловать в систему Conversies!")
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (error) {
      setError("Произошла ошибка при входе");
    } finally {
      setLoading(false);
    }
  };

  const handleYandexLogin = async () => {
    setYandexLoading(true);
    setError(null);
    
    try {
      const result = await signIn("yandex", {
        redirect: false,
        callbackUrl: searchParams.get('callbackUrl') || '/',
      });

      if (result?.error) {
        setError("Ошибка при входе через Яндекс");
      }
    } catch (error) {
      setError("Ошибка при входе через Яндекс");
    } finally {
      setYandexLoading(false);
    }
  };

  const handleResendCode = async () => {
    setSendingCode(true);
    setError(null);
    
    try {
      const result = await signIn("credentials", {
        email,
        password: "dummy",
        redirect: false,
      });

      if (result?.error === "2FA_REQUIRED") {
        setError("Код отправлен на вашу почту");
      } else {
        setError("Ошибка при отправке кода");
      }
    } catch (error) {
      setError("Ошибка при отправке кода");
    } finally {
      setSendingCode(false);
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
            {showTwoFactor ? "Двухэтапная аутентификация" : "Вход в аккаунт"}
          </h2>
          
          <form onSubmit={submit} className="flex flex-col gap-4">
            {!showTwoFactor ? (
              <>
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
              </>
            ) : (
              <>
                <div className="text-center mb-4">
                  <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-white text-lg">✓</span>
                  </div>
                  <p className="text-white">
                    Код отправлен на <strong className="text-purple-300">{email}</strong>
                  </p>
                  <p className="text-sm text-gray-300 mt-2">
                    Введите 6-значный код из письма
                  </p>
                </div>
                
                <input
                  type="text"
                  className="px-4 py-3 w-full rounded-lg bg-gray-800 border border-gray-600 text-white text-center text-xl font-mono tracking-widest focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-all duration-200"
                  placeholder="000000"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  required
                />
                
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={sendingCode}
                    className="flex-1 py-2 px-4 rounded-lg border border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white transition-colors disabled:opacity-50 text-sm"
                  >
                    {sendingCode ? "Отправка..." : "Отправить код"}
                  </button>
                  
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2 px-4 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-colors disabled:opacity-50 text-sm"
                  >
                    {loading ? "Проверка..." : "Подтвердить"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowTwoFactor(false);
                    setError(null);
                    setTwoFactorCode('');
                  }}
                  className="text-gray-400 hover:text-white transition-colors text-sm flex items-center justify-center space-x-2 py-2"
                >
                  <span>← Назад к входу</span>
                </button>
              </>
            )}

            {error && (
              <div className={`p-3 rounded-lg text-center ${
                error.includes('отправлен') 
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
              }`}>
                {error}
              </div>
            )}
          </form>

          {/* Разделитель */}
          {!showTwoFactor && (
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-black/40 text-gray-400">или</span>
              </div>
            </div>
          )}

          {!showTwoFactor && (
            <button
              onClick={handleYandexLogin}
              disabled={yandexLoading}
              className="w-full mb-4 bg-purple-500 text-white py-3 px-4 rounded-lg hover:bg-purple-600 transition-all duration-200 font-medium flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              <Image src="/assets/images/Yandex_icon.svg.png" alt="Яндекс" width={30} height={30} />
              <span>
                {yandexLoading ? "Вход..." : "Войти через Яндекс"}
              </span>
            </button>
          )}

          {!showTwoFactor && (
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
          )}
        </div>
      </div>
    </div>
  );
}

// Основной компонент страницы с Suspense
export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-transparent p-4">
        <div className="w-full max-w-md">
          <div className="w-full p-6 bg-black/40 backdrop-blur-sm rounded-xl border border-gray-700 shadow-2xl">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
              <span className="text-white">Загрузка...</span>
            </div>
          </div>
        </div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}