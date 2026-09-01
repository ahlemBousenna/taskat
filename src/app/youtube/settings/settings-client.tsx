'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import { 
  ArrowRight, 
  Settings, 
  Plus, 
  Trash2, 
  Edit2, 
  Loader2, 
  Eye, 
  Check, 
  Info,
  ShieldAlert
} from 'lucide-react'
import { 
  updateAISettings, 
  createAIReferenceScript, 
  updateAIReferenceScript, 
  deleteAIReferenceScript 
} from '../../actions'

interface Profile {
  id: string
  name: string
  email: string
  role: string
  avatar_url: string
  is_ai_enabled?: boolean
  azure_ai_key?: string | null
  azure_ai_endpoint?: string | null
  azure_ai_model?: string | null
}

interface ReferenceScript {
  id: string
  title: string
  content: string
  created_at: string
}

interface SettingsClientProps {
  currentProfile: Profile
  initialReferenceScripts: ReferenceScript[]
}

export default function SettingsClient({ currentProfile, initialReferenceScripts = [] }: SettingsClientProps) {
  const [profile, setProfile] = useState<Profile>(currentProfile)
  const [referenceScripts, setReferenceScripts] = useState<ReferenceScript[]>(initialReferenceScripts)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null)

  // إعدادات المفاتيح والتفعيل
  const [isAIEnabled, setIsAIEnabled] = useState(profile.is_ai_enabled || false)
  const [apiKey, setApiKey] = useState(profile.azure_ai_key || '')
  const [apiEndpoint, setApiEndpoint] = useState(profile.azure_ai_endpoint || '')
  const [apiModel, setApiModel] = useState(profile.azure_ai_model || '')
  const [showKey, setShowKey] = useState(false)
  const [showAICreds, setShowAICreds] = useState(!profile.azure_ai_key)

  // نموذج إضافة سكربت مرجعي جديد
  const [scriptTitle, setScriptTitle] = useState('')
  const [scriptContent, setScriptContent] = useState('')
  const [isAddFormOpen, setIsAddFormOpen] = useState(false)

  // نموذج عرض/تعديل سكربت مرجعي قائم
  const [editingScript, setEditingScript] = useState<ReferenceScript | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, type })
  }

  // حفظ إعدادات الـ AI والمفاتيح
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault()

    if (isAIEnabled && (!apiKey.trim() || !apiEndpoint.trim())) {
      showToast('يرجى ملء مفتاح الـ API والـ Endpoint عند تفعيل الذكاء الاصطناعي', 'warning')
      return
    }

    startTransition(async () => {
      try {
        const updated = await updateAISettings(isAIEnabled, apiKey, apiEndpoint, apiModel)
        setProfile(updated)
        showToast('تمت تحديث إعدادات الذكاء الاصطناعي بنجاح ✅', 'success')
      } catch (err: any) {
        showToast('فشل حفظ الإعدادات: ' + err.message, 'error')
      }
    })
  }

  // إضافة سكربت مرجعي جديد
  const handleAddScript = (e: React.FormEvent) => {
    e.preventDefault()
    if (!scriptTitle.trim() || !scriptContent.trim()) {
      showToast('العنوان والمحتوى مطلوبان', 'warning')
      return
    }

    startTransition(async () => {
      try {
        const created = await createAIReferenceScript(scriptTitle, scriptContent)
        setReferenceScripts([created, ...referenceScripts])
        setScriptTitle('')
        setScriptContent('')
        setIsAddFormOpen(false)
        showToast('تمت إضافة السكربت المرجعي بنجاح ✍️', 'success')
      } catch (err: any) {
        showToast('فشل الإضافة: ' + err.message, 'error')
      }
    })
  }

  // تعديل سكربت مرجعي
  const handleUpdateScript = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingScript) return
    if (!editTitle.trim() || !editContent.trim()) {
      showToast('العنوان والمحتوى مطلوبان', 'warning')
      return
    }

    startTransition(async () => {
      try {
        const updated = await updateAIReferenceScript(editingScript.id, editTitle, editContent)
        setReferenceScripts(referenceScripts.map(s => s.id === editingScript.id ? updated : s))
        setEditingScript(null)
        showToast('تم تعديل السكربت بنجاح 📝', 'success')
      } catch (err: any) {
        showToast('فشل التعديل: ' + err.message, 'error')
      }
    })
  }

  // حذف سكربت مرجعي
  const handleDeleteScript = (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السكربت المرجعي؟ لن يتمكن الـ AI من التشبّه به لاحقاً.')) {
      return
    }

    startTransition(async () => {
      try {
        await deleteAIReferenceScript(id)
        setReferenceScripts(referenceScripts.filter(s => s.id !== id))
        showToast('تم حذف السكربت المرجعي بنجاح', 'success')
      } catch (err: any) {
        showToast('فشل الحذف: ' + err.message, 'error')
      }
    })
  }

  const openEditModal = (script: ReferenceScript) => {
    setEditingScript(script)
    setEditTitle(script.title)
    setEditContent(script.content)
  }

  return (
    <div className="flex-grow flex flex-col min-h-screen pb-24 md:pb-8">
      <Header user={profile} />

      <main className="flex-grow max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="space-y-6 animate-modal-in text-right">
          
          {/* Breadcrumb والرجوع */}
          <div className="flex items-center gap-3 border-b border-theme-border pb-5 justify-start">
            <Link 
              href="/youtube"
              className="p-2.5 bg-theme-panel hover:bg-theme-bg text-theme-text rounded-xl border border-theme-border transition-all flex items-center justify-center shadow-sm cursor-pointer shrink-0"
              title="الرجوع للأستوديو"
            >
              <ArrowRight className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] text-theme-text-muted font-bold mb-1 justify-start">
                <span>الأستوديو</span>
                <span>/</span>
                <span>إعدادات أسلوب الـ AI</span>
              </div>
              <h1 className="text-xl font-bold text-theme-text">إعدادات أسلوب الـ AI وبصمة القناة</h1>
            </div>
          </div>

          <div className="flex justify-end mb-2">
            <button
              onClick={() => setShowAICreds(!showAICreds)}
              className="px-4 py-2 bg-theme-panel hover:bg-theme-bg border border-theme-border text-theme-text rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <span>{showAICreds ? "📁 إخفاء مفاتيح الربط بالـ AI" : "⚙️ إظهار مفاتيح الربط بالـ AI"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            
            {/* إعدادات التفعيل والمفاتيح */}
            {showAICreds && (
              <div className="md:col-span-5 bg-theme-panel border border-theme-border rounded-3xl p-6 shadow-sm space-y-6 animate-modal-in">
              <div>
                <h2 className="text-sm font-black text-theme-text flex items-center gap-2 justify-start">
                  <Settings className="w-4.5 h-4.5 text-theme-accent" />
                  <span>تفعيل والتحكم بالذكاء الاصطناعي</span>
                </h2>
                <p className="text-[10px] text-theme-text-muted mt-1 leading-relaxed">
                  تفعيل/تعطيل وحفظ مفاتيح وربط بوابة الذكاء الاصطناعي التوليدي بالمنصة.
                </p>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-4">
                {/* مفتاح التبديل الرئيسي */}
                <div className="flex items-center justify-between p-3.5 bg-theme-bg/50 border border-theme-border rounded-2xl">
                  <span className="text-xs font-bold text-theme-text">تفعيل مساعد الـ AI في تفاصيل الفيديو</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isAIEnabled}
                      onChange={(e) => setIsAIEnabled(e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-neutral-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-theme-accent"></div>
                  </label>
                </div>

                {isAIEnabled && (
                  <div className="space-y-4 animate-modal-in">
                    <div>
                      <label className="block text-[10px] font-bold text-theme-text-muted mb-1.5">مفتاح Azure AI (api-key)</label>
                      <div className="relative">
                        <input 
                          type={showKey ? "text" : "password"} 
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          required={isAIEnabled}
                          placeholder="أدخل الـ api-key..."
                          className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-2.5 text-xs transition-all outline-none font-mono" 
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey(!showKey)}
                          className="absolute left-3 top-2.5 text-[9px] font-bold text-theme-text-muted hover:text-theme-text cursor-pointer"
                        >
                          {showKey ? "إخفاء" : "إظهار"}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-theme-text-muted mb-1.5">رابط الـ Endpoint</label>
                      <input 
                        type="url" 
                        value={apiEndpoint}
                        onChange={(e) => setApiEndpoint(e.target.value)}
                        required={isAIEnabled}
                        placeholder="https://..."
                        className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-2.5 text-xs transition-all outline-none font-mono" 
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-theme-text-muted mb-1.5">اسم الموديل (Model Deployment Name)</label>
                      <input 
                        type="text" 
                        value={apiModel}
                        onChange={(e) => setApiModel(e.target.value)}
                        required={isAIEnabled}
                        placeholder="مثال: gpt-4o أو gpt-4o-mini..."
                        className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-2.5 text-xs transition-all outline-none font-mono" 
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-3 bg-theme-accent hover:opacity-90 disabled:opacity-50 text-theme-panel font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-98"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري حفظ الإعدادات...</span>
                    </>
                  ) : (
                    <span>تأكيد وحفظ التغييرات ✅</span>
                  )}
                </button>
              </form>

              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-start gap-2.5">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-[9px] leading-relaxed">
                  <strong>ملاحظة أمان:</strong> يتم تخزين وحفظ مفاتيحك ورابط الاتصال محلياً بأمان تام داخل قاعدة بياناتك، ويتم استدعاء الذكاء الاصطناعي مباشرة من الخادم (Server Actions) دون تسريب المفاتيح للمتصفح.
                </p>
              </div>
            </div>
          )}

            {/* إدارة السكربتات المرجعية للأسلوب */}
            <div className={`${showAICreds ? 'md:col-span-7' : 'md:col-span-12'} bg-theme-panel border border-theme-border rounded-3xl p-6 shadow-sm space-y-6 transition-all duration-300`}>
              <div className="flex items-center justify-between gap-4 border-b border-theme-border/60 pb-4">
                <div>
                  <h2 className="text-sm font-black text-theme-text flex items-center gap-2 justify-start">
                    <span>✍️</span>
                    <span>مخزن أسلوب بارون (Reference Scripts)</span>
                  </h2>
                  <p className="text-[10px] text-theme-text-muted mt-1 leading-relaxed">
                    أضف السكربتات القديمة الخاصة بك هنا (خطوة تتم مرة واحدة)، ليتمكن الـ AI من مطابقة إيقاعك وطريقة كتابتك تماماً.
                  </p>
                </div>
                
                <button
                  onClick={() => setIsAddFormOpen(!isAddFormOpen)}
                  className="px-3.5 py-2 bg-theme-bg hover:bg-theme-input text-theme-text border border-theme-border rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة سكربت</span>
                </button>
              </div>

              {/* نموذج إضافة سكربت جديد */}
              {isAddFormOpen && (
                <form onSubmit={handleAddScript} className="p-4 bg-theme-bg/50 border border-theme-border rounded-2xl space-y-4 animate-modal-in">
                  <div>
                    <label className="block text-[10px] font-bold text-theme-text-muted mb-1.5">عنوان السكربت المرجعي</label>
                    <input 
                      type="text" 
                      value={scriptTitle}
                      onChange={(e) => setScriptTitle(e.target.value)}
                      required
                      placeholder="مثال: سكربت فيديو سر الغرفة الغامضة"
                      className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-2.5 text-xs transition-all outline-none" 
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-theme-text-muted mb-1.5">نص السكربت الكامل</label>
                    <textarea 
                      value={scriptContent}
                      onChange={(e) => setScriptContent(e.target.value)}
                      required
                      rows={6}
                      placeholder="انسخ والصق أفضل نصوصك السابقة هنا..."
                      className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-2.5 text-xs transition-all outline-none resize-none leading-relaxed" 
                    ></textarea>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="px-5 py-2.5 bg-theme-accent hover:opacity-90 disabled:opacity-50 text-theme-panel rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      إضافة للمخزن ➕
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddFormOpen(false)}
                      className="px-4 py-2.5 bg-neutral-600 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              )}

              {/* قائمة السكربتات المرجعية المضافة */}
              {referenceScripts.length === 0 ? (
                <div className="text-center py-10 bg-theme-bg/30 border border-dashed border-theme-border rounded-2xl">
                  <p className="text-xs text-theme-text-muted">مخزن السكربتات فارغ حالياً.</p>
                  <p className="text-[10px] text-theme-text-muted mt-1">
                    أضف على الأقل سكربت واحد قديم لتمكين التوليد الذكي بالأسلوب الشخصي.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {referenceScripts.map((script) => (
                    <div 
                      key={script.id}
                      className="bg-theme-bg/50 border border-theme-border rounded-2xl p-4 flex items-center justify-between gap-4 transition-all duration-200"
                    >
                      <div className="space-y-1 min-w-0">
                        <h4 className="text-xs font-bold text-theme-text truncate">{script.title}</h4>
                        <p className="text-[9px] text-theme-text-muted line-clamp-1">
                          {script.content.substring(0, 100)}...
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditModal(script)}
                          className="p-2 hover:bg-theme-bg text-theme-text-muted hover:text-theme-accent rounded-xl border border-theme-border transition-colors cursor-pointer"
                          title="عرض وتعديل النص"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteScript(script.id)}
                          className="p-2 hover:bg-rose-950/20 text-theme-text-muted hover:text-rose-500 rounded-xl border border-theme-border transition-colors cursor-pointer"
                          title="حذف النص المرجعي"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ================== مودال تعديل سكربت قائم ================== */}
      {editingScript && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setEditingScript(null)}></div>
          
          <div className="relative bg-theme-panel w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-theme-border animate-modal-in z-10 text-right space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-theme-border pb-4">
              <div>
                <h3 className="text-base font-black text-theme-text flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-theme-accent" />
                  <span>عرض وتحديث السكربت المرجعي</span>
                </h3>
              </div>
              <button 
                onClick={() => setEditingScript(null)}
                className="p-1 text-theme-text-muted hover:text-theme-text rounded-xl transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateScript} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">عنوان السكربت</label>
                <input 
                  type="text" 
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">محتوى النص</label>
                <textarea 
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  required
                  rows={12}
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none resize-none leading-relaxed font-mono" 
                ></textarea>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-grow py-3 bg-theme-accent hover:opacity-90 disabled:opacity-50 text-theme-panel font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-98"
                >
                  <span>تأكيد وحفظ التغييرات 💾</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingScript(null)}
                  className="px-5 bg-neutral-600 hover:bg-neutral-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  )
}
