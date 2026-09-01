'use client'

import { useState, useEffect, useTransition } from 'react'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import DatePicker from '@/components/DatePicker'
import { 
  MessageSquare, 
  Star, 
  Loader2, 
  Send, 
  Calendar, 
  AlertCircle,
  Trash2,
  TrendingUp,
  Pencil,
  PlusCircle,
  FileText
} from 'lucide-react'
import { 
  getDailyStandups, 
  submitDailyStandup, 
  deleteDailyStandup 
} from '../actions'

interface Profile {
  id: string
  name: string
  email: string
  role: string
  avatar_url: string
}

interface Standup {
  id: string
  user_id: string
  date: string
  today_tasks: string
  tomorrow_tasks: string
  blockers: string | null
  mood: 'energetic' | 'stable' | 'tired' | 'stressed'
  progress_rate: 'all' | 'most' | 'half' | 'low'
  productivity_score: number
  work_minutes?: number
  created_at: string
  milestone_id?: string | null
  milestone?: {
    id: string
    title: string
  } | null
  user: {
    name: string
    email: string
    avatar_url: string
  }
}

interface Milestone {
  id: string
  title: string
  status: string
}

interface StandupClientProps {
  currentProfile: Profile
  teamProfiles: Profile[]
  initialMilestones: Milestone[]
}

