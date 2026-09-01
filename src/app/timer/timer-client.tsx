'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import DatePicker from '@/components/DatePicker'
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Save, 
  Timer, 
  Plus, 
  FolderPlus, 
  CheckCircle, 
  X, 
  Loader2,
  ListTodo
} from 'lucide-react'
import { logTaskMinutes, addTask } from '../actions'

interface Profile {
  id: string
  name: string
  email: string
  role: string
  avatar_url: string
}

interface Group {
  id: string
  name: string
  color: string
}

interface YoutubeVideo {
  id: string
  title: string
}

interface ActiveTask {
  id: string
  title: string
  status: string
  work_minutes: number
  group?: {
    id: string
    name: string
    color: string
  } | null
}

interface TimerClientProps {
  currentProfile: Profile
  initialActiveTasks: any[]
  youtubeVideos: YoutubeVideo[]
  groups: Group[]
}

export default function TimerClient({ currentProfile, initialActiveTasks = [], youtubeVideos = [], groups = [] }: TimerClientProps) {
  const router = useRouter()
  const [time, setTime] = useState<number>(0)
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
  const [activeTasks, setActiveTasks] = useState<ActiveTask[]>(initialActiveTasks)
  
  // حفظ خيارات الحفظ
  const [saveMode, setSaveMode] = useState<'existing' | 'new'>('existing')
  const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [selectedVideoId, setSelectedVideoId] = useState('')
  const [selectedVideoPhase, setSelectedVideoPhase] = useState('other')
  const [newDueDate, setNewDueDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, type })
  }

  // مزامنة حالة المؤقت من localStorage
  const syncState = () => {
    try {
      const running = localStorage.getItem('chrono_is_running') === 'true'
      if (running) {
        const startTime = parseInt(localStorage.getItem('chrono_start_time') || '0', 10)
        const elapsedBefore = parseInt(localStorage.getItem('chrono_elapsed_before') || '0', 10)
        
        if (startTime > 0) {
          const currentElapsed = Math.floor((Date.now() - startTime) / 1000) + elapsedBefore
          setTime(currentElapsed)
          setIsRunning(true)
        }
      } else {
        const elapsed = parseInt(localStorage.getItem('chrono_elapsed') || '0', 10)
        setTime(elapsed)
        setIsRunning(false)
      }
    } catch (e) {
      console.error('[Timer] Sync state error:', e)
    }
  }

  // تحميل ومراقبة حالة المؤقت والمزامنة
  useEffect(() => {
    syncState()

    window.addEventListener('chrono-state-changed', syncState)
    window.addEventListener('storage', syncState)

    // التحقق من معامل الحفظ التلقائي في رابط الصفحة
    const searchParams = new URLSearchParams(window.location.search)
    if (searchParams.get('save') === 'true') {
      setIsSaveModalOpen(true)
      // تنظيف الرابط بعد المعالجة
      router.replace('/timer')
    }

    if (initialActiveTasks.length > 0) {
      setSelectedTaskId(initialActiveTasks[0].id)
    }
    if (groups.length > 0) {
      setSelectedGroupId(groups[0].id)
    }

    return () => {
      window.removeEventListener('chrono-state-changed', syncState)
      window.removeEventListener('storage', syncState)
    }
  }, [])

  // تحديث المؤقت كل ثانية عند التشغيل
  useEffect(() => {
    let intervalId: any = null

    if (isRunning) {
      intervalId = setInterval(() => {
        try {
          const startTime = parseInt(localStorage.getItem('chrono_start_time') || '0', 10)
          const elapsedBefore = parseInt(localStorage.getItem('chrono_elapsed_before') || '0', 10)
          if (startTime > 0) {
            const currentElapsed = Math.floor((Date.now() - startTime) / 1000) + elapsedBefore
            setTime(currentElapsed)
          }
        } catch (e) {}
      }, 250)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [isRunning])

  const dispatchStateChange = () => {
    window.dispatchEvent(new CustomEvent('chrono-state-changed'))
  }

  // التحكم بالعداد
  const handleStart = () => {
    setIsRunning(true)
    const now = Date.now()
    try {
      localStorage.setItem('chrono_is_running', 'true')
      localStorage.setItem('chrono_start_time', now.toString())
      localStorage.setItem('chrono_elapsed_before', time.toString())
    } catch (e) {}
    dispatchStateChange()
  }

  const handlePause = () => {
    setIsRunning(false)
    try {
      localStorage.setItem('chrono_is_running', 'false')
      localStorage.setItem('chrono_elapsed', time.toString())
    } catch (e) {}
    dispatchStateChange()
  }

  const handleReset = () => {
    setIsRunning(false)
    setTime(0)
    try {
      localStorage.setItem('chrono_is_running', 'false')
      localStorage.setItem('chrono_elapsed', '0')
      localStorage.setItem('chrono_start_time', '0')
      localStorage.setItem('chrono_elapsed_before', '0')
    } catch (e) {}
    dispatchStateChange()
  }

  // حفظ الوقت المنقضي
  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // حساب الدقائق المنجزة
    const minutesToLog = Math.ceil(time / 60)
    if (minutesToLog <= 0) {
      showToast('الوقت المستغرق قصير جداً للتسجيل (أقل من دقيقة)', 'warning')
      return
    }

    startTransition(async () => {
      try {
        if (saveMode === 'existing') {
          if (!selectedTaskId) {
            showToast('الرجاء اختيار المهمة المراد إضافة الوقت إليها', 'warning')
            return
          }
          await logTaskMinutes(selectedTaskId, minutesToLog)
          showToast(`تمت إضافة ${minutesToLog} دقيقة إلى المهمة بنجاح ⏱️`, 'success')
        } else {
          if (!newTitle.trim()) {
            showToast('عنوان المهمة مطلوب', 'warning')
            return
          }
          if (!selectedGroupId) {
            showToast('الرجاء تحديد مجموعة العمل', 'warning')
            return
          }
          await addTask(
            newTitle.trim(),
            newDescription.trim(),
            selectedGroupId,
            currentProfile.id,
            newDueDate,
            'classic',
            null, // milestone_id
            minutesToLog,
            selectedVideoId || null,
            selectedVideoPhase || 'other'
          )
          showToast('تم إنشاء المهمة وتسجيل الوقت بنجاح 🎉', 'success')
        }

        // تصفير المؤقت بعد الحفظ بنجاح
        handleReset()
        setIsSaveModalOpen(false)
        router.refresh()
      } catch (err: any) {
        showToast('فشل حفظ وقت العمل: ' + err.message, 'error')
      }
    })
  }

  // تنسيق الوقت
  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    return {
      hours: hrs.toString().padStart(2, '0'),
      minutes: mins.toString().padStart(2, '0'),
      seconds: secs.toString().padStart(2, '0')
    }
  }

  const formatted = formatTime(time)

  return (
    <div className="flex-grow flex flex-col min-h-screen pb-24 md:pb-8">
      <Header user={currentProfile} />

      <main className="flex-grow max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="space-y-8 text-center animate-modal-in">
          
          {/* ترويسة الصفحة */}
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-theme-text flex items-center justify-center gap-2.5">
              <span>⏱️</span>
              <span>مؤقت الإنتاجية (Stopwatch)</span>
            </h1>
            <p className="text-sm text-theme-text-muted max-w-lg mx-auto">
              تتبع الساعات والدقائق التي تقضيها في إنجاز مهامك وفيديوهات قناتك، ثم احفظها في قائمة إنجازاتك.
            </p>
          </div>

          {/* عداد مركزي دائري ضخم */}
          <div className="relative w-80 h-80 mx-auto bg-theme-panel/60 border border-theme-border rounded-full flex flex-col items-center justify-center shadow-2xl backdrop-blur-sm relative group">
            
            {/* توهج النيون الدائري الخلفي عند العمل */}
            <div className={`absolute inset-0 rounded-full transition-all duration-1000 -z-10 ${
              isRunning 
                ? 'bg-theme-accent/5 ring-8 ring-theme-accent/5 animate-pulse blur-xl' 
                : 'bg-transparent'
            }`} />

            {/* الوقت */}
            <div className="flex items-baseline justify-center font-mono gap-1 text-theme-text select-all">
              <div className="flex flex-col items-center">
                <span className="text-5xl font-black tracking-tight">{formatted.hours}</span>
                <span className="text-[10px] text-theme-text-muted font-bold mt-1">ساعة</span>
              </div>
              <span className="text-3xl font-bold opacity-30 px-1">:</span>
              <div className="flex flex-col items-center">
                <span className="text-5xl font-black tracking-tight">{formatted.minutes}</span>
                <span className="text-[10px] text-theme-text-muted font-bold mt-1">دقيقة</span>
              </div>
              <span className="text-3xl font-bold opacity-30 px-1">:</span>
              <div className="flex flex-col items-center">
                <span className="text-5xl font-black tracking-tight text-theme-accent">{formatted.seconds}</span>
                <span className="text-[10px] text-theme-text-muted font-bold mt-1">ثانية</span>
              </div>
            </div>

            <div className="text-xs text-theme-text-muted font-bold mt-6 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
              <span>{isRunning ? 'عداد العمل نشط حالياً' : 'متوقف مؤقتاً'}</span>
            </div>
          </div>

          {/* أزرار التحكم بالعداد */}
          <div className="flex flex-wrap items-center justify-center gap-4 max-w-md mx-auto">
            <button
              onClick={handleReset}
              className="px-6 py-3.5 bg-theme-panel hover:bg-theme-bg border border-theme-border text-theme-text font-bold rounded-2xl text-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95 shadow-sm"
              title="إعادة تعيين العداد"
            >
              <RotateCcw className="w-4 h-4 text-theme-text-muted" />
              <span>تصفير العداد</span>
            </button>

            {isRunning ? (
              <button
                onClick={handlePause}
                className="flex-1 px-8 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-lg shadow-amber-500/10"
              >
                <Pause className="w-4 h-4" />
                <span>إيقاف مؤقت</span>
              </button>
            ) : (
              <button
                onClick={handleStart}
                className="flex-1 px-8 py-3.5 bg-theme-accent hover:bg-theme-accent-hover text-theme-panel font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-lg shadow-theme-accent/20"
              >
                <Play className="w-4 h-4" />
                <span>بدء الجلسة</span>
              </button>
            )}

            {time > 0 && (
              <button
                onClick={() => setIsSaveModalOpen(true)}
                className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-lg shadow-indigo-600/20"
              >
                <Save className="w-4 h-4" />
                <span>تسجيل الجلسة</span>
              </button>
            )}
          </div>

        </div>
      </main>

      {/* ================== مودال حفظ الجلسة ================== */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setIsSaveModalOpen(false)}></div>
          
          <div className="relative bg-theme-panel w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-theme-border animate-modal-in z-10 text-right space-y-6">
            
            <div className="flex items-start justify-between gap-4 border-b border-theme-border pb-4">
              <div>
                <h3 className="text-lg font-black text-theme-text flex items-center gap-2">
                  <Timer className="w-5 h-5 text-theme-accent" />
                  <span>تسجيل وقت العمل</span>
                </h3>
                <p className="text-xs text-theme-text-muted mt-1">
                  تريد تسجيل <strong className="text-indigo-400">{Math.ceil(time / 60)} دقيقة</strong> في قائمة المهام؟
                </p>
              </div>
              <button 
                onClick={() => setIsSaveModalOpen(false)}
                className="p-1 text-theme-text-muted hover:text-theme-text rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* وضع التبويب (مهمة جديدة / مهمة سابقة) */}
            <div className="grid grid-cols-2 gap-2 bg-theme-bg p-1 rounded-2xl border border-theme-border">
              <button
                type="button"
                onClick={() => setSaveMode('existing')}
                className={`py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  saveMode === 'existing' 
                    ? 'bg-theme-panel text-theme-text shadow-sm border border-theme-border' 
                    : 'text-theme-text-muted hover:text-theme-text'
                }`}
              >
                مهمة حالية نشطة
              </button>
              <button
                type="button"
                onClick={() => setSaveMode('new')}
                className={`py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  saveMode === 'new' 
                    ? 'bg-theme-panel text-theme-text shadow-sm border border-theme-border' 
                    : 'text-theme-text-muted hover:text-theme-text'
                }`}
              >
                إنشاء مهمة جديدة
              </button>
            </div>

            <form onSubmit={handleSaveSubmit} className="space-y-4">
              {saveMode === 'existing' ? (
                /* مهمة حالية */
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-theme-text-muted">اختر المهمة المراد تدوين الوقت بها</label>
                  {activeTasks.length === 0 ? (
                    <div className="text-xs text-theme-text-muted p-4 text-center bg-theme-bg/60 border border-theme-border rounded-xl">
                      لا توجد مهام نشطة حالياً. يرجى اختيار وضع "إنشاء مهمة جديدة" بالرأس.
                    </div>
                  ) : (
                    <select
                      value={selectedTaskId}
                      onChange={(e) => setSelectedTaskId(e.target.value)}
                      required
                      className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none cursor-pointer font-semibold"
                    >
                      {activeTasks.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.group?.name ? `[${t.group.name}] ` : ''}{t.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                /* مهمة جديدة */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-theme-text-muted mb-1.5">عنوان المهمة الجديدة</label>
                    <input 
                      type="text" 
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      required
                      placeholder="مثال: مونتاج الفيديو أو تسجيل الصوت"
                      className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none" 
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-theme-text-muted mb-1.5">الوصف والتفاصيل</label>
                    <textarea 
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      rows={3}
                      placeholder="تفاصيل إضافية..."
                      className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none resize-none" 
                    ></textarea>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-theme-text-muted mb-1.5">مجموعة العمل اليومية</label>
                      <select 
                        value={selectedGroupId}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                        required
                        className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3.5 text-xs transition-all outline-none cursor-pointer font-semibold"
                      >
                        {groups.map(g => (
                          <option key={g.id} value={g.id}>📁 {g.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-theme-text-muted mb-1.5">تاريخ التسليم المتوقع</label>
                      <DatePicker 
                        name="new_due_date"
                        value={newDueDate}
                        onChange={setNewDueDate}
                        className="bg-theme-input focus:bg-theme-panel py-3"
                        direction="up"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-theme-text-muted mb-1.5">فيديو مرتبط بقناتك (اختياري)</label>
                      <select 
                        value={selectedVideoId}
                        onChange={(e) => setSelectedVideoId(e.target.value)}
                        className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none cursor-pointer font-semibold"
                      >
                        <option value="">عمل عام / غير مرتبط بفيديو</option>
                        {youtubeVideos.map(v => (
                          <option key={v.id} value={v.id}>🎬 {v.title}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-theme-text-muted mb-1.5">مرحلة إنتاج الفيديو</label>
                      <select 
                        value={selectedVideoPhase}
                        onChange={(e) => setSelectedVideoPhase(e.target.value)}
                        className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none cursor-pointer font-semibold"
                      >
                        <option value="other">أخرى / عمل عام</option>
                        <option value="scripting">✍️ السيناريو والكتابة</option>
                        <option value="recording">🎙️ التصوير والتسجيل</option>
                        <option value="editing">🎬 المونتاج والتحريك</option>
                        <option value="publishing">🎨 الغلاف والنشر</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={isPending || (saveMode === 'existing' && activeTasks.length === 0)}
                  className="flex-grow bg-theme-accent hover:bg-theme-accent-hover disabled:bg-neutral-300 disabled:text-neutral-500 text-theme-panel font-bold py-3.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 shadow-sm"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري حفظ البيانات...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>تأكيد وتسجيل الوقت ({Math.ceil(time / 60)} دقيقة)</span>
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(false)}
                  className="px-5 bg-theme-panel hover:bg-theme-bg text-theme-text border border-theme-border font-bold rounded-xl text-xs transition-all cursor-pointer active:scale-95"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* توست التنبيهات */}
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
