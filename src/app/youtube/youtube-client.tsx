'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import { 
  Play, 
  Plus, 
  Film, 
  Clock, 
  CheckCircle, 
  Loader2, 
  X, 
  BarChart2, 
  Eye, 
  BookOpen, 
  Layers,
  Settings,
  ImagePlus,
  Zap,
  Timer,
  Gauge,
  Link2
} from 'lucide-react'
import { createYoutubeVideo, uploadYoutubeThumbnail } from '../actions'

interface Profile {
  id: string
  name: string
  email: string
  role: string
  avatar_url: string
}

interface YoutubeVideo {
  id: string
  title: string
  description: string
  thumbnail_url: string
  status: 'planning' | 'in_progress' | 'completed' | 'published'
  target_hours: number
  content_type?: 'video' | 'reel'
  duration_seconds?: number
  created_at: string
  total_hours?: number
  progress?: number
  total_tasks?: number
  completed_tasks?: number
}

interface Analytics {
  totalVideos: number
  completedVideosCount: number
  totalHours: number
  avgHoursPerVideo: number
  phaseAverages: {
    scripting: number
    recording: number
    editing: number
    publishing: number
  }
  mostTimeConsumingPhase: string
  videoStats: any[]
  reelsCount?: number
  efficiency?: {
    avgHoursPerMinute: number
    bestVideo: { title: string; hpm: number; hours: number; durationMin: number } | null
    hardestVideo: { title: string; hpm: number; hours: number; durationMin: number } | null
    trackedVideosCount: number
    totalContentMinutes: number
  }
}

// تنسيق مدة المحتوى النهائي للعرض (ثواني أو دقائق)
const formatDuration = (seconds?: number) => {
  if (!seconds || seconds <= 0) return null
  if (seconds < 60) return `${seconds} ث`
  const mins = seconds / 60
  return Number.isInteger(mins) ? `${mins} د` : `${mins.toFixed(1)} د`
}

interface YoutubeClientProps {
  currentProfile: Profile
  initialVideos: YoutubeVideo[]
  analytics: Analytics
}

