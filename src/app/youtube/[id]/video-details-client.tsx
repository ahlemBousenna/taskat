'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import { 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  Edit, 
  Trash2, 
  X, 
  Loader2, 
  ListTodo,
  ExternalLink,
  Layers,
  FileText,
  Plus,
  Check,
  Play,
  Square,
  Settings,
  Calendar,
  ImagePlus,
  Timer,
  Gauge,
  Link2
} from 'lucide-react'
import { 
  updateYoutubeVideo, 
  deleteYoutubeVideo, 
  updateYoutubeVideoSteps,
  uploadYoutubeThumbnail,
  getAIReferenceScripts,
  generateYoutubeScript,
  generateStoryboardPrompts,
  generateYoutubeSEO,
  updateYoutubeVideoScript,
  updateYoutubeVideoStoryboard
} from '../../actions'

interface Profile {
  id: string
  name: string
  email: string
  role: string
  avatar_url: string
}

interface Video {
  id: string
  title: string
  description: string
  thumbnail_url: string
  status: 'planning' | 'in_progress' | 'completed' | 'published'
  target_hours: number
  content_type?: 'video' | 'reel'
  duration_seconds?: number
  created_at: string
  completed_at: string | null
  totalHours: number
  totalTasks: number
  completedTasks: number
  progress: number
  script?: string
  storyboard?: any[]
  steps?: Array<{
    id: string
    title: string
    completed: boolean
    work_minutes: number
    phase: string
  }>
}

interface PhaseDetail {
  name: string
  minutes: number
  hours: number
  tasksCount: number
  completedCount: number
}

interface PhaseBreakdown {
  scripting: PhaseDetail
  recording: PhaseDetail
  editing: PhaseDetail
  publishing: PhaseDetail
  other: PhaseDetail
}

interface VideoTask {
  id: string
  title: string
  status: string
  work_minutes: number
  video_phase: string
  completed_date?: string
  due_date?: string
  group?: {
    id: string
    name: string
    color: string
  } | null
}

interface VideoDetailsClientProps {
  currentProfile: Profile
  video: Video
  phases: PhaseBreakdown
  initialTasks: VideoTask[]
}