const moodMap = {
  energetic: { label: 'طاقة عالية 🚀', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  stable: { label: 'طبيعي ومستقر 😊', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  tired: { label: 'متعب 🥱', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  stressed: { label: 'مضغوط جداً 🤯', color: 'bg-rose-500/10 text-rose-450 border-rose-500/20' }
}

const progressMap = {
  all: { label: 'أنجزت كل المخطط 💯', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  most: { label: 'أنجزت معظم المخطط 🔄', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  half: { label: 'أنجزت نصف المخطط ⏳', color: 'bg-amber-500/10 text-amber-450 border-amber-500/20' },
  low: { label: 'واجهت صعوبات ⚠️', color: 'bg-rose-500/10 text-rose-450 border-rose-500/20' }
}

export default function StandupClient({ currentProfile, initialMilestones }: StandupClientProps) {
  const [milestones] = useState<Milestone[]>(initialMilestones || [])
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })

  const [myJournal, setMyJournal] = useState<Standup | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null)

  // حالات النموذج
  const [todayTasks, setTodayTasks] = useState('')
  const [tomorrowTasks, setTomorrowTasks] = useState('')
  const [blockers, setBlockers] = useState('')
  const [mood, setMood] = useState<'energetic' | 'stable' | 'tired' | 'stressed'>('stable')
  const [progressRate, setProgressRate] = useState<'all' | 'most' | 'half' | 'low'>('most')
  const [productivityScore, setProductivityScore] = useState(5)
  const [hoveredStar, setHoveredStar] = useState<number | null>(null)
  const [workHours, setWorkHours] = useState<number>(0)
  const [workMinutes, setWorkMinutes] = useState<number>(0)
  const [isFormVisible, setIsFormVisible] = useState(false)
  const [milestoneId, setMilestoneId] = useState<string>('')

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, type })
  }

  // جلب يوميات اليوم المختار
  const fetchJournal = async (dateStr: string) => {
    try {
      setIsLoading(true)
      const data = await getDailyStandups(dateStr)
      // البحث عن تقرير المستخدم الحالي
      const userReport = (data as Standup[]).find(s => s.user_id === currentProfile.id)
      
      if (userReport) {
        setMyJournal(userReport)
        // تعبئة حقول النموذج تحسباً للتعديل
        setTodayTasks(userReport.today_tasks)
        setTomorrowTasks(userReport.tomorrow_tasks)
        setBlockers(userReport.blockers || '')
        setMood(userReport.mood)
        setProgressRate(userReport.progress_rate)
        setProductivityScore(userReport.productivity_score)
        setMilestoneId(userReport.milestone_id || '')
        const totalMins = userReport.work_minutes || 0
        setWorkHours(Math.floor(totalMins / 60))
        setWorkMinutes(totalMins % 60)
        setIsFormVisible(false) // إخفاء النموذج وعرض اليومية بشكل افتراضي
      } else {
        setMyJournal(null)
        // تفريغ حقول النموذج
        setTodayTasks('')
        setTomorrowTasks('')
        setBlockers('')
        setMood('stable')
        setProgressRate('most')
        setProductivityScore(5)
        setMilestoneId('')
        setWorkHours(0)
        setWorkMinutes(0)
        setIsFormVisible(true) // إظهار النموذج للكتابة إذا لم يكن هناك تقرير
      }
    } catch (err: any) {
      showToast('فشل تحميل اليوميات: ' + err.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchJournal(selectedDate)
  }, [selectedDate])

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!todayTasks.trim() || !tomorrowTasks.trim()) {
      showToast('يرجى ملء الأسئلة الرئيسية للجرنال اليومي', 'warning')
      return
    }

    startTransition(async () => {
      try {
        const totalMinutes = (workHours * 60) + workMinutes
        await submitDailyStandup(
          todayTasks,
          tomorrowTasks,
          blockers,
          mood,
          progressRate,
          productivityScore,
          selectedDate,
          milestoneId || null,
          totalMinutes
        )
        showToast('تم حفظ اليوميات بنجاح ✨', 'success')
        fetchJournal(selectedDate)
      } catch (err: any) {
        showToast('حدث خطأ أثناء حفظ اليوميات: ' + err.message, 'error')
      }
    })
  }

  const handleDeleteJournal = () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف يومياتك لهذا اليوم؟')) {
      return
    }

    startTransition(async () => {
      try {
        await deleteDailyStandup(selectedDate)
        showToast('تم حذف اليوميات بنجاح', 'success')
        fetchJournal(selectedDate)
      } catch (err: any) {
        showToast('حدث خطأ أثناء الحذف: ' + err.message, 'error')
      }
    })
  }

  return (
    <div className="flex-grow flex flex-col min-h-screen pb-24 md:pb-8">
      <Header user={currentProfile} />

      <main className="flex-grow max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="space-y-6">
          
          {/* رأس الصفحة والتحكم بالتاريخ */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-theme-border pb-5 text-right">
            <div>
              <h1 className="text-2xl font-black text-theme-text flex items-center gap-2 md:justify-start justify-center">
                <span>📓</span>
                <span>يوميات الإنتاجية (Journal)</span>
              </h1>
              <p className="text-xs text-theme-text-muted mt-1">مساحة خاصة بك لتسجيل إنجازاتك اليومية ومراقبة وتيرة عملك وحالتك المزاجية</p>
            </div>
            
            <div className="flex items-center gap-3 self-stretch md:self-auto w-full md:w-auto justify-end">
              {myJournal && !isFormVisible && (
                <button
                  type="button"
                  onClick={() => setIsFormVisible(true)}
                  className="text-xs font-bold px-4 py-2.5 rounded-xl border border-theme-border bg-theme-panel hover:bg-theme-bg text-theme-text transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Pencil className="w-3.5 h-3.5 text-theme-accent" />
                  <span>تعديل يوميات اليوم</span>
                </button>
              )}

              <div className="flex items-center gap-2 min-w-[180px]">
                <span className="text-xs font-bold text-theme-text-muted whitespace-nowrap">تاريخ اليومية:</span>
                <DatePicker value={selectedDate} onChange={setSelectedDate} className="py-2.5" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8">
            
            {/* حالة التحميل */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-24 text-theme-text-muted">
                <Loader2 className="w-8 h-8 animate-spin text-theme-accent mb-2" />
                <span className="text-xs">جاري تحميل يومياتك الخاصة...</span>
              </div>
            ) : isFormVisible ? (
              
              /* ================== نموذج الكتابة / التعديل ================== */
              <div className="bg-theme-panel rounded-3xl p-6 sm:p-8 border border-theme-border shadow-sm space-y-6 text-right relative overflow-hidden animate-modal-in">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-l from-theme-accent to-indigo-500"></div>
                
                <div>
                  <h3 className="text-base font-black text-theme-text flex items-center gap-2">
                    <PlusCircle className="w-5 h-5 text-theme-accent" />
                    <span>{myJournal ? 'تعديل مدونتك لليوم' : 'تدوين يوميات جديدة'}</span>
                  </h3>
                  <p className="text-[11px] text-theme-text-muted mt-0.5">سجل أداءك ومزاجك ليوم {selectedDate}</p>
                </div>

                <form onSubmit={handleFormSubmit} className="space-y-6">
                  
                  {/* 1. تقييم الإنتاجية الذاتي */}
                  <div className="bg-theme-bg/40 border border-theme-border/60 rounded-2xl p-4 space-y-3">
                    <label className="block text-xs font-bold text-theme-text">1. كيف تقيم إنجازك وإنتاجيتك اليوم؟</label>
                    <div className="flex items-center gap-2 justify-start" style={{ direction: 'ltr' }}>
                      <span className="text-xs font-bold text-theme-text-muted mr-3 pt-1 order-last">
                        {productivityScore} من 5
                      </span>
                      {[1, 2, 3, 4, 5].map((star) => {
                        const isLit = hoveredStar !== null ? star <= hoveredStar : star <= productivityScore
                        return (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setProductivityScore(star)}
                            onMouseEnter={() => setHoveredStar(star)}
                            onMouseLeave={() => setHoveredStar(null)}
                            className="p-1 cursor-pointer transition-all duration-150 transform hover:scale-125 focus:outline-none"
                          >
                            <Star 
                              className={`w-7 h-7 ${
                                isLit 
                                  ? 'text-amber-500 fill-amber-500 filter drop-shadow-[0_0_2px_rgba(245,158,11,0.4)]' 
                                  : 'text-theme-text-muted opacity-30'
                              } transition-colors`}
                            />
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* 2. الحالة المزاجية + وتيرة الإنجاز */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* الحالة المزاجية */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-theme-text">2. ما هي حالتك المزاجية ومستوى طاقتك اليوم؟</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(moodMap) as Array<keyof typeof moodMap>).map((key) => {
                          const selected = mood === key
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setMood(key)}
                              className={`flex items-center justify-center p-3.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer ${
                                selected 
                                  ? 'bg-theme-accent text-theme-panel border-theme-accent shadow-sm'
                                  : 'bg-theme-bg border-theme-border text-theme-text hover:border-theme-border/80'
                              }`}
                            >
                              {moodMap[key].label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* وتيرة الإنجاز */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-theme-text">3. ما مدى تحقيقك لأهداف اليوم المخطط لها؟</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(progressMap) as Array<keyof typeof progressMap>).map((key) => {
                          const selected = progressRate === key
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setProgressRate(key)}
                              className={`flex items-center justify-center p-3.5 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer ${
                                selected 
                                  ? 'bg-theme-accent text-theme-panel border-theme-accent shadow-sm'
                                  : 'bg-theme-bg border-theme-border text-theme-text hover:border-theme-border/80'
                              }`}
                            >
                              {progressMap[key].label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 3. ساعات العمل اليومية */}
                  <div className="bg-theme-bg/40 border border-theme-border/60 rounded-2xl p-4 space-y-2">
                    <label className="block text-xs font-bold text-theme-text">كم عدد ساعات العمل التي قضيتها اليوم؟</label>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 flex items-center gap-2">
                        <input 
                          type="number"
                          min={0}
                          max={24}
                          value={workHours || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0
                            setWorkHours(Math.min(24, Math.max(0, val)))
                          }}
                          className="w-full text-center bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl py-2.5 text-xs transition-all outline-none font-bold"
                          placeholder="0"
                        />
                        <span className="text-xs font-bold text-theme-text-muted">ساعة</span>
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        <input 
                          type="number"
                          min={0}
                          max={59}
                          value={workMinutes || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0
                            setWorkMinutes(Math.min(59, Math.max(0, val)))
                          }}
                          className="w-full text-center bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl py-2.5 text-xs transition-all outline-none font-bold"
                          placeholder="00"
                        />
                        <span className="text-xs font-bold text-theme-text-muted">دقيقة</span>
                      </div>
                    </div>
                  </div>

                  {/* 4. ماذا أنجزت اليوم؟ */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-theme-text">4. ماذا أنجزت اليوم باختصار؟ <span className="text-rose-500">*</span></label>
                    <textarea
                      rows={3}
                      value={todayTasks}
                      onChange={(e) => setTodayTasks(e.target.value)}
                      required
                      placeholder="مثال: أكملت تصوير فيديو المونتاج، ورتبت الأفكار وحللت البيانات..."
                      className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl p-3.5 text-xs transition-all outline-none resize-none leading-relaxed"
                    />
                  </div>

                  {/* 5. ماذا ستفعل غداً؟ */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-theme-text">5. ماذا ستقوم بفعله غداً؟ <span className="text-rose-500">*</span></label>
                    <textarea
                      rows={3}
                      value={tomorrowTasks}
                      onChange={(e) => setTomorrowTasks(e.target.value)}
                      required
                      placeholder="مثال: سأبدأ في مراجعة الصوت وتحرير الفيديو..."
                      className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl p-3.5 text-xs transition-all outline-none resize-none leading-relaxed"
                    />
                  </div>

                  {/* 6. ربط المحطة الكبرى */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-theme-text flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-theme-accent" />
                      <span>6. هل يخدم عملك اليوم أي محطة كبرى؟ (اختياري)</span>
                    </label>
                    <select 
                      value={milestoneId}
                      onChange={(e) => setMilestoneId(e.target.value)}
                      className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3.5 text-xs transition-all outline-none cursor-pointer font-semibold"
                    >
                      <option value="">أعمال عامة / أخرى</option>
                      {milestones.map((m) => (
                        <option key={m.id} value={m.id}>🎯 {m.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* 7. عقبات وملاحظات */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-theme-text">7. هل توجد عقبات أو ملاحظات إضافية؟ (اختياري)</label>
                    <textarea
                      rows={2}
                      value={blockers}
                      onChange={(e) => setBlockers(e.target.value)}
                      placeholder="اكتب أي تحديات واجهتك أو ملاحظات ترغب في تذكرها لاحقاً..."
                      className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl p-3.5 text-xs transition-all outline-none resize-none leading-relaxed"
                    />
                  </div>

                  {/* أزرار الإجراءات */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="flex-grow bg-theme-accent hover:bg-theme-accent-hover text-theme-panel font-bold py-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow active:scale-98"
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>جاري الحفظ...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>{myJournal ? 'حفظ التعديلات' : 'حفظ يوميات اليوم'}</span>
                        </>
                      )}
                    </button>
                    
                    {myJournal && (
                      <button
                        type="button"
                        onClick={() => setIsFormVisible(false)}
                        className="px-5 bg-theme-panel hover:bg-theme-bg text-theme-text border border-theme-border font-bold rounded-xl text-xs transition-all cursor-pointer active:scale-95"
                      >
                        إلغاء
                      </button>
                    )}
                  </div>
                </form>
              </div>
            ) : myJournal ? (
              
              /* ================== عرض الجرنال / اليوميات المسجلة ================== */
              <div className="space-y-6 animate-modal-in">
                
                {/* كرت التفاصيل الرئيسي */}
                <div className="bg-theme-panel border border-theme-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 text-right relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-l from-indigo-500 to-theme-accent"></div>
                  
                  {/* رأس الكرت */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme-border pb-5">
                    <div>
                      <h2 className="text-lg font-black text-theme-text flex items-center gap-2">
                        <FileText className="w-5 h-5 text-theme-accent" />
                        <span>يومياتك المسجلة</span>
                      </h2>
                      <p className="text-[11px] text-theme-text-muted mt-0.5">تاريخ التدوين: {myJournal.date}</p>
                    </div>

                    {/* تقييم النجوم وعرض الوقت */}
                    <div className="flex flex-wrap gap-2.5 items-center">
                      <div className="flex items-center gap-0.5 text-amber-500 bg-amber-500/5 px-2.5 py-1 rounded-xl border border-amber-500/10">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < myJournal.productivity_score 
                                ? 'fill-amber-500 text-amber-500' 
                                : 'text-theme-text-muted opacity-30'
                            }`}
                          />
                        ))}
                      </div>
                      
                      {myJournal.work_minutes ? (
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          ⏱️ {Math.floor(myJournal.work_minutes / 60)}س {myJournal.work_minutes % 60}د
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* شارات الحالة */}
                  <div className="flex flex-wrap gap-2">
                    <span className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border ${moodMap[myJournal.mood]?.color}`}>
                      المزاج: {moodMap[myJournal.mood]?.label}
                    </span>
                    <span className={`text-[10px] font-bold px-3 py-1.5 rounded-xl border ${progressMap[myJournal.progress_rate]?.color}`}>
                      الوتيرة: {progressMap[myJournal.progress_rate]?.label}
                    </span>
                    {myJournal.milestone && (
                      <span className="text-[10px] font-bold px-3 py-1.5 rounded-xl bg-theme-accent/10 text-theme-accent border border-theme-accent/20">
                        🎯 المحطة الكبرى: {myJournal.milestone.title}
                      </span>
                    )}
                  </div>

                  {/* تفاصيل الأسئلة */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    
                    {/* ماذا أنجزت اليوم */}
                    <div className="bg-theme-bg/30 border border-theme-border/40 rounded-2xl p-5 space-y-2">
                      <h4 className="text-xs font-black text-theme-accent">✍️ ماذا أنجزت اليوم؟</h4>
                      <p className="text-xs text-theme-text leading-relaxed whitespace-pre-line font-medium">
                        {myJournal.today_tasks}
                      </p>
                    </div>

                    {/* خطة الغد */}
                    <div className="bg-theme-bg/30 border border-theme-border/40 rounded-2xl p-5 space-y-2">
                      <h4 className="text-xs font-black text-theme-accent-hover">🎯 خطة الغد والخطوات القادمة</h4>
                      <p className="text-xs text-theme-text leading-relaxed whitespace-pre-line font-medium">
                        {myJournal.tomorrow_tasks}
                      </p>
                    </div>
                  </div>

                  {/* ملاحظات وعقبات */}
                  {myJournal.blockers?.trim() && (
                    <div className="bg-rose-500/[0.03] border border-rose-500/20 rounded-2xl p-5 space-y-2">
                      <h4 className="text-xs font-black text-rose-500 flex items-center gap-1.5">
                        <span>⚠️ عقبات وملاحظات مهمة</span>
                      </h4>
                      <p className="text-xs text-rose-600 dark:text-rose-450 leading-relaxed whitespace-pre-line font-medium">
                        {myJournal.blockers}
                      </p>
                    </div>
                  )}

                  {/* كعب الكارت للأفعال */}
                  <div className="border-t border-theme-border/60 pt-4 flex items-center justify-between text-[10px] text-theme-text-muted">
                    <span>
                      نُشر في: {new Date(myJournal.created_at).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    
                    <button
                      type="button"
                      onClick={handleDeleteJournal}
                      disabled={isPending}
                      className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 hover:text-rose-600 border border-rose-500/20 font-bold rounded-xl text-[10px] transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف اليومية</span>
                    </button>
                  </div>
                </div>

              </div>
            ) : null}

          </div>

        </div>
      </main>

      {/* تنبيهات التوست */}
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
