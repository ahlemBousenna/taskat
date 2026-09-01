'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function login(state: any, formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  
  if (!email || !password) {
    return { error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // تعريب رسائل الخطأ الشائعة من Supabase لضمان جودة الواجهة
    let errorMessage = error.message
    if (error.message === 'Invalid login credentials') {
      errorMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
    } else if (error.message === 'Email not confirmed') {
      errorMessage = 'يرجى تأكيد البريد الإلكتروني أولاً'
    }
    return { error: errorMessage }
  }

  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