const statusMap = {
  planning: { label: 'تخطيط وتحضير 📝', color: 'bg-neutral-500/10 text-theme-text-muted border-theme-border' },
  in_progress: { label: 'قيد الإنتاج 🎬', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  completed: { label: 'جاهز ومكتمل ✅', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  published: { label: 'نُشر بالقناة 🚀', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
}

const taskStatusMap: Record<string, string> = {
  'not_started': 'لم تبدأ بعد',
  'in_progress': 'قيد التنفيذ',
  'completed': 'مكتمل',
  'late': 'متأخر'
}

export default function VideoDetailsClient({ currentProfile, video: initialVideo, phases, initialTasks = [] }: VideoDetailsClientProps) {
  const router = useRouter()
  const [video, setVideo] = useState<Video>(initialVideo)
  const [tasks] = useState<VideoTask[]>(initialTasks)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null)

  // نموذج التعديل
  const [editTitle, setEditTitle] = useState(video.title)
  const [editDescription, setEditDescription] = useState(video.description || '')
  const [editThumbnail, setEditThumbnail] = useState(video.thumbnail_url || '')
  const [editTargetHours, setEditTargetHours] = useState(video.target_hours)
  const [editStatus, setEditStatus] = useState<Video['status']>(video.status)
  const [editDurationValue, setEditDurationValue] = useState(() => {
    if (!video.duration_seconds) return 0
    return (video.content_type === 'reel') ? video.duration_seconds : video.duration_seconds / 60
  })

  // حالة رفع صورة الغلاف من الجهاز
  const [thumbFile, setThumbFile] = useState<File | null>(null)
  const [thumbPreview, setThumbPreview] = useState('')
  const [showThumbUrlInput, setShowThumbUrlInput] = useState(false)

  const isReelVideo = video.content_type === 'reel'

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
    setEditThumbnail('')
  }

  const clearThumbFile = () => {
    if (thumbPreview) URL.revokeObjectURL(thumbPreview)
    setThumbFile(null)
    setThumbPreview('')
  }

  // ================== حالات وإجراءات خطوات الإنتاج المرنة ==================
  const [steps, setSteps] = useState<any[]>(video.steps || [])
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [logHours, setLogHours] = useState(0)
  const [logMinutes, setLogMinutes] = useState(0)

  // إضافة خطوة جديدة
  const [newStepName, setNewStepName] = useState('')
  const [newStepPhase, setNewStepPhase] = useState<'scripting' | 'recording' | 'editing' | 'publishing' | 'other'>('editing')

  // تعديل اسم خطوة
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  // ================== حالات الذكاء الاصطناعي baron AI Studio ==================
  const [profile] = useState<any>(currentProfile || { is_ai_enabled: false })
  const [activeTab, setActiveTab] = useState<'checklist' | 'script' | 'storyboard' | 'seo'>('checklist')
  const [topic, setTopic] = useState('')
  const [lengthMinutes, setLengthMinutes] = useState(5)
  const [tone, setTone] = useState('غموض وإثارة وتشويق 🎭')
  const [pacing, setPacing] = useState('سريع وديناميكي ⚡')
  const [scriptContent, setScriptContent] = useState(video.script || '')
  
  // السكربتات المرجعية للاستنساخ
  const [referenceScripts, setReferenceScripts] = useState<any[]>([])
  const [selectedRefIds, setSelectedRefIds] = useState<string[]>([])
  
  // لقطات السيناريو البصري (Storyboard)
  const [storyboard, setStoryboard] = useState<any[]>(video.storyboard || [])
  const [splitMethod, setSplitMethod] = useState<'story' | 'words' | 'sentences'>('story')
  
  // بيانات السيو والعناوين
  const [seoData, setSeoData] = useState<any>(null)
  
  // حالات التحميل الفرعية
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false)
  const [isGeneratingSEO, setIsGeneratingSEO] = useState(false)

  // ================== حالات تقويم نشاط الفيديو المخصص ==================
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth() + 1)
  const [calYear, setCalYear] = useState(() => new Date().getFullYear())
  const [selectedCalDate, setSelectedCalDate] = useState<string>('')
  const [selectedDayTasks, setSelectedDayTasks] = useState<VideoTask[]>([])
  const [isCalModalOpen, setIsCalModalOpen] = useState(false)

  // جلب السكربتات المرجعية من المخزن
  useEffect(() => {
    if (profile.is_ai_enabled) {
      const loadRefScripts = async () => {
        try {
          const data = await getAIReferenceScripts()
          if (data && Array.isArray(data)) {
            setReferenceScripts(data)
          }
        } catch (err) {
          console.error("Error loading reference scripts:", err)
        }
      }
      loadRefScripts()
    }
  }, [profile.is_ai_enabled])

  const handleToggleRefScriptId = (refId: string) => {
    setSelectedRefIds(prev => 
      prev.includes(refId) ? prev.filter(id => id !== refId) : [...prev, refId]
    )
  }

  const handleGenerateScript = async () => {
    if (!topic.trim()) {
      showToast('يرجى كتابة فكرة أو موضوع السيناريو أولاً.', 'warning')
      return
    }
    setIsGeneratingScript(true)
    try {
      const res = await generateYoutubeScript(
        video.id,
        topic.trim(),
        lengthMinutes,
        tone,
        pacing,
        selectedRefIds
      )
      if (res && res.success && res.data) {
        setScriptContent(res.data)
        setVideo(prev => ({ ...prev, script: res.data }))
        showToast('تم صياغة وحفظ السكربت بنجاح بأسلوبك! 🪄', 'success')
      } else {
        showToast(res?.error || 'حدث خطأ أثناء توليد السكربت.', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ أثناء توليد السكربت.', 'error')
    } finally {
      setIsGeneratingScript(false)
    }
  }

  const handleSaveScriptManual = async () => {
    try {
      await updateYoutubeVideoScript(video.id, scriptContent)
      setVideo(prev => ({ ...prev, script: scriptContent }))
      showToast('تم حفظ السكربت يدوياً بنجاح! 💾', 'success')
    } catch (err: any) {
      showToast('حدث خطأ أثناء حفظ السكربت: ' + err.message, 'error')
    }
  }

  const handleGenerateStoryboard = async () => {
    setIsGeneratingStoryboard(true)
    try {
      const res = await generateStoryboardPrompts(video.id, splitMethod)
      if (res && res.success && res.data) {
        setStoryboard(res.data)
        setVideo(prev => ({ ...prev, storyboard: res.data }))
        showToast('تم تقسيم وتوليد مشاهد السيناريو البصري بنجاح! 🖼️', 'success')
      } else {
        showToast(res?.error || 'حدث خطأ أثناء تفكيك المشاهد.', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ أثناء تفكيك المشاهد.', 'error')
    } finally {
      setIsGeneratingStoryboard(false)
    }
  }

  const handleToggleStoryboardStep = async (sceneId: string) => {
    const updatedStoryboard = storyboard.map((scene: any) => {
      if (scene.id === sceneId) {
        return { ...scene, completed: !scene.completed }
      }
      return scene
    })
    setStoryboard(updatedStoryboard)
    try {
      await updateYoutubeVideoStoryboard(video.id, updatedStoryboard)
      showToast('تم تحديث حالة المشهد بنجاح!', 'success')
    } catch (err: any) {
      showToast('فشل التحديث: ' + err.message, 'error')
    }
  }

  const handleGenerateSEOData = async () => {
    setIsGeneratingSEO(true)
    try {
      const res = await generateYoutubeSEO(video.id)
      if (res && res.success && res.data) {
        setSeoData(res.data)
        showToast('تم توليد عناوين وبيانات السيو بنجاح! 🚀', 'success')
      } else {
        showToast(res?.error || 'حدث خطأ أثناء توليد السيو.', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ أثناء توليد السيو.', 'error')
    } finally {
      setIsGeneratingSEO(false)
    }
  }

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, type })
  }

  // دالة حفظ وتحديث الخطوات مع تحديث إحصائيات الفيديو محلياً
  const saveSteps = (updatedSteps: any[]) => {
    setSteps(updatedSteps)
    
    // إعادة حساب تفاصيل الفيديو
    const hasTasks = tasks && tasks.length > 0
    const totalTasks = hasTasks ? tasks.length : updatedSteps.length
    const completedTasks = hasTasks 
      ? tasks.filter(t => t.status === 'completed').length 
      : updatedSteps.filter(s => s.completed).length

    const stepsMinutes = updatedSteps.reduce((sum, s) => sum + (s.work_minutes || 0), 0)
    const tasksMinutes = tasks.reduce((sum, t) => sum + (t.work_minutes || 0), 0)
    const totalMinutes = stepsMinutes + tasksMinutes

    const totalHours = Math.round((totalMinutes / 60) * 10) / 10
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    setVideo(prev => ({
      ...prev,
      totalHours,
      totalTasks,
      completedTasks,
      progress,
      steps: updatedSteps
    }))

    startTransition(async () => {
      try {
        await updateYoutubeVideoSteps(video.id, updatedSteps)
      } catch (err: any) {
        showToast('فشل حفظ الخطوات: ' + err.message, 'error')
      }
    })
  }

  const handleToggleStep = (stepId: string) => {
    const updated = steps.map(s => s.id === stepId ? { ...s, completed: !s.completed } : s)
    saveSteps(updated)
  }

  const openTimeModal = (stepId: string) => {
    const step = steps.find(s => s.id === stepId)
    const currentMins = step?.work_minutes || 0
    setSelectedStepId(stepId)
    setLogHours(Math.floor(currentMins / 60))
    setLogMinutes(currentMins % 60)
    setIsTimeModalOpen(true)
  }

  const handleLogTimeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStepId) return

    const totalMinutes = (logHours * 60) + logMinutes
    const updated = steps.map(s => {
      if (s.id === selectedStepId) {
        return { ...s, work_minutes: Math.max(0, totalMinutes) }
      }
      return s
    })

    saveSteps(updated)
    setIsTimeModalOpen(false)
    setSelectedStepId(null)
    showToast('تم تحديث وقت العمل بنجاح ⏱️', 'success')
  }

  const handleDeleteStep = (stepId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الخطوة من الفيديو؟')) return
    const updated = steps.filter(s => s.id !== stepId)
    saveSteps(updated)
  }

  const handleAddStep = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newStepName.trim()) return

    const newStep = {
      id: Date.now().toString(),
      title: newStepName.trim(),
      completed: false,
      work_minutes: 0,
      phase: newStepPhase
    }

    saveSteps([...steps, newStep])
    setNewStepName('')
    showToast('تمت إضافة خطوة جديدة للفيديو ➕', 'success')
  }

  const startEditingStep = (stepId: string, currentTitle: string) => {
    setEditingStepId(stepId)
    setEditingTitle(currentTitle)
  }

  const handleRenameSubmit = (stepId: string) => {
    if (!editingTitle.trim()) return
    const updated = steps.map(s => s.id === stepId ? { ...s, title: editingTitle.trim() } : s)
    saveSteps(updated)
    setEditingStepId(null)
  }

  // =========================================================================

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTitle.trim()) {
      showToast('عنوان الفيديو مطلوب', 'warning')
      return
    }

    startTransition(async () => {
      try {
        // رفع الصورة المصغرة سحابياً إن تم اختيار ملف جديد من الجهاز
        let finalThumbnail = editThumbnail
        if (thumbFile) {
          finalThumbnail = await uploadYoutubeThumbnail(video.id, thumbFile)
        }

        // تحويل المدة للثواني حسب نوع المحتوى (الفيديوهات بالدقائق والريلز بالثواني)
        const durationSeconds = isReelVideo
          ? Math.round(editDurationValue)
          : Math.round(editDurationValue * 60)

        const updated = await updateYoutubeVideo(
          video.id,
          editTitle.trim(),
          editDescription.trim(),
          finalThumbnail,
          editStatus,
          editTargetHours,
          durationSeconds
        )
        showToast('تم تحديث بيانات الفيديو بنجاح', 'success')
        setVideo({
          ...video,
          title: updated.title,
          description: updated.description,
          thumbnail_url: updated.thumbnail_url,
          status: updated.status,
          target_hours: updated.target_hours,
          duration_seconds: updated.duration_seconds,
          completed_at: updated.completed_at
        })
        clearThumbFile()
        setShowThumbUrlInput(false)
        setIsEditModalOpen(false)
      } catch (err: any) {
        showToast('فشل تعديل البيانات: ' + err.message, 'error')
      }
    })
  }

  const handleDelete = () => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الفيديو نهائياً؟ سيتم إلغاء ربطه بكافة المهام المرتبطة به.')) {
      return
    }

    startTransition(async () => {
      try {
        await deleteYoutubeVideo(video.id)
        showToast('تم حذف الفيديو بنجاح', 'success')
        router.push('/youtube')
      } catch (err: any) {
        showToast('فشل حذف الفيديو: ' + err.message, 'error')
      }
    })
  }

  const overLimit = video.totalHours > video.target_hours

  // تنسيق مدة المحتوى وحساب كفاءة الصنع (ساعة عمل لكل دقيقة محتوى)
  const durationBadge = video.duration_seconds && video.duration_seconds > 0
    ? (video.duration_seconds < 60
        ? `${video.duration_seconds} ث`
        : `${Number.isInteger(video.duration_seconds / 60) ? video.duration_seconds / 60 : (video.duration_seconds / 60).toFixed(1)} د`)
    : null
  const contentMinutes = (video.duration_seconds || 0) / 60
  const hoursPerMinute = (contentMinutes > 0 && video.totalHours > 0)
    ? Math.round((video.totalHours / contentMinutes) * 100) / 100
    : null

  return (
    <div className="flex-grow flex flex-col min-h-screen pb-24 md:pb-8">
      <Header user={currentProfile} />

      <main className="flex-grow max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="space-y-6 animate-modal-in">
          
          {/* Breadcrumb والرجوع */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-theme-border pb-5">
            <div className="flex items-center gap-3 text-right w-full md:w-auto">
              <Link 
                href="/youtube"
                className="p-2.5 bg-theme-panel hover:bg-theme-bg text-theme-text rounded-xl border border-theme-border transition-all flex items-center justify-center shadow-sm cursor-pointer shrink-0"
                title="الرجوع للأستوديو"
              >
                <ArrowRight className="w-4 h-4" />
              </Link>
              <div>
                <div className="flex items-center gap-1.5 text-[10px] text-theme-text-muted font-bold mb-1">
                  <span>الأستوديو</span>
                  <span>/</span>
                  <span>تفاصيل الفيديو</span>
                </div>
                <h1 className="text-xl font-bold text-theme-text">تفاصيل الفيديو ومراقبة الأداء</h1>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="flex-1 md:flex-initial bg-theme-panel hover:bg-theme-bg border border-theme-border text-theme-text text-xs font-bold px-4 py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5 text-theme-accent" />
                <span>تعديل الفيديو</span>
              </button>

              <button 
                onClick={handleDelete}
                className="flex-1 md:flex-initial bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 text-xs font-bold px-4 py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف</span>
              </button>
            </div>
          </div>

          {/* الكرت الرئيسي لتفاصيل الفيديو */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-theme-panel border border-theme-border rounded-3xl p-6 sm:p-8 shadow-sm text-right">
            
            {/* غلاف الفيديو */}
            <div className="md:col-span-4 h-48 sm:h-full min-h-[180px] bg-theme-bg rounded-2xl overflow-hidden border border-theme-border relative">
              <img 
                src={thumbPreview || video.thumbnail_url} 
                alt={video.title} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=300&auto=format&fit=crop'
                }}
              />
              <div className="absolute top-3 right-3">
                <span className={`text-[9px] font-bold px-2.5 py-1 rounded-lg border shadow-sm ${statusMap[video.status]?.color} backdrop-blur-xs`}>
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
              {isReelVideo && (
                <div className="absolute top-3 left-3">
                  <span className="text-[9px] font-bold px-2 py-1 rounded-lg bg-amber-500/90 text-white shadow-sm backdrop-blur-xs">
                    ⚡ ريلز
                  </span>
                </div>
              )}
            </div>

            {/* تفاصيل النصوص والعدادات */}
            <div className="md:col-span-8 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <h2 className="text-lg font-black text-theme-text leading-relaxed">{video.title}</h2>
                <p className="text-xs text-theme-text-muted leading-relaxed whitespace-pre-line bg-theme-bg/30 border border-theme-border/60 rounded-xl p-4 min-h-[80px]">
                  {video.description || 'لا يوجد تفاصيل إضافية مكتوبة لهذا الفيديو.'}
                </p>
              </div>

              {/* شريط التقدم وساعات الصنع */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-theme-border/60 pt-4">
                
                {/* الساعات المستغرقة */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-theme-text-muted flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      <span>وقت الصنع الإجمالي:</span>
                    </span>
                    <span className={`font-mono font-black ${overLimit ? 'text-rose-500' : 'text-indigo-400'}`}>
                      {video.totalHours} / {video.target_hours} ساعة
                    </span>
                  </div>
                  <div className="h-2 w-full bg-theme-bg rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        overLimit ? 'bg-rose-500' : 'bg-indigo-500'
                      }`} 
                      style={{ width: `${Math.min(100, (video.totalHours / video.target_hours) * 100)}%` }}
                    />
                  </div>
                  {overLimit && (
                    <span className="text-[9px] text-rose-500 font-bold block">
                      ⚠️ تجاوزت الوقت المستهدف بـ {(video.totalHours - video.target_hours).toFixed(1)} ساعة.
                    </span>
                  )}
                </div>

                {/* تقدم إنجاز المهام */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-theme-text-muted flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>تقدم إنجاز مهام الفيديو:</span>
                    </span>
                    <span className="font-mono font-black text-emerald-400">
                      {video.completedTasks} / {video.totalTasks} مهمة ({video.progress}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-theme-bg rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                      style={{ width: `${video.progress}%` }}
                    />
                  </div>
                </div>

              </div>

              {/* كفاءة الصنع لكل دقيقة محتوى */}
              {hoursPerMinute !== null && (
                <div className="flex items-center justify-between gap-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-3.5 py-2.5 flex-wrap">
                  <span className="text-[10px] font-bold text-theme-text-muted flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                    <span>كفاءة الصنع (ساعات العمل لكل دقيقة محتوى):</span>
                  </span>
                  <span className="font-mono font-black text-[11px] text-emerald-400">
                    {hoursPerMinute} ساعة / دقيقة محتوى
                    <span className="text-theme-text-muted font-sans font-bold"> — كلما انخفض الرقم كان أسرع</span>
                  </span>
                </div>
              )}
            </div>

          </div>

          {/* ================== التبويبات الذكية لاستوديو يوتيوب ================== */}
          {profile.is_ai_enabled && (
            <div className="flex border-b border-theme-border justify-start gap-4 pb-1 mb-6">
              <button
                onClick={() => setActiveTab('checklist')}
                className={`pb-3.5 text-xs font-black transition-all border-b-2 cursor-pointer ${
                  activeTab === 'checklist'
                    ? 'border-theme-accent text-theme-accent'
                    : 'border-transparent text-theme-text-muted hover:text-theme-text'
                }`}
              >
                📋 خطوات الإنتاج والوقت
              </button>
              <button
                onClick={() => setActiveTab('script')}
                className={`pb-3.5 text-xs font-black transition-all border-b-2 cursor-pointer ${
                  activeTab === 'script'
                    ? 'border-theme-accent text-theme-accent'
                    : 'border-transparent text-theme-text-muted hover:text-theme-text'
                }`}
              >
                ✍️ مساعد السكربت الذكي
              </button>
              <button
                onClick={() => setActiveTab('storyboard')}
                className={`pb-3.5 text-xs font-black transition-all border-b-2 cursor-pointer ${
                  activeTab === 'storyboard'
                    ? 'border-theme-accent text-theme-accent'
                    : 'border-transparent text-theme-text-muted hover:text-theme-text'
                }`}
              >
                🖼️ السيناريو واللقطات (Storyboard)
              </button>
              <button
                onClick={() => setActiveTab('seo')}
                className={`pb-3.5 text-xs font-black transition-all border-b-2 cursor-pointer ${
                  activeTab === 'seo'
                    ? 'border-theme-accent text-theme-accent'
                    : 'border-transparent text-theme-text-muted hover:text-theme-text'
                }`}
              >
                🚀 العناوين والسيو
              </button>
            </div>
          )}

          {(activeTab === 'checklist' || !profile.is_ai_enabled) && (
            <>
              {/* ================== لوحة خطوات ومراحل الإنتاج المرنة والسريعة ================== */}
              <div className="bg-theme-panel border border-theme-border rounded-3xl p-6 sm:p-8 shadow-sm text-right space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme-border/60 pb-4">
              <div>
                <h3 className="text-sm font-black text-theme-text flex items-center gap-2">
                  <ListTodo className="w-5 h-5 text-theme-accent" />
                  <span>خطوات ومراحل إنتاج الفيديو ({steps.length})</span>
                </h3>
                <p className="text-[10px] text-theme-text-muted mt-1">تتبع خطوات إنتاج الفيديو، وسجل أوقات العمل في كل مرحلة بمرونة كاملة.</p>
              </div>

              {/* إضافة خطوة سريعة */}
              <form onSubmit={handleAddStep} className="flex items-center gap-2 w-full sm:w-auto">
                <input 
                  type="text"
                  value={newStepName}
                  onChange={(e) => setNewStepName(e.target.value)}
                  placeholder="إضافة خطوة مخصصة..."
                  required
                  className="bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-3 py-2 text-xs transition-all outline-none flex-grow sm:flex-initial"
                />
                <select
                  value={newStepPhase}
                  onChange={(e: any) => setNewStepPhase(e.target.value)}
                  className="bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-3 py-2 text-[10px] transition-all outline-none font-bold cursor-pointer"
                >
                  <option value="scripting">✍️ سيناريو</option>
                  <option value="recording">🎙️ تسجيل</option>
                  <option value="editing">🎬 مونتاج</option>
                  <option value="publishing">🎨 نشر</option>
                  <option value="other">⚙️ أخرى</option>
                </select>
                <button
                  type="submit"
                  className="p-2 bg-theme-accent hover:opacity-90 text-theme-panel rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95 shrink-0"
                  title="إضافة خطوة"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            </div>

            {steps.length === 0 ? (
              <div className="text-center py-6 text-theme-text-muted text-xs">
                لا توجد خطوات حالياً. استخدم النموذج أعلاه لإضافة خطوات العمل الخاصة بك.
              </div>
            ) : (
              <div className="space-y-2.5">
                {steps.map((step) => {
                  const phaseLabels: Record<string, { label: string, color: string }> = {
                    scripting: { label: '✍️ سيناريو', color: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
                    recording: { label: '🎙️ تسجيل', color: 'bg-sky-500/15 text-sky-400 border-sky-500/20' },
                    editing: { label: '🎬 مونتاج', color: 'bg-rose-500/15 text-rose-400 border-rose-500/20' },
                    publishing: { label: '🎨 غلاف ونشر', color: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
                    other: { label: '⚙️ أخرى', color: 'bg-neutral-600/15 text-neutral-400 border-neutral-600/20' }
                  }
                  const badge = phaseLabels[step.phase || 'other'] || phaseLabels.other

                  return (
                    <div 
                      key={step.id}
                      className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border transition-all duration-200 ${
                        step.completed 
                          ? 'bg-theme-bg/30 border-theme-border/40 opacity-70' 
                          : 'bg-theme-bg/60 border-theme-border hover:border-theme-border-hover'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-grow min-w-0">
                        {/* مربع الاختيار المخصص التفاعلي */}
                        <button
                          type="button"
                          onClick={() => handleToggleStep(step.id)}
                          className={`w-5 h-5 rounded-lg border transition-all flex items-center justify-center cursor-pointer shrink-0 ${
                            step.completed
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'bg-theme-input border-theme-border hover:border-theme-accent'
                          }`}
                        >
                          {step.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>

                        {/* عنوان الخطوة (إما عادي أو في وضع التعديل) */}
                        {editingStepId === step.id ? (
                          <div className="flex items-center gap-1.5 flex-grow">
                            <input 
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              className="bg-theme-input border border-theme-accent text-theme-text rounded-lg px-2 py-1 text-xs outline-none w-full max-w-[280px]"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameSubmit(step.id)
                                if (e.key === 'Escape') setEditingStepId(null)
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleRenameSubmit(step.id)}
                              className="p-1 hover:bg-theme-bg text-emerald-500 rounded-lg transition-colors cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingStepId(null)}
                              className="p-1 hover:bg-theme-bg text-rose-500 rounded-lg transition-colors cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 min-w-0">
                            <span 
                              className={`text-xs font-bold leading-relaxed truncate ${
                                step.completed ? 'line-through text-theme-text-muted' : 'text-theme-text'
                              }`}
                            >
                              {step.title}
                            </span>
                            <button
                              type="button"
                              onClick={() => startEditingStep(step.id, step.title)}
                              className="p-1 text-theme-text-muted hover:text-theme-accent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 cursor-pointer"
                              title="تعديل اسم الخطوة"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0 justify-end">
                        {/* تسمية المرحلة */}
                        <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-md border ${badge.color}`}>
                          {badge.label}
                        </span>

                        {/* وقت العمل المنجز في الخطوة */}
                        <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-lg border border-theme-border bg-theme-input ${
                          (step.total_minutes ?? step.work_minutes) > 0 ? 'text-indigo-400' : 'text-theme-text-muted'
                        }`}>
                          ⏱️ {Math.floor(((step.total_minutes ?? step.work_minutes) || 0) / 60)}س { ((step.total_minutes ?? step.work_minutes) || 0) % 60 }د
                        </span>

                        {/* إجراءات سريعة */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openTimeModal(step.id)}
                            className="p-1.5 hover:bg-theme-bg text-theme-text-muted hover:text-indigo-400 rounded-lg transition-colors cursor-pointer border border-theme-border"
                            title="تسجيل ساعات عمل"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStep(step.id)}
                            className="p-1.5 hover:bg-rose-950/20 text-theme-text-muted hover:text-rose-500 rounded-lg transition-colors cursor-pointer border border-theme-border"
                            title="حذف الخطوة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* توزيع الساعات والمجهود على المراحل الأربعة */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-theme-text text-right flex items-center gap-1.5">
              <Layers className="w-4.5 h-4.5 text-theme-accent" />
              <span>تحليل وتوزيع الساعات على مراحل الإنتاج</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {Object.entries(phases).map(([key, phase]) => {
                const phasePct = video.totalHours > 0 ? (phase.hours / video.totalHours) * 100 : 0
                return (
                  <div 
                    key={key}
                    className="bg-theme-panel border border-theme-border rounded-2xl p-4 text-right space-y-2 flex flex-col justify-between"
                  >
                    <div>
                      <span className="block text-[9px] font-bold text-theme-text-muted truncate">{phase.name}</span>
                      <h4 className="text-lg font-black text-theme-text mt-1 font-mono">{phase.hours}س</h4>
                    </div>

                    <div className="border-t border-theme-border/40 pt-2 space-y-1">
                      <div className="flex justify-between text-[8px] text-theme-text-muted font-bold">
                        <span>المهام المنجزة:</span>
                        <span>{phase.completedCount} / {phase.tasksCount}</span>
                      </div>
                      {phase.hours > 0 && (
                        <span className="text-[8px] text-theme-accent font-bold block">
                          مساهمة: {phasePct.toFixed(0)}% من الفيديو
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ================== تقويم نشاط عمل الفيديو ================== */}
          <div className="bg-theme-panel border border-theme-border rounded-3xl p-6 sm:p-8 shadow-sm text-right space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-theme-border pb-4 w-full" dir="rtl">
              <div>
                <h3 className="text-sm font-black text-theme-text flex items-center gap-1.5">
                  <Calendar className="w-4.5 h-4.5 text-theme-accent" />
                  <span>تقويم نشاط أيام العمل على الفيديو</span>
                </h3>
                <p className="text-[10px] text-theme-text-muted mt-0.5">(يعرض الأيام التي تم فيها إنجاز مهام خاصة بهذا الفيديو، انقر لعرض التفاصيل)</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <select
                    value={calMonth}
                    onChange={(e) => setCalMonth(parseInt(e.target.value))}
                    className="bg-theme-panel border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-2.5 py-1.5 text-[10px] md:text-xs transition-all outline-none cursor-pointer font-bold"
                  >
                    {[
                      { value: 1, label: 'يناير' },
                      { value: 2, label: 'فبراير' },
                      { value: 3, label: 'مارس' },
                      { value: 4, label: 'أبريل' },
                      { value: 5, label: 'مايو' },
                      { value: 6, label: 'يونيو' },
                      { value: 7, label: 'يوليو' },
                      { value: 8, label: 'أغسطس' },
                      { value: 9, label: 'سبتمبر' },
                      { value: 10, label: 'أكتوبر' },
                      { value: 11, label: 'نوفمبر' },
                      { value: 12, label: 'ديسمبر' }
                    ].map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>

                  <select
                    value={calYear}
                    onChange={(e) => setCalYear(parseInt(e.target.value))}
                    className="bg-theme-panel border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-2.5 py-1.5 text-[10px] md:text-xs transition-all outline-none cursor-pointer font-bold"
                  >
                    {[2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* شبكة التقويم والإحصائيات السريعة */}
            {(() => {
              // حساب إجمالي أيام العمل الكلية على هذا الفيديو (جميع الأوقات)
              const totalDaysAllTime = new Set(
                tasks
                  .filter(t => t.status === 'completed' && t.completed_date)
                  .map(t => t.completed_date)
              ).size

              const daysInMonth = new Date(calYear, calMonth, 0).getDate()
              const firstDayIndex = new Date(calYear, calMonth - 1, 1).getDay() // 0 = الأحد، ..., 6 = السبت
              const emptyCells = Array.from({ length: firstDayIndex })
              const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1)
              
              const today = new Date()
              const currentYear = today.getFullYear()
              const currentMonth = today.getMonth() + 1
              const currentDay = today.getDate()

              const weekdays = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
              
              // فلترة المهام المرتبطة بالفيديو والمكتملة في هذا الشهر والسنة
              const videoTasksThisMonth = tasks.filter(t => {
                if (t.status !== 'completed' || !t.completed_date) return false
                const [y, m] = t.completed_date.split('-').map(Number)
                return y === calYear && m === calMonth
              })

              // عدد أيام العمل في هذا الشهر بالتحديد
              const daysWorkedThisMonth = new Set(videoTasksThisMonth.map(t => t.completed_date)).size
              const totalMinsThisMonth = videoTasksThisMonth.reduce((sum, t) => sum + (t.work_minutes || 0), 0)
              const hoursThisMonth = Math.round((totalMinsThisMonth / 60) * 10) / 10

              const formatDaysArabic = (count: number) => {
                if (count === 0) return '0 يوم'
                if (count === 1) return 'يوم واحد'
                if (count === 2) return 'يومان'
                if (count >= 3 && count <= 10) return `${count} أيام`
                return `${count} يوماً`
              }

              const handleDayClickLocal = (dayNumber: number) => {
                const dateStr = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`
                const dayTasks = videoTasksThisMonth.filter(t => t.completed_date === dateStr)
                if (dayTasks.length > 0) {
                  setSelectedCalDate(dateStr)
                  setSelectedDayTasks(dayTasks)
                  setIsCalModalOpen(true)
                }
              }

              const formatWorkTimeArabic = (minutes: number) => {
                if (!minutes) return 'لا يوجد'
                const hours = Math.floor(minutes / 60)
                const mins = minutes % 60
                if (hours === 0) return `${mins} دقيقة`
                if (hours === 1 && mins === 0) return 'ساعة'
                if (hours === 1 && mins > 0) return `ساعة و ${mins} دقيقة`
                if (hours === 2 && mins === 0) return 'ساعتين'
                if (hours === 2 && mins > 0) return `ساعتين و ${mins} دقيقة`
                if (hours >= 3 && hours <= 10 && mins === 0) return `${hours} ساعات`
                if (hours > 10 && mins === 0) return `${hours} ساعة`
                return `${hours}س و ${mins}د`
              }

              return (
                <div className="space-y-6">
                  {/* شريط الإحصائيات السريعة لأيام عمل الفيديو */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-theme-accent/10 border border-theme-accent/20 rounded-2xl p-3.5 text-right space-y-1">
                      <span className="block text-[9px] font-black text-theme-accent">إجمالي أيام العمل الكلية لصنع الفيديو</span>
                      <h4 className="text-sm sm:text-lg font-black text-theme-accent font-mono">
                        {formatDaysArabic(totalDaysAllTime)}
                      </h4>
                      <p className="text-[8px] text-theme-text-muted">الأيام الفعلية التي أنجزت فيها مهام لهذا الفيديو</p>
                    </div>

                    <div className="bg-theme-bg/50 border border-theme-border/60 rounded-2xl p-3.5 text-right space-y-1">
                      <span className="block text-[9px] font-bold text-theme-text-muted">إجمالي ساعات العمل الكلية</span>
                      <h4 className="text-sm sm:text-lg font-black text-indigo-400 font-mono">
                        {video.totalHours} ساعة
                      </h4>
                      <p className="text-[8px] text-theme-text-muted">من أصل المستهدف ({video.target_hours}س)</p>
                    </div>

                    <div className="bg-theme-bg/50 border border-theme-border/60 rounded-2xl p-3.5 text-right space-y-1">
                      <span className="block text-[9px] font-bold text-theme-text-muted">معدل العمل في اليوم الواحد</span>
                      <h4 className="text-sm sm:text-lg font-black text-amber-500 font-mono">
                        {totalDaysAllTime > 0 ? (video.totalHours / totalDaysAllTime).toFixed(1) : 0}س / يوم
                      </h4>
                      <p className="text-[8px] text-theme-text-muted">متوسط الساعات لكل يوم عمل</p>
                    </div>

                    <div className="bg-theme-bg/50 border border-theme-border/60 rounded-2xl p-3.5 text-right space-y-1">
                      <span className="block text-[9px] font-bold text-theme-text-muted">أيام العمل في الشهر المختار</span>
                      <h4 className="text-sm sm:text-lg font-black text-emerald-500 font-mono">
                        {formatDaysArabic(daysWorkedThisMonth)}
                      </h4>
                      <p className="text-[8px] text-theme-text-muted">في شهر {calMonth}/{calYear}</p>
                    </div>
                  </div>

                  <div className="w-full overflow-x-auto pb-2 scrollbar-thin" dir="rtl">
                    <div className="min-w-[650px] lg:min-w-0">
                      {/* أيام الأسبوع */}
                      <div className="grid grid-cols-7 gap-2 text-center text-[10px] md:text-xs font-bold text-theme-text-muted mb-2">
                        {weekdays.map(dName => (
                          <div key={dName} className="py-1">
                            {dName}
                          </div>
                        ))}
                      </div>

                      {/* شبكة الأيام */}
                      <div className="grid grid-cols-7 gap-2">
                        {emptyCells.map((_, idx) => (
                          <div 
                            key={`empty-${idx}`} 
                            className="bg-transparent border border-transparent rounded-2xl h-24 sm:h-28 md:h-32 opacity-0 pointer-events-none"
                          />
                        ))}

                        {daysArray.map(d => {
                          const isFuture = calYear > currentYear || 
                            (calYear === currentYear && calMonth > currentMonth) || 
                            (calYear === currentYear && calMonth === currentMonth && d > currentDay)
                            
                          const dateStr = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                          const dayTasks = videoTasksThisMonth.filter(t => t.completed_date === dateStr)
                          const totalDayMinutes = dayTasks.reduce((sum, t) => sum + (t.work_minutes || 0), 0)
                          
                          const hasLogged = dayTasks.length > 0
                          
                          let cellClasses = ""
                          let contentColorClasses = ""
                          let numberColorClass = ""
                          
                          if (isFuture) {
                            cellClasses = "bg-theme-panel/20 border border-theme-border/30 opacity-40 cursor-default"
                            numberColorClass = "text-theme-text-muted/40"
                          } else if (!hasLogged) {
                            cellClasses = "bg-theme-panel/40 border border-theme-border/50 opacity-60 cursor-default"
                            numberColorClass = "text-theme-text-muted/60"
                          } else {
                            // تدرج اللون الأخضر بناءً على وقت العمل على هذا الفيديو في هذا اليوم
                            if (totalDayMinutes < 60) {
                              cellClasses = "bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer shadow-2xs hover:scale-[1.02]"
                              contentColorClasses = "text-emerald-600 dark:text-emerald-400"
                              numberColorClass = "text-emerald-600 dark:text-emerald-400"
                            } else if (totalDayMinutes >= 60 && totalDayMinutes < 180) {
                              cellClasses = "bg-emerald-500/20 dark:bg-emerald-500/30 border border-emerald-500/35 hover:bg-emerald-500/40 transition-all cursor-pointer shadow-xs hover:scale-[1.02]"
                              contentColorClasses = "text-emerald-700 dark:text-emerald-300"
                              numberColorClass = "text-emerald-700 dark:text-emerald-300"
                            } else {
                              cellClasses = "bg-emerald-600 dark:bg-emerald-700 border border-emerald-600 dark:border-emerald-700 hover:bg-emerald-550 dark:hover:bg-emerald-650 transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
                              contentColorClasses = "text-white"
                              numberColorClass = "text-white"
                            }
                          }

                          return (
                            <div
                              key={d}
                              onClick={() => !isFuture && hasLogged && handleDayClickLocal(d)}
                              className={`rounded-2xl p-2 md:p-3 h-24 sm:h-28 md:h-32 flex flex-col justify-between text-right relative overflow-hidden select-none active:scale-98 ${cellClasses}`}
                            >
                              <div className="flex justify-between items-start w-full">
                                {hasLogged && (
                                  <span className="text-[10px] font-black bg-theme-panel/30 text-theme-text px-1.5 py-0.5 rounded-md">
                                    {dayTasks.length} {dayTasks.length === 1 ? 'مهمة' : 'مهام'}
                                  </span>
                                )}
                                <span className={`text-[10px] md:text-xs font-black font-mono ${numberColorClass}`}>
                                  {d}
                                </span>
                              </div>
                              
                              {hasLogged && (
                                <div className={`flex flex-col items-center justify-end gap-0.5 mt-auto text-[9px] md:text-[10px] font-bold ${contentColorClasses}`}>
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" />
                                    <span className="whitespace-nowrap">{formatWorkTimeArabic(totalDayMinutes)}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* المهام المرتبطة بالفيديو */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-theme-text text-right flex items-center gap-1.5">
              <ListTodo className="w-4.5 h-4.5 text-theme-accent" />
              <span>المهام والأنشطة المرتبطة بهذا الفيديو ({tasks.length})</span>
            </h3>

            {tasks.length === 0 ? (
              <div className="bg-theme-panel border border-dashed border-theme-border rounded-2xl p-10 text-center">
                <FileText className="w-10 h-10 text-theme-text-muted opacity-50 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-theme-text">لا توجد مهام مرتبطة بهذا الفيديو بعد</h4>
                <p className="text-[10px] text-theme-text-muted mt-0.5">
                  اربط مهامك بالفيديو من لوحة التحكم أو صفحة التفاصيل لتتبع الساعات بدقة.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tasks.map((task) => (
                  <Link 
                    key={task.id}
                    href={`/task/${task.id}`}
                    className="bg-theme-panel border border-theme-border hover:border-theme-accent/20 rounded-xl p-4 flex items-center justify-between gap-4 transition-all duration-200 text-right hover:shadow-xs"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-theme-text truncate">{task.title}</span>
                        {task.group && (
                          <span 
                            className="text-[8px] font-bold px-1.5 py-0.5 rounded-md border"
                            style={{ 
                              borderColor: task.group.color === 'pastel-purple' ? '#c084fc' : task.group.color === 'pastel-blue' ? '#38bdf8' : 'var(--theme-border)',
                              color: task.group.color === 'pastel-purple' ? '#c084fc' : task.group.color === 'pastel-blue' ? '#38bdf8' : 'currentColor'
                            }}
                          >
                            {task.group.name}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-[9px] font-bold text-theme-text-muted">
                        <span>المرحلة:</span>
                        <span className="text-rose-450">
                          {task.video_phase === 'scripting' ? '✍️ سيناريو' : 
                           task.video_phase === 'recording' ? '🎙️ تصوير' : 
                           task.video_phase === 'editing' ? '🎬 مونتاج' : 
                           task.video_phase === 'publishing' ? '🎨 غلاف ونشر' : 'أخرى'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {task.work_minutes > 0 && (
                        <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-md font-bold text-[9px] font-mono">
                          ⏱️ {Math.floor(task.work_minutes / 60)}س {task.work_minutes % 60}د
                        </span>
                      )}
                      
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${
                        task.status === 'completed' 
                          ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20' 
                          : 'bg-theme-bg text-theme-text-muted border-theme-border'
                      }`}>
                        {taskStatusMap[task.status] || task.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
            </>
          )}

          {/* ================== تبويب مساعد السكربت الذكي ================== */}
          {activeTab === 'script' && profile.is_ai_enabled && (
            <div className="bg-theme-panel border border-theme-border rounded-3xl p-6 sm:p-8 shadow-sm text-right space-y-6 animate-modal-in">
              <div>
                <h3 className="text-sm font-black text-theme-text flex items-center gap-2">
                  <span>✍️</span>
                  <span>مساعد السكربت الذكي (baron Script Cloner)</span>
                </h3>
                <p className="text-[10px] text-theme-text-muted mt-1">توليد نص الفيديو بمحاكاة أسلوبك الشخصي بالكامل، وحفظ السكربتات المرجعية.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* الخيارات والإعدادات الجانبية */}
                <div className="lg:col-span-5 space-y-5 bg-theme-bg/40 border border-theme-border p-5 rounded-2xl">
                  <div>
                    <h4 className="text-xs font-bold text-theme-text mb-3">⚙️ خيارات التوليد الفنية</h4>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-theme-text-muted mb-1.5">موضوع / فكرة الفيديو التفصيلية</label>
                        <textarea
                          value={topic}
                          onChange={(e) => setTopic(e.target.value)}
                          rows={3}
                          placeholder="مثال: قصة نجاح وارن بافيت الخفية في الاستثمار والخدعة التي يخفيها عن العالم..."
                          className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-3 py-2 text-xs transition-all outline-none leading-relaxed resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-theme-text-muted mb-1.5">المدة المتوقعة (دقائق)</label>
                          <input
                            type="number"
                            value={lengthMinutes}
                            onChange={(e) => setLengthMinutes(Math.max(1, parseInt(e.target.value) || 5))}
                            min="1"
                            max="40"
                            className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-3 py-2 text-xs transition-all outline-none font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-theme-text-muted mb-1.5">نبرة السيناريو</label>
                          <select
                            value={tone}
                            onChange={(e) => setTone(e.target.value)}
                            className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-3 py-2 text-xs transition-all outline-none font-bold cursor-pointer"
                          >
                            <option value="غموض وإثارة وتشويق 🎭">🎭 غموض وتشويق</option>
                            <option value="سينمائي وسرد قصصي 🎬">🎬 سينمائي وسرد</option>
                            <option value="تحليلي وعميق 🧠">🧠 تحليلي وعميق</option>
                            <option value="حماسي ومحفز ⚡">⚡ حماسي ومحفز</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-theme-text-muted mb-1.5">سرعة الإلقاء والتدفق</label>
                        <select
                          value={pacing}
                          onChange={(e) => setPacing(e.target.value)}
                          className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-3 py-2 text-xs transition-all outline-none font-bold cursor-pointer"
                        >
                          <option value="سريع وديناميكي ⚡">⚡ سريع وديناميكي</option>
                          <option value="متزن وهادئ مع وقفات مشوقة ⏳">⏳ متزن وهادئ</option>
                          <option value="درامي وبطيء للتأثير 🎭">🎭 درامي وبطيء</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* قائمة السكربتات المرجعية للاستنساخ */}
                  <div className="border-t border-theme-border/60 pt-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-bold text-theme-text-muted">✍️ محاكاة أسلوبك الشخصي</span>
                      <Link href="/youtube/settings" className="text-[8px] text-theme-accent hover:underline font-bold">إدارة المخزن</Link>
                    </div>
                    
                    {referenceScripts.length === 0 ? (
                      <p className="text-[9px] text-theme-text-muted leading-relaxed">
                        مخزن السكربتات فارغ حالياً. أضف سكربتات سابقة في صفحة الإعدادات لاستنساخ أسلوبك!
                      </p>
                    ) : (
                      <div className="max-h-36 overflow-y-auto space-y-2 pr-1 border border-theme-border/40 rounded-xl p-2 bg-theme-bg/20">
                        {referenceScripts.map(ref => (
                          <label key={ref.id} className="flex items-center gap-2 text-[10px] cursor-pointer hover:text-theme-text transition-colors">
                            <input
                              type="checkbox"
                              checked={selectedRefIds.includes(ref.id)}
                              onChange={() => handleToggleRefScriptId(ref.id)}
                              className="rounded text-theme-accent focus:ring-0 cursor-pointer"
                            />
                            <span className="truncate">{ref.title}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleGenerateScript}
                    disabled={isGeneratingScript || isPending}
                    className="w-full py-3 bg-theme-accent hover:opacity-90 disabled:opacity-50 text-theme-panel font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    {isGeneratingScript ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري صياغة السكربت بأسلوبك...</span>
                      </>
                    ) : (
                      <>
                        <span>توليد السكربت بالذكاء الاصطناعي 🪄</span>
                      </>
                    )}
                  </button>
                </div>

                {/* مساحة العرض والمحرر */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center justify-between border-b border-theme-border/60 pb-2">
                    <span className="text-xs font-bold text-theme-text">السيناريو النهائي للفيديو</span>
                    {scriptContent && (
                      <div className="flex gap-4 text-[9px] font-mono text-theme-text-muted">
                        <span>عدد الكلمات: {scriptContent.split(/\s+/).filter(Boolean).length} كلمة</span>
                        <span>القراءة التقريبية: {Math.round(scriptContent.split(/\s+/).filter(Boolean).length / 130)} دقيقة</span>
                      </div>
                    )}
                  </div>

                  <textarea
                    value={scriptContent}
                    onChange={(e) => setScriptContent(e.target.value)}
                    rows={14}
                    placeholder="اكتب السكربت هنا أو اضغط على زر التوليد في اليمين لصياغته..."
                    className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-2xl px-4 py-3 text-xs leading-relaxed transition-all outline-none resize-none font-mono"
                  />

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleSaveScriptManual}
                      disabled={isPending}
                      className="px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>حفظ السكربت 💾</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================== تبويب مقسم المشاهد والسيناريو البصري ================== */}
          {activeTab === 'storyboard' && profile.is_ai_enabled && (
            <div className="bg-theme-panel border border-theme-border rounded-3xl p-6 sm:p-8 shadow-sm text-right space-y-6 animate-modal-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme-border/60 pb-4">
                <div>
                  <h3 className="text-sm font-black text-theme-text flex items-center gap-2">
                    <span>🖼️</span>
                    <span>تفكيك المشاهد ومولد برومبتات الصور (baron Storyboard)</span>
                  </h3>
                  <p className="text-[10px] text-theme-text-muted mt-1">تقسيم السكربت إلى لقطات متتالية وتوليد برومبت معقد بالإنجليزية لكل مشهد.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <select
                    value={splitMethod}
                    onChange={(e: any) => setSplitMethod(e.target.value)}
                    className="bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-3 py-2.5 text-xs transition-all outline-none font-bold cursor-pointer"
                  >
                    <option value="story">تقسيم درامي ذكي 🧠</option>
                    <option value="words">تقطيع سريع (كل 8-12 كلمة) ⚡</option>
                    <option value="sentences">كل جملة كاملة 📝</option>
                  </select>

                  <button
                    onClick={handleGenerateStoryboard}
                    disabled={isGeneratingStoryboard || isPending}
                    className="px-4 py-2.5 bg-theme-accent hover:opacity-90 disabled:opacity-50 text-theme-panel font-bold rounded-xl text-xs transition-all flex items-center gap-1 cursor-pointer"
                  >
                    {isGeneratingStoryboard ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري توليد المشاهد...</span>
                      </>
                    ) : (
                      <span>تفكيك وتوليد المشاهد 🖼️</span>
                    )}
                  </button>
                </div>
              </div>

              {storyboard.length === 0 ? (
                <div className="text-center py-16 bg-theme-bg/30 border border-dashed border-theme-border rounded-2xl">
                  <p className="text-xs text-theme-text-muted">لم يتم تفكيك أي مشاهد لهذا الفيديو بعد.</p>
                  <p className="text-[10px] text-theme-text-muted mt-1">
                    تأكد من وجود سكربت محفوظ للفيديو أولاً، ثم اضغط على زر "تفكيك وتوليد المشاهد" أعلاه.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {storyboard.map((scene: any, idx: number) => {
                    return (
                      <div
                        key={scene.id || idx}
                        className={`bg-theme-bg/60 border rounded-2xl p-4 flex flex-col md:flex-row justify-between gap-4 transition-all duration-200 border-theme-border hover:border-theme-border-hover ${
                          scene.completed ? 'opacity-60 bg-theme-bg/20' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3 flex-grow min-w-0">
                          {/* زر التحديد للاكتمال */}
                          <button
                            type="button"
                            onClick={() => handleToggleStoryboardStep(scene.id)}
                            className={`mt-0.5 p-1 rounded-lg border transition-all cursor-pointer ${
                              scene.completed 
                                ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20' 
                                : 'bg-theme-bg text-theme-text-muted border-theme-border hover:border-theme-border-hover'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>

                          <div className="space-y-2 flex-grow min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-black bg-neutral-600/30 text-theme-text px-2 py-0.5 rounded-md font-mono">
                                مشهد #{idx + 1}
                              </span>
                              {scene.completed && (
                                <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold">مكتمل البناء</span>
                              )}
                            </div>
                            
                            {/* النص العربي المقابل */}
                            <p className="text-xs text-theme-text leading-relaxed whitespace-pre-line font-bold">
                              {scene.text}
                            </p>

                            {/* البرومبت الإنجليزي المقابل */}
                            <div className="relative group/prompt bg-theme-input border border-theme-border/60 rounded-xl p-3 text-[10px] font-mono text-theme-text-muted leading-relaxed select-all">
                              {scene.prompt}
                              
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(scene.prompt)
                                  showToast('تم نسخ البرومبت بنجاح! 📋', 'success')
                                }}
                                className="absolute left-2 top-2 bg-theme-bg/85 hover:bg-theme-panel border border-theme-border px-2 py-1 rounded-md text-[8px] font-bold text-theme-accent transition-colors opacity-0 group-hover/prompt:opacity-100 cursor-pointer"
                              >
                                نسخ البرومبت
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================== تبويب السيو والعناوين ================== */}
          {activeTab === 'seo' && profile.is_ai_enabled && (
            <div className="bg-theme-panel border border-theme-border rounded-3xl p-6 sm:p-8 shadow-sm text-right space-y-6 animate-modal-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme-border/60 pb-4">
                <div>
                  <h3 className="text-sm font-black text-theme-text flex items-center gap-2">
                    <span>🚀</span>
                    <span>سيو وعناوين الفيديو الذكية (baron CTR/SEO)</span>
                  </h3>
                  <p className="text-[10px] text-theme-text-muted mt-1">توليد عناوين جذابة بنسبة نقر عالية، ووصف، وفصول متوافقة تماماً مع خوارزميات اليوتيوب.</p>
                </div>

                <button
                  onClick={handleGenerateSEOData}
                  disabled={isGeneratingSEO || isPending}
                  className="px-4 py-2.5 bg-theme-accent hover:opacity-90 disabled:opacity-50 text-theme-panel font-bold rounded-xl text-xs transition-all flex items-center gap-1 cursor-pointer"
                >
                  {isGeneratingSEO ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري صياغة السخاء...</span>
                    </>
                  ) : (
                    <span>توليد بيانات السيو 🚀</span>
                  )}
                </button>
              </div>

              {!seoData ? (
                <div className="text-center py-16 bg-theme-bg/30 border border-dashed border-theme-border rounded-2xl">
                  <p className="text-xs text-theme-text-muted">لم يتم توليد بيانات السيو لهذا الفيديو بعد.</p>
                  <p className="text-[10px] text-theme-text-muted mt-1">
                    اضغط على زر التوليد أعلاه لتحليل السكربت وصياغة العناوين والوصف والفصول تلقائياً.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* العناوين المقترحة */}
                  <div className="space-y-3 bg-theme-bg/40 border border-theme-border p-5 rounded-2xl">
                    <h4 className="text-xs font-black text-theme-text">🎯 العناوين الخمسة المقترحة (أعلى نسبة نقر CTR)</h4>
                    <div className="space-y-2">
                      {seoData.titles?.map((title: string, idx: number) => (
                        <div key={idx} className="flex items-center justify-between gap-3 p-3 bg-theme-input border border-theme-border/60 rounded-xl">
                          <span className="text-xs font-bold text-theme-text">{title}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(title)
                              showToast('تم نسخ العنوان! 📋', 'success')
                            }}
                            className="px-2.5 py-1.5 bg-theme-bg hover:bg-theme-panel border border-theme-border text-[9px] font-bold text-theme-accent rounded-lg cursor-pointer transition-colors"
                          >
                            نسخ
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* الوصف المقترح */}
                    <div className="space-y-2 bg-theme-bg/40 border border-theme-border p-5 rounded-2xl flex flex-col">
                      <div className="flex items-center justify-between gap-2 border-b border-theme-border/40 pb-2 mb-2">
                        <h4 className="text-xs font-black text-theme-text">📝 وصف الفيديو المقترح</h4>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(seoData.description || '')
                            showToast('تم نسخ الوصف! 📋', 'success')
                          }}
                          className="text-[9px] font-bold text-theme-accent hover:underline cursor-pointer"
                        >
                          نسخ الوصف بالكامل
                        </button>
                      </div>
                      <textarea
                        readOnly
                        value={seoData.description || ''}
                        rows={8}
                        className="w-full bg-theme-input border border-theme-border text-theme-text rounded-xl p-3 text-xs leading-relaxed outline-none resize-none leading-relaxed font-mono flex-grow"
                      />
                    </div>

                    <div className="space-y-6">
                      {/* الكلمات المفتاحية والوسوم */}
                      <div className="space-y-2 bg-theme-bg/40 border border-theme-border p-5 rounded-2xl">
                        <div className="flex items-center justify-between gap-2 border-b border-theme-border/40 pb-2 mb-2">
                          <h4 className="text-xs font-black text-theme-text">🏷️ الكلمات المفتاحية والوسوم (Tags)</h4>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(seoData.tags?.join(', ') || '')
                              showToast('تم نسخ الكلمات المفتاحية! 📋', 'success')
                            }}
                            className="text-[9px] font-bold text-theme-accent hover:underline cursor-pointer"
                          >
                            نسخ الكلمات المفتاحية
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {seoData.tags?.map((tag: string, idx: number) => (
                            <span key={idx} className="bg-neutral-600/25 border border-theme-border text-theme-text px-2.5 py-1 rounded-lg text-[9px] font-bold font-mono">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* فصول ومخطط الفيديو */}
                      <div className="space-y-2 bg-theme-bg/40 border border-theme-border p-5 rounded-2xl">
                        <div className="flex items-center justify-between gap-2 border-b border-theme-border/40 pb-2 mb-2">
                          <h4 className="text-xs font-black text-theme-text">⏳ فصول الفيديو (Timestamps/Chapters)</h4>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(seoData.chapters || '')
                              showToast('تم نسخ الفصول! 📋', 'success')
                            }}
                            className="text-[9px] font-bold text-theme-accent hover:underline cursor-pointer"
                          >
                            نسخ الفصول
                          </button>
                        </div>
                        <textarea
                          readOnly
                          value={seoData.chapters || ''}
                          rows={4}
                          className="w-full bg-theme-input border border-theme-border text-theme-text rounded-xl p-3 text-xs leading-relaxed outline-none resize-none font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* ================== مودال تسجيل الساعات للخطوة ================== */}
      {isTimeModalOpen && selectedStepId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => { setIsTimeModalOpen(false); setSelectedStepId(null); }}></div>
          
          <div className="relative bg-theme-panel w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-theme-border animate-modal-in z-10 text-right space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-theme-border pb-4">
              <div>
                <h3 className="text-base font-black text-theme-text flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-400" />
                  <span>تسجيل وقت العمل</span>
                </h3>
                <p className="text-[10px] text-theme-text-muted mt-0.5">سجل الساعات والدقائق التي قضيتها في خطوة: <strong className="text-theme-text">{(steps.find(s => s.id === selectedStepId)?.title)}</strong></p>
              </div>
              <button 
                onClick={() => { setIsTimeModalOpen(false); setSelectedStepId(null); }}
                className="p-1 text-theme-text-muted hover:text-theme-text rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLogTimeSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-theme-text-muted mb-1.5">الساعات</label>
                  <input 
                    type="number" 
                    value={logHours}
                    onChange={(e) => setLogHours(Math.max(0, parseInt(e.target.value) || 0))}
                    min="0"
                    className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none font-bold" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-theme-text-muted mb-1.5">الدقائق</label>
                  <input 
                    type="number" 
                    value={logMinutes}
                    onChange={(e) => setLogMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                    min="0"
                    max="59"
                    className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none font-bold" 
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-98"
                >
                  <span>حفظ وتسجيل الوقت ⏱️</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================== مودال تعديل الفيديو ================== */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setIsEditModalOpen(false)}></div>
          
          <div className="relative bg-theme-panel w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-theme-border animate-modal-in z-10 text-right space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-theme-border pb-4">
              <div>
                <h3 className="text-base font-black text-theme-text flex items-center gap-2">
                  <Edit className="w-5 h-5 text-theme-accent" />
                  <span>تعديل تفاصيل الفيديو</span>
                </h3>
                <p className="text-[10px] text-theme-text-muted mt-0.5">تحديث معلومات الفيديو الحالي والهدف الزمني</p>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 text-theme-text-muted hover:text-theme-text rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">عنوان الفيديو</label>
                <input 
                  type="text" 
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">وصف ومحتوى الفيديو</label>
                <textarea 
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={4}
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none resize-none leading-relaxed" 
                ></textarea>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-theme-text-muted mb-1.5">ساعات العمل المستهدفة</label>
                  <input 
                    type="number" 
                    value={editTargetHours}
                    onChange={(e) => setEditTargetHours(Math.max(1, parseInt(e.target.value) || 20))}
                    required
                    min="1"
                    className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none font-bold" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-theme-text-muted mb-1.5 flex items-center gap-1.5">
                    <Timer className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{isReelVideo ? 'المدة النهائية (ثواني)' : 'المدة النهائية (دقائق)'}</span>
                  </label>
                  <input 
                    type="number" 
                    value={editDurationValue || ''}
                    onChange={(e) => setEditDurationValue(Math.max(0, parseFloat(e.target.value) || 0))}
                    min="0"
                    step={isReelVideo ? '1' : '0.5'}
                    placeholder={isReelVideo ? '45' : '8'}
                    className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none font-bold" 
                  />
                </div>
              </div>

              <p className="text-[9px] text-theme-text-muted -mt-2">مدة المحتوى النهائي تُستخدم لحساب كفاءة الإنتاج (ساعات الصنع لكل دقيقة محتوى)</p>

              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">حالة العمل والإنتاج</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as Video['status'])}
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none cursor-pointer font-bold"
                >
                  <option value="planning">📝 تخطيط وتحضير</option>
                  <option value="in_progress">🎬 قيد التصوير والمونتاج</option>
                  <option value="completed">✅ جاهز ومكتمل للنشر</option>
                  <option value="published">🚀 نُشر بالقناة</option>
                </select>
              </div>

              {/* الصورة المصغرة */}
              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5 flex items-center gap-1.5">
                  <ImagePlus className="w-3.5 h-3.5 text-theme-accent" />
                  <span>الصورة المصغرة (Thumbnail)</span>
                </label>

                {thumbPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-theme-border">
                    <img src={thumbPreview} alt="معاينة الغلاف الجديد" className="w-full h-36 object-cover" />
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
                  <>
                    <div className="relative rounded-xl overflow-hidden border border-theme-border mb-2">
                      <img src={video.thumbnail_url} alt="الغلاف الحالي" className="w-full h-24 object-cover opacity-70" />
                      <span className="absolute bottom-2 right-2 text-[8px] font-bold bg-black/60 text-white px-2 py-0.5 rounded-md">
                        الغلاف الحالي
                      </span>
                    </div>
                    <label className="flex flex-col items-center justify-center gap-1.5 h-20 border-2 border-dashed border-theme-border hover:border-theme-accent/50 rounded-xl cursor-pointer transition-all bg-theme-input/50 hover:bg-theme-input">
                      <ImagePlus className="w-5 h-5 text-theme-text-muted" />
                      <span className="text-[10px] font-bold text-theme-text-muted">اضغط لرفع صورة جديدة من جهازك (حتى 5MB)</span>
                      <input 
                        type="file" 
                        accept="image/*"
                        className="hidden" 
                        onChange={handleThumbFileChange}
                      />
                    </label>
                    {!showThumbUrlInput && (
                      <button
                        type="button"
                        onClick={() => setShowThumbUrlInput(true)}
                        className="mt-2 text-[10px] font-bold text-theme-accent hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Link2 className="w-3 h-3" />
                        <span>أو الصق رابط صورة بدلاً من الرفع</span>
                      </button>
                    )}
                  </>
                )}

                {showThumbUrlInput && !thumbFile && (
                  <input 
                    type="url" 
                    value={editThumbnail}
                    onChange={(e) => setEditThumbnail(e.target.value)}
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
                      <span>جاري حفظ التعديلات...</span>
                    </>
                  ) : (
                    <span>تأكيد وحفظ التعديلات</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================== مودال تفاصيل العمل اليومي للفيديو ================== */}
      {isCalModalOpen && selectedCalDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => { setIsCalModalOpen(false); setSelectedCalDate(''); }}></div>
          
          <div className="relative bg-theme-panel w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-theme-border animate-modal-in z-10 text-right flex flex-col max-h-[85vh]">
            <div className="flex items-start justify-between gap-4 border-b border-theme-border pb-4 shrink-0 font-sans">
              <div>
                <h3 className="text-base font-black text-theme-text flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-400" />
                  <span>تفاصيل إنجاز الفيديو ليوم {selectedCalDate}</span>
                </h3>
                <p className="text-[10px] text-theme-text-muted mt-0.5">المهام المكتملة وساعات العمل المسجلة لهذا الفيديو</p>
              </div>
              <button 
                onClick={() => { setIsCalModalOpen(false); setSelectedCalDate(''); }}
                className="p-1 text-theme-text-muted hover:text-theme-text rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-1 overflow-y-auto space-y-3 mt-4 flex-grow scrollbar-hide font-sans">
              {selectedDayTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/task/${task.id}`}
                  className="block bg-theme-bg/60 border border-theme-border hover:border-theme-accent/25 rounded-2xl p-4 transition-all duration-150 text-right"
                  onClick={() => setIsCalModalOpen(false)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-theme-text truncate">{task.title}</span>
                        {task.group && (
                          <span 
                            className="text-[8px] font-bold px-1.5 py-0.5 rounded-md border"
                            style={{ 
                              borderColor: task.group.color === 'pastel-purple' ? '#c084fc' : task.group.color === 'pastel-blue' ? '#38bdf8' : 'var(--theme-border)',
                              color: task.group.color === 'pastel-purple' ? '#c084fc' : task.group.color === 'pastel-blue' ? '#38bdf8' : 'currentColor'
                            }}
                          >
                            {task.group.name}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-[9px] font-bold text-theme-text-muted">
                        <span>المرحلة:</span>
                        <span className="text-rose-450">
                          {task.video_phase === 'scripting' ? '✍️ سيناريو' : 
                           task.video_phase === 'recording' ? '🎙️ تصوير' : 
                           task.video_phase === 'editing' ? '🎬 مونتاج' : 
                           task.video_phase === 'publishing' ? '🎨 غلاف ونشر' : 'أخرى'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {task.work_minutes > 0 && (
                        <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-md font-bold text-[9px] font-mono">
                          ⏱️ {Math.floor(task.work_minutes / 60)}س {task.work_minutes % 60}د
                        </span>
                      )}
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-450 border border-emerald-500/20">
                        مكتمل
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="p-4 border-t border-theme-border bg-theme-bg/25 flex justify-end shrink-0 mt-4 rounded-b-3xl font-sans">
              <button
                onClick={() => { setIsCalModalOpen(false); setSelectedCalDate(''); }}
                className="px-4 py-2 bg-theme-panel hover:bg-theme-bg text-theme-text border border-theme-border font-bold rounded-xl text-xs transition-all cursor-pointer active:scale-95"
              >
                إغلاق
              </button>
            </div>
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