const statusMap = {
  planning: { label: 'تخطيط وتحضير 📝', color: 'bg-neutral-500/10 text-theme-text-muted border-theme-border' },
  in_progress: { label: 'قيد الإنتاج 🎬', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  completed: { label: 'جاهز ومكتمل ✅', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  published: { label: 'نُشر بالقناة 🚀', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
}

export default function YoutubeClient({ currentProfile, initialVideos = [], analytics }: YoutubeClientProps) {
  const [videos, setVideos] = useState<YoutubeVideo[]>(initialVideos)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null)

  // تبويب العرض الحالي (فيديوهات طويلة / ريلز)
  const [activeTab, setActiveTab] = useState<'video' | 'reel'>('video')

  // نموذج الفيديو الجديد
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newThumbnail, setNewThumbnail] = useState('')
  const [newTargetHours, setNewTargetHours] = useState(20)
  const [newContentType, setNewContentType] = useState<'video' | 'reel'>('video')
  const [newDurationValue, setNewDurationValue] = useState(0)

  // حالة رفع صورة الغلاف من الجهاز
  const [thumbFile, setThumbFile] = useState<File | null>(null)
  const [thumbPreview, setThumbPreview] = useState('')
  const [showThumbUrlInput, setShowThumbUrlInput] = useState(false)

  const isReelMode = newContentType === 'reel'

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, type })
  }

  // الفيديوهات المعروضة حسب التبويب النشط
  const filteredVideos = videos.filter(v => (v.content_type || 'video') === activeTab)
  const videosCount = videos.filter(v => (v.content_type || 'video') === 'video').length
  const reelsCount = videos.filter(v => v.content_type === 'reel').length

  const openCreateModal = () => {
    setNewContentType(activeTab)
    setNewTargetHours(activeTab === 'reel' ? 6 : 20)
    setIsCreateModalOpen(true)
  }

  const closeCreateModal = () => {
    setIsCreateModalOpen(false)
    setThumbFile(null)
    setThumbPreview('')
    setShowThumbUrlInput(false)
    setNewDurationValue(0)
  }

  const handleThumbFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('يجب اختيار ملف صورة صالح', 'warning')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('حجم الصورة يجب أن يكون أقل من 5 ميغابايت', 'warning')
      return
    }
    setThumbFile(file)
    setThumbPreview(URL.createObjectURL(file))
    setNewThumbnail('')
  }

  const clearThumbFile = () => {
    if (thumbPreview) URL.revokeObjectURL(thumbPreview)
    setThumbFile(null)
    setThumbPreview('')
  }

  const handleCreateVideoSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) {
      showToast('عنوان الفيديو مطلوب', 'warning')
      return
    }

    startTransition(async () => {
      try {
        // رفع الصورة المصغرة سحابياً إن تم اختيار ملف من الجهاز
        let finalThumbnail = newThumbnail.trim()
        if (thumbFile) {
          finalThumbnail = await uploadYoutubeThumbnail(`draft_${Date.now()}`, thumbFile)
        }

        // تحويل المدة للثواني (الفيديوهات بالدقائق والريلز بالثواني)
        const durationSeconds = isReelMode ? Math.round(newDurationValue) : Math.round(newDurationValue * 60)

        const created = await createYoutubeVideo(
          newTitle.trim(),
          newDescription.trim(),
          finalThumbnail,
          newTargetHours,
          newContentType,
          durationSeconds
        )
        showToast(isReelMode ? 'تمت إضافة الريلز الجديد بنجاح! ⚡' : 'تمت إضافة الفيديو الجديد بنجاح! 🎬', 'success')
        
        // تحديث القائمة محلياً
        setVideos([created, ...videos])
        
        // تفريغ المدخلات وإغلاق المودال
        setNewTitle('')
        setNewDescription('')
        setNewThumbnail('')
        setNewTargetHours(newContentType === 'reel' ? 6 : 20)
        setNewDurationValue(0)
        setActiveTab(newContentType)
        closeCreateModal()
      } catch (err: any) {
        showToast('فشل إنشاء الفيديو: ' + err.message, 'error')
      }
    })
  }

  return (
    <div className="flex-grow flex flex-col min-h-screen pb-24 md:pb-8">
      <Header user={currentProfile} />

      <main className="flex-grow max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="space-y-8">
          
          {/* ترويسة الصفحة */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-theme-border pb-5 text-right">
            <div>
              <h1 className="text-2xl font-black text-theme-text flex items-center gap-2 justify-center md:justify-start">
                <span>🎬</span>
                <span>استوديو بارون | Baron Studio</span>
              </h1>
              <p className="text-xs text-theme-text-muted mt-1">تتبع ساعات إنتاج كل فيديو ومقارنة الأداء لتقليل وقت الصنع وجودة أعلى</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto self-stretch md:self-auto">
              <Link
                href="/youtube/settings"
                className="flex-1 md:flex-initial px-5 py-3 bg-theme-panel hover:bg-theme-bg border border-theme-border text-theme-text font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Settings className="w-4 h-4 text-theme-accent" />
                <span>إعدادات أسلوب الـ AI 🤖</span>
              </Link>
              
              <button
                onClick={openCreateModal}
                className="flex-1 md:flex-initial px-5 py-3 bg-theme-accent hover:bg-theme-accent-hover text-theme-panel font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة جديد</span>
              </button>
            </div>
          </div>

          {/* لوحة المؤشرات العلوية */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* إجمالي الفيديوهات */}
            <div className="bg-theme-panel rounded-2xl p-4 border border-theme-border shadow-sm flex items-center justify-between text-right relative overflow-hidden">
              <div className="absolute top-0 right-0 bottom-0 w-1 bg-rose-500"></div>
              <div className="space-y-0.5 pr-2">
                <p className="text-[10px] text-theme-text-muted font-bold">إجمالي الفيديوهات</p>
                <h3 className="text-xl font-black text-theme-text font-mono">
                  {analytics.totalVideos}
                </h3>
              </div>
              <Film className="w-5 h-5 text-rose-500 shrink-0" />
            </div>

            {/* إجمالي الساعات */}
            <div className="bg-theme-panel rounded-2xl p-4 border border-theme-border shadow-sm flex items-center justify-between text-right relative overflow-hidden">
              <div className="absolute top-0 right-0 bottom-0 w-1 bg-indigo-500"></div>
              <div className="space-y-0.5 pr-2">
                <p className="text-[10px] text-theme-text-muted font-bold">إجمالي ساعات الصنع</p>
                <h3 className="text-xl font-black text-theme-text font-mono">
                  {analytics.totalHours}س
                </h3>
              </div>
              <Clock className="w-5 h-5 text-indigo-400 shrink-0" />
            </div>

            {/* متوسط ساعات الفيديو */}
            <div className="bg-theme-panel rounded-2xl p-4 border border-theme-border shadow-sm flex items-center justify-between text-right relative overflow-hidden">
              <div className="absolute top-0 right-0 bottom-0 w-1 bg-emerald-500"></div>
              <div className="space-y-0.5 pr-2">
                <p className="text-[10px] text-theme-text-muted font-bold">متوسط الساعات / فيديو</p>
                <h3 className="text-xl font-black text-theme-text font-mono">
                  {analytics.avgHoursPerVideo}س
                </h3>
              </div>
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            </div>

            {/* أطول مرحلة وقتاً */}
            <div className="bg-theme-panel rounded-2xl p-4 border border-theme-border shadow-sm flex items-center justify-between text-right relative overflow-hidden">
              <div className="absolute top-0 right-0 bottom-0 w-1 bg-amber-500"></div>
              <div className="space-y-0.5 pr-2 min-w-0">
                <p className="text-[10px] text-theme-text-muted font-bold">المرحلة الأكثر استهلاكاً للوقت</p>
                <h3 className="text-xs font-black text-theme-text truncate">
                  {analytics.mostTimeConsumingPhase}
                </h3>
              </div>
              <BarChart2 className="w-5 h-5 text-amber-500 shrink-0" />
            </div>
          </div>

          {/* لوحة توزيع أوقات المراحل الأربعة لمرحلة الإنتاج */}
          <div className="bg-theme-panel rounded-3xl p-6 border border-theme-border shadow-sm text-right space-y-4">
            <div>
              <h3 className="text-sm font-black text-theme-text flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-theme-accent" />
                <span>متوسط الساعات لكل مرحلة إنتاج (الفيديوهات المنجزة)</span>
              </h3>
              <p className="text-[10px] text-theme-text-muted mt-0.5">تحليل وتوزيع الساعات على الخطوات الأربع لتسهيل خفض الساعات الكلية للفيديو</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
              {/* كتابة السيناريو */}
              <div className="bg-theme-bg/40 border border-theme-border/60 rounded-xl p-3.5 space-y-1">
                <span className="text-[10px] font-bold text-theme-text-muted">✍️ السيناريو والكتابة</span>
                <h4 className="text-lg font-black text-theme-text font-mono">{analytics.phaseAverages.scripting}س</h4>
              </div>

              {/* التسجيل والتصوير */}
              <div className="bg-theme-bg/40 border border-theme-border/60 rounded-xl p-3.5 space-y-1">
                <span className="text-[10px] font-bold text-theme-text-muted">🎙️ التصوير والتسجيل</span>
                <h4 className="text-lg font-black text-theme-text font-mono">{analytics.phaseAverages.recording}س</h4>
              </div>

              {/* المونتاج والتحريك */}
              <div className="bg-theme-bg/40 border border-theme-border/60 rounded-xl p-3.5 space-y-1">
                <span className="text-[10px] font-bold text-theme-text-muted">🎬 المونتاج والتحريك</span>
                <h4 className="text-lg font-black text-theme-text font-mono">{analytics.phaseAverages.editing}س</h4>
              </div>

              {/* النشر والترويج */}
              <div className="bg-theme-bg/40 border border-theme-border/60 rounded-xl p-3.5 space-y-1">
                <span className="text-[10px] font-bold text-theme-text-muted">🎨 الغلاف والنشر</span>
                <h4 className="text-lg font-black text-theme-text font-mono">{analytics.phaseAverages.publishing}س</h4>
              </div>
            </div>
          </div>

          {/* لوحة كفاءة الإنتاج (ساعات الصنع لكل دقيقة محتوى) */}
          {analytics.efficiency && analytics.efficiency.trackedVideosCount > 0 && (
            <div className="bg-theme-panel rounded-3xl p-6 border border-theme-border shadow-sm text-right space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-sm font-black text-theme-text flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-emerald-400" />
                    <span>كفاءة الإنتاج (ساعات الصنع لكل دقيقة محتوى)</span>
                  </h3>
                  <p className="text-[10px] text-theme-text-muted mt-0.5">مقياس عادل يقارن الفيديوهات مهما اختلفت مدتها — كلما انخفض الرقم أصبح إنتاجك أسرع</p>
                </div>
                <span className="text-[9px] font-bold px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  مبني على {analytics.efficiency.trackedVideosCount} محتوى منجز بمدة محددة
                </span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                {/* المتوسط العام للكفاءة */}
                <div className="bg-theme-bg/40 border border-theme-border/60 rounded-xl p-3.5 space-y-1">
                  <span className="text-[10px] font-bold text-theme-text-muted">⚡ متوسط الكفاءة العام</span>
                  <h4 className="text-lg font-black text-theme-text font-mono">{analytics.efficiency.avgHoursPerMinute} س/د</h4>
                </div>

                {/* الأكثر كفاءة */}
                <div className="bg-theme-bg/40 border border-emerald-500/20 rounded-xl p-3.5 space-y-1 min-w-0">
                  <span className="text-[10px] font-bold text-theme-text-muted">🏆 الأكثر كفاءة (أسرع إنتاج)</span>
                  <h4 className="text-xs font-black text-emerald-400 truncate" title={analytics.efficiency.bestVideo?.title}>
                    {analytics.efficiency.bestVideo?.title || '—'}
                  </h4>
                  <p className="text-[10px] font-mono text-theme-text-muted">
                    {analytics.efficiency.bestVideo ? `${analytics.efficiency.bestVideo.hpm} س/د · ${analytics.efficiency.bestVideo.hours}س لـ ${analytics.efficiency.bestVideo.durationMin}د` : ''}
                  </p>
                </div>

                {/* إجمالي المحتوى المنتج */}
                <div className="bg-theme-bg/40 border border-theme-border/60 rounded-xl p-3.5 space-y-1 col-span-2 lg:col-span-1">
                  <span className="text-[10px] font-bold text-theme-text-muted">🎞️ إجمالي مدة المحتوى المحدد</span>
                  <h4 className="text-lg font-black text-theme-text font-mono">{analytics.efficiency.totalContentMinutes} دقيقة</h4>
                </div>
              </div>
            </div>
          )}

          {/* شبكة المحتوى مع تبويبات الفيديوهات والريلز */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* تبويبات نوع المحتوى */}
              <div className="flex bg-theme-panel border border-theme-border rounded-xl p-1 gap-1 w-full sm:w-auto">
                <button
                  onClick={() => setActiveTab('video')}
                  className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === 'video'
                      ? 'bg-theme-accent text-theme-panel shadow-sm'
                      : 'text-theme-text-muted hover:text-theme-text'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>الفيديوهات الطويلة</span>
                  <span className={`font-mono ${activeTab === 'video' ? 'opacity-70' : 'opacity-50'}`}>({videosCount})</span>
                </button>
                <button
                  onClick={() => setActiveTab('reel')}
                  className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === 'reel'
                      ? 'bg-theme-accent text-theme-panel shadow-sm'
                      : 'text-theme-text-muted hover:text-theme-text'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>الريلز</span>
                  <span className={`font-mono ${activeTab === 'reel' ? 'opacity-70' : 'opacity-50'}`}>({reelsCount})</span>
                </button>
              </div>

              <h2 className="text-sm font-black text-theme-text text-right flex items-center gap-1.5 sm:order-first">
                {activeTab === 'video' ? (
                  <>
                    <span>📋</span>
                    <span>قائمة فيديوهات القناة</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>قائمة الريلز والمحتوى القصير</span>
                  </>
                )}
              </h2>
            </div>

            {filteredVideos.length === 0 ? (
              <div className="bg-theme-panel border border-dashed border-theme-border rounded-3xl p-16 text-center">
                {activeTab === 'video' ? (
                  <>
                    <Film className="w-12 h-12 text-theme-text-muted opacity-50 mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-theme-text">لا توجد فيديوهات مسجلة حالياً</h3>
                    <p className="text-xs text-theme-text-muted mt-1 max-w-xs mx-auto">
                      ابدأ بإنشاء فيديو جديد لمراقبة الساعات المخصصة لإنتاجه بدقة وتقليل وقت الصنع.
                    </p>
                  </>
                ) : (
                  <>
                    <Zap className="w-12 h-12 text-theme-text-muted opacity-50 mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-theme-text">لا توجد ريلز مسجلة حالياً</h3>
                    <p className="text-xs text-theme-text-muted mt-1 max-w-xs mx-auto">
                      أنشئ أول ريلز لتتبع ساعات صنعه وقياس كفاءتك في المحتوى القصير.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {filteredVideos.map((video) => {
                  // جلب إحصائيات الفيديو من محلي أو حساب الساعات
                  const target = video.target_hours || 20
                  
                  // العثور على الإحصائيات الفعالة للفيديو من مصفوفة التحليل
                  const stat = analytics.videoStats?.find(s => s.id === video.id)
                  const actualHours = stat ? stat.hours : 0
                  const hoursPerMinute = stat?.hoursPerMinute ?? null

                  // نسبة تجاوز الساعات
                  const overLimit = actualHours > target

                  // شارة المدة حسب نوع المحتوى
                  const durationBadge = formatDuration(video.duration_seconds)

                  return (
                    <Link
                      key={video.id}
                      href={`/youtube/${video.id}`}
                      className="bg-theme-panel border border-theme-border hover:border-theme-accent/30 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 text-right flex flex-col group"
                    >
                      {/* غلاف الفيديو */}
                      <div className="h-40 bg-theme-bg relative overflow-hidden shrink-0">
                        <img 
                          src={video.thumbnail_url} 
                          alt={video.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=300&auto=format&fit=crop'
                          }}
                        />
                        <div className="absolute top-3 right-3">
                          <span className={`text-[9px] font-bold px-2 py-1 rounded-lg border shadow-sm ${statusMap[video.status]?.color} backdrop-blur-xs`}>
                            {statusMap[video.status]?.label}
                          </span>
                        </div>
                        {durationBadge && (
                          <div className="absolute bottom-3 right-3">
                            <span className="text-[9px] font-bold font-mono px-2 py-1 rounded-lg bg-black/60 text-white backdrop-blur-xs flex items-center gap-1">
                              <Timer className="w-2.5 h-2.5" />
                              {durationBadge}
                            </span>
                          </div>
                        )}
                        {video.content_type === 'reel' && (
                          <div className="absolute top-3 left-3">
                            <span className="text-[9px] font-bold px-2 py-1 rounded-lg bg-amber-500/90 text-white shadow-sm backdrop-blur-xs">
                              ⚡ ريلز
                            </span>
                          </div>
                        )}
                      </div>

                      {/* محتوى الكارت */}
                      <div className="p-4 flex-grow flex flex-col justify-between space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-theme-text line-clamp-1 leading-relaxed">
                            {video.title}
                          </h4>
                          <p className="text-[10px] text-theme-text-muted mt-1 line-clamp-2 leading-relaxed">
                            {video.description || 'لا يوجد وصف تفصيلي...'}
                          </p>
                        </div>

                        {/* إحصائيات الساعات والبار */}
                        <div className="space-y-2 border-t border-theme-border/60 pt-3">
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span className="text-theme-text-muted">الساعات المستغرق:</span>
                            <span className={`font-mono font-black ${overLimit ? 'text-rose-500' : 'text-indigo-400'}`}>
                              {actualHours} / {target}ساعة
                            </span>
                          </div>

                          {/* شريط الساعات مقارنة بالهدف */}
                          <div className="h-1.5 w-full bg-theme-bg rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                overLimit ? 'bg-rose-500' : 'bg-indigo-500'
                              }`} 
                              style={{ width: `${Math.min(100, (actualHours / target) * 100)}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            {overLimit && (
                              <span className="text-[8px] text-rose-500 font-bold">
                                ⚠️ تجاوزت عدد الساعات المستهدفة بـ {(actualHours - target).toFixed(1)}س
                              </span>
                            )}
                            {hoursPerMinute !== null && (
                              <span className="text-[8px] font-bold font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md ms-auto" title="ساعات الصنع لكل دقيقة من مدة المحتوى">
                                ⚡ {hoursPerMinute} س/د
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </main>

      {/* ================== مودال إضافة محتوى جديد ================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={closeCreateModal}></div>
          
          <div className="relative bg-theme-panel w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-theme-border animate-modal-in z-10 text-right space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-theme-border pb-4">
              <div>
                <h3 className="text-base font-black text-theme-text flex items-center gap-2">
                  <Film className="w-5 h-5 text-theme-accent" />
                  <span>إضافة محتوى جديد</span>
                </h3>
                <p className="text-[10px] text-theme-text-muted mt-0.5">أدخل تفاصيل المحتوى الذي تخطط لصناعته</p>
              </div>
              <button 
                onClick={closeCreateModal}
                className="p-1 text-theme-text-muted hover:text-theme-text rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVideoSubmit} className="space-y-4">
              {/* اختيار نوع المحتوى */}
              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">نوع المحتوى</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setNewContentType('video'); setNewTargetHours(20) }}
                    className={`px-3 py-3 rounded-xl text-[11px] font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      !isReelMode
                        ? 'bg-theme-accent/10 border-theme-accent text-theme-accent'
                        : 'bg-theme-input border-theme-border text-theme-text-muted hover:text-theme-text'
                    }`}
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>🎬 فيديو طويل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNewContentType('reel'); setNewTargetHours(6) }}
                    className={`px-3 py-3 rounded-xl text-[11px] font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      isReelMode
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-500'
                        : 'bg-theme-input border-theme-border text-theme-text-muted hover:text-theme-text'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>⚡ ريلز قصير</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">{isReelMode ? 'عنوان الريلز' : 'عنوان الفيديو'}</label>
                <input 
                  type="text" 
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  placeholder={isReelMode ? 'عنوان جذاب ومختصر للريلز...' : 'أدخل عنواناً جذاباً للفيديو...'}
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">وصف ومحتوى {isReelMode ? 'الريلز' : 'الفيديو'}</label>
                <textarea 
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  placeholder="الأفكار الأساسية للسيناريو والنقاط التي سنتحدث عنها..."
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none resize-none leading-relaxed" 
                ></textarea>
              </div>

              {/* مدة المحتوى النهائي */}
              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5 flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{isReelMode ? 'مدة الريلز النهائية (بالثواني)' : 'مدة الفيديو النهائية (بالدقائق)'}</span>
                </label>
                <input 
                  type="number" 
                  value={newDurationValue || ''}
                  onChange={(e) => setNewDurationValue(Math.max(0, parseFloat(e.target.value) || 0))}
                  min="0"
                  step={isReelMode ? '1' : '0.5'}
                  placeholder={isReelMode ? 'مثال: 45 ثانية (يُستخدم لحساب كفاءة الإنتاج)' : 'مثال: 8 دقائق (يُستخدم لحساب كفاءة الإنتاج)'}
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none font-bold" 
                />
                <p className="text-[9px] text-theme-text-muted mt-1">يمكنك تركها فارغة الآن وتحديثها لاحقاً عند اكتمال المدة الفعلية</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">ساعات العمل المستهدفة</label>
                <input 
                  type="number" 
                  value={newTargetHours}
                  onChange={(e) => setNewTargetHours(Math.max(1, parseInt(e.target.value) || 20))}
                  required
                  min="1"
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none font-bold" 
                />
              </div>

              {/* الصورة المصغرة */}
              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5 flex items-center gap-1.5">
                  <ImagePlus className="w-3.5 h-3.5 text-theme-accent" />
                  <span>الصورة المصغرة (Thumbnail)</span>
                </label>
                
                {thumbPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-theme-border group/thumb">
                    <img src={thumbPreview} alt="معاينة الغلاف" className="w-full h-36 object-cover" />
                    <button
                      type="button"
                      onClick={clearThumbFile}
                      className="absolute top-2 left-2 p-1.5 bg-black/60 hover:bg-rose-500 text-white rounded-lg transition-all cursor-pointer"
                      title="إزالة الصورة"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-2 right-2 text-[8px] font-bold bg-black/60 text-white px-2 py-0.5 rounded-md">
                      {thumbFile?.name}
                    </span>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-1.5 h-24 border-2 border-dashed border-theme-border hover:border-theme-accent/50 rounded-xl cursor-pointer transition-all bg-theme-input/50 hover:bg-theme-input">
                    <ImagePlus className="w-6 h-6 text-theme-text-muted" />
                    <span className="text-[10px] font-bold text-theme-text-muted">اضغط لرفع صورة من جهازك (حتى 5MB)</span>
                    <input 
                      type="file" 
                      accept="image/*"
                      className="hidden" 
                      onChange={handleThumbFileChange}
                    />
                  </label>
                )}

                {!showThumbUrlInput && !thumbPreview && (
                  <button
                    type="button"
                    onClick={() => setShowThumbUrlInput(true)}
                    className="mt-2 text-[10px] font-bold text-theme-accent hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Link2 className="w-3 h-3" />
                    <span>أو الصق رابط صورة بدلاً من الرفع</span>
                  </button>
                )}

                {showThumbUrlInput && !thumbFile && (
                  <input 
                    type="url" 
                    value={newThumbnail}
                    onChange={(e) => setNewThumbnail(e.target.value)}
                    placeholder="https://..."
                    className="mt-2 w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none font-mono" 
                  />
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-theme-accent hover:bg-theme-accent-hover disabled:bg-neutral-300 text-theme-panel font-bold py-3.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{thumbFile ? 'جاري رفع الغلاف وإضافة المحتوى...' : 'جاري إضافة المحتوى...'}</span>
                    </>
                  ) : (
                    <span>{isReelMode ? 'تأكيد وإضافة الريلز' : 'تأكيد وإضافة الفيديو'}</span>
                  )}
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
