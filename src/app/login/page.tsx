'use client'

import { useActionState, startTransition } from 'react'
import { login } from './actions'
import { KeyRound, Mail, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(() => {
      formAction(formData)
    })
  }

  return (
    <div className="min-h-screen bg-[#FAFBFB] text-gray-900 flex flex-col justify-center items-center px-4 font-sans" style={{ direction: 'rtl' }}>
      <div className="w-full max-w-md bg-white border border-gray-100 rounded-3xl p-8 shadow-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-black mb-2">
            ديجي<span className="text-gray-400 font-normal">تاسك</span>
          </h1>
          <p className="text-sm text-gray-400">سجل الدخول للمتابعة وإدارة المهام مع فريق العمل</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-right">
          {state?.error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-800 text-xs font-bold p-4 rounded-xl flex items-center gap-2">
              <span>⚠️</span>
              <span>{state.error}</span>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-bold text-gray-700 mb-1.5">
              البريد الإلكتروني
            </label>
            <div className="relative">
              <input
                type="email"
                id="email"
                name="email"
                required
                className="w-full bg-gray-50 border border-gray-200 focus:border-black focus:bg-white rounded-xl px-4 py-3.5 pr-10 text-sm transition-all outline-none text-right"
                placeholder="yousef@task.com"
              />
              <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-bold text-gray-700 mb-1.5">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                type="password"
                id="password"
                name="password"
                required
                className="w-full bg-gray-50 border border-gray-200 focus:border-black focus:bg-white rounded-xl px-4 py-3.5 pr-10 text-sm transition-all outline-none text-right"
                placeholder="••••••••"
              />
              <KeyRound className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-black hover:bg-neutral-800 disabled:bg-neutral-300 text-white font-bold py-3.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري التحقق...</span>
                </>
              ) : (
                <span>تسجيل الدخول</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
