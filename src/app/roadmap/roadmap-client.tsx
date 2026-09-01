'use client'

import { useState, useTransition } from 'react'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import DatePicker from '@/components/DatePicker'
import { 
  TrendingUp, 
  Calendar, 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ListTodo,
  Info
} from 'lucide-react'
import { createMilestone, updateMilestone, deleteMilestone, getMilestones } from '../actions'

interface Profile {
  id: string
  name: string
  email: string
  role: string
  avatar_url: string
}

interface Milestone {
  id: string
  title: string
  description: string | null
  due_date: string
  status: 'active' | 'completed' | 'delayed'
  totalTasks: number
  completedTasks: number
  progress: number
  tasks?: Array<{
    id: string
    title: string
    status: string
  }>
}

interface RoadmapClientProps {
  currentProfile: Profile
  initialMilestones: Milestone[]
}

const statusMap = {
  active: { label: 'نشط 🚀', color: 'bg-sky-500/10 text-sky-500 border-sky-500/20' },
  completed: { label: 'مكتملة 💯', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  delayed: { label: 'متأخرة ⚠️', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' }
}

export default function RoadmapClient({ currentProfile, initialMilestones }: RoadmapClientProps) {
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones || [])
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null)

  // حالة النوافذ المنبثقة
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [milestoneToEdit, setMilestoneToEdit] = useState<Milestone | null>(null)
  const [milestoneDueDate, setMilestoneDueDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  // تفاصيل المحطة المحددة لرؤية المهام
  const [expandedMilestoneId, setExpandedMilestoneId] = useState<string | null>(null)

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, type })
  }

  // تحديث قائمة المحطات من السيرفر
  const refreshMilestones = async () => {
    try {
      const data = await getMilestones()
      setMilestones(data as Milestone[])
    } catch (err: any) {
      showToast('فشل تحديث البيانات: ' + err.message, 'error')
    }
  }

  // إنشاء محطة جديدة
  const handleCreateMilestone = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    const title = formData.get('title') as string
    const description = formData.get('description') as string

    if (!title.trim() || !milestoneDueDate) {
      showToast('يرجى ملء كافة الحقول الأساسية', 'warning')
      return
    }

    startTransition(async () => {
      try {
        await createMilestone(title, description, milestoneDueDate)
        showToast('تم إنشاء المحطة الكبرى بنجاح', 'success')
        setIsAddModalOpen(false)
        form.reset()
        refreshMilestones()
      } catch (err: any) {
        showToast('فشل إنشاء المحطة: ' + err.message, 'error')
      }
    })
  }

  // تعديل محطة
  const handleUpdateMilestone = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!milestoneToEdit) return
    const form = e.currentTarget
    const formData = new FormData(form)
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const status = formData.get('status') as 'active' | 'completed' | 'delayed'

    startTransition(async () => {
      try {
        await updateMilestone(milestoneToEdit.id, title, description, milestoneDueDate, status)
        showToast('تم تعديل المحطة الكبرى بنجاح', 'success')
        setIsEditModalOpen(false)
        setMilestoneToEdit(null)
        refreshMilestones()
      } catch (err: any) {
        showToast('فشل تعديل المحطة: ' + err.message, 'error')
      }
    })
  }

  // حذف محطة
  const handleDeleteMilestone = (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المحطة الكبرى؟ لن يتم حذف المهام المرتبطة بها ولكن سيلغى ارتباطها.')) {
      return
    }

    startTransition(async () => {
      try {
        await deleteMilestone(id)
        showToast('تم حذف المحطة الكبرى بنجاح', 'success')
        refreshMilestones()
      } catch (err: any) {
        showToast('فشل حذف المحطة: ' + err.message, 'error')
      }
    })
  }

  const openEditModal = (milestone: Milestone) => {
    setMilestoneToEdit(milestone)
    setMilestoneDueDate(milestone.due_date)
    setIsEditModalOpen(true)
  }

  return (
    <div className="flex-grow flex flex-col min-h-screen pb-24 md:pb-8">
      <Header user={currentProfile} />

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="space-y-6">

          {/* رأس الصفحة وزر الإضافة للمشرف */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-theme-border pb-5 text-right">
            <div>
              <h1 className="text-2xl font-bold text-theme-text flex items-center gap-2 justify-start sm:justify-end">
                <TrendingUp className="w-6 h-6 text-theme-accent" />
                <span>خريطة الطريق والأهداف الكبرى</span>
              </h1>
              <p className="text-xs text-theme-text-muted mt-1">تحديد الأهداف الاستراتيجية الكبرى للمشروع وتقسيمها زمنياً لتسريع الإنجاز والتركيز</p>
            </div>

            {currentProfile.role === 'admin' && (
              <button
                onClick={() => {
                  setMilestoneDueDate(new Date().toISOString().split('T')[0])
                  setIsAddModalOpen(true)
                }}
                className="bg-theme-accent hover:bg-theme-accent-hover text-theme-panel text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer self-stretch sm:self-auto justify-center"
              >
                <Plus className="w-4 h-4" />
                <span>إنشاء هدف استراتيجي</span>
              </button>
            )}
          </div>

          {/* لوحة التقدم العام */}
          {milestones.length > 0 && (
            <div className="bg-theme-panel border border-theme-border rounded-3xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 text-right">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-theme-text-muted">الأهداف الاستراتيجية الكلية</span>
                <p className="text-2xl font-black text-theme-text">{milestones.length}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-emerald-500">الأهداف المكتملة</span>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {milestones.filter(m => m.status === 'completed').length}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-sky-500">الأهداف النشطة</span>
                <p className="text-2xl font-black text-sky-600 dark:text-sky-400">
                  {milestones.filter(m => m.status === 'active').length}
                </p>
              </div>
            </div>
          )}

          {/* شبكة الأهداف الكبرى */}
          {milestones.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center bg-theme-panel rounded-3xl border border-dashed border-theme-border">
              <TrendingUp className="w-16 h-16 text-theme-text-muted mb-3 opacity-60 animate-pulse" />
              <h3 className="text-sm font-bold text-theme-text">لم يتم تخطيط أهداف استراتيجية بعد</h3>
              <p className="text-xs text-theme-text-muted max-w-xs mt-1 leading-relaxed">
                لا تتوفر أهداف أو محطات كبرى في خريطة الطريق حالياً. اطلب من مشرف النظام تخطيط هدف لربطه بالمهام واليوميات!
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {milestones.map((milestone) => {
                const isExpanded = expandedMilestoneId === milestone.id
                
                return (
                  <div
                    key={milestone.id}
                    className="bg-theme-panel border border-theme-border rounded-3xl p-6 shadow-sm flex flex-col gap-5 text-right relative overflow-hidden transition-all duration-200"
                  >
                    <div className="absolute top-0 right-0 left-0 h-1 bg-theme-border"></div>

                    {/* معلومات المحطة ورأس الكارت */}
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1.5 flex-1 min-w-[240px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${statusMap[milestone.status]?.color}`}>
                            {statusMap[milestone.status]?.label}
                          </span>
                          <span className="text-[10px] font-bold text-theme-text-muted flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>الموعد النهائي: {milestone.due_date}</span>
                          </span>
                        </div>
                        <h3 className="text-base font-black text-theme-text">{milestone.title}</h3>
                        {milestone.description && (
                          <p className="text-xs text-theme-text-muted leading-relaxed max-w-2xl">
                            {milestone.description}
                          </p>
                        )}
                      </div>

                      {/* أزرار التحكم للأدمن */}
                      {currentProfile.role === 'admin' && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(milestone)}
                            className="p-2 hover:bg-theme-bg text-theme-text-muted hover:text-theme-accent rounded-xl border border-theme-border transition-colors cursor-pointer"
                            title="تعديل الهدف"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMilestone(milestone.id)}
                            className="p-2 hover:bg-rose-950/20 text-theme-text-muted hover:text-rose-500 rounded-xl border border-theme-border transition-colors cursor-pointer"
                            title="حذف الهدف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* شريط التقدم الفاخر */}
                    <div className="space-y-2 border-t border-theme-border/60 pt-4">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-theme-text flex items-center gap-1.5">
                          <ListTodo className="w-4 h-4 text-theme-text-muted" />
                          <span>تقدم مهام المحطة الاستراتيجية</span>
                        </span>
                        <span className="text-theme-accent">{milestone.progress}%</span>
                      </div>
                      
                      <div className="w-full bg-theme-bg h-3.5 rounded-full overflow-hidden border border-theme-border/60 p-0.5 shadow-inner">
                        <div 
                          className="bg-gradient-to-l from-theme-accent to-theme-accent/60 h-full rounded-full transition-all duration-500 ease-out shadow-sm"
                          style={{ width: `${milestone.progress}%` }}
                        ></div>
                      </div>

                      <div className="flex items-center justify-between text-[9px] text-theme-text-muted">
                        <span>إجمالي المهام المرتبطة: <strong>{milestone.totalTasks}</strong></span>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-600 font-medium">المنجزة: <strong>{milestone.completedTasks}</strong></span>
                          <span className="w-1 h-1 bg-theme-border rounded-full"></span>
                          <span className="text-amber-600 font-medium">المتبقية: <strong>{milestone.totalTasks - milestone.completedTasks}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* قسم المهام الفرعية القابل للتوسيع */}
                    {milestone.totalTasks > 0 && (
                      <div className="border-t border-theme-border/60 pt-3">
                        <button
                          type="button"
                          onClick={() => setExpandedMilestoneId(isExpanded ? null : milestone.id)}
                          className="text-[10px] font-bold text-theme-text-muted hover:text-theme-accent flex items-center gap-1 cursor-pointer"
                        >
                          <span>{isExpanded ? 'إخفاء المهام المرتبطة' : 'استعراض المهام المندرجة تحت هذا الهدف'}</span>
                        </button>

                        {isExpanded && milestone.tasks && (
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 animate-modal-in">
                            {milestone.tasks.map((task) => (
                              <div
                                key={task.id}
                                className="bg-theme-bg/40 border border-theme-border/60 rounded-xl p-3 flex items-center justify-between gap-3 text-right"
                              >
                                <span className={`text-[11px] font-bold text-theme-text ${task.status === 'completed' ? 'line-through text-theme-text-muted' : ''}`}>
                                  {task.title}
                                </span>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${
                                  task.status === 'completed'
                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                }`}>
                                  {task.status === 'completed' ? 'مكتملة' : 'قيد العمل'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                )
              })}
            </div>
          )}

        </div>
      </main>

      {/* ================== النوافذ المنبثقة (Modals) ================== */}

      {/* 1. نافذة إنشاء هدف جديد */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setIsAddModalOpen(false)}></div>
          <div className="relative bg-theme-panel w-full max-w-md mx-4 rounded-3xl p-6 sm:p-8 shadow-2xl border border-theme-border animate-modal-in z-10 text-right">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-theme-text">إنشاء هدف استراتيجي جديد</h3>
                <p className="text-xs text-theme-text-muted mt-1">تحديد محطة كبرى لتقسيم عمر المشروع وربط المهام اليومية بها</p>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-theme-text-muted hover:text-theme-text hover:bg-theme-bg rounded-xl transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMilestone} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">عنوان الهدف الاستراتيجي</label>
                <input 
                  type="text" 
                  name="title" 
                  required 
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none" 
                  placeholder="مثال: إطلاق النسخة التجريبية (Beta)"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">وصف الهدف والمخرجات المتوقعة</label>
                <textarea 
                  name="description" 
                  rows={3}
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none resize-none" 
                  placeholder="اكتب المخرجات الرئيسية للهدف (Key Results) بالتفصيل..."
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">الموعد النهائي لتحقيق الهدف</label>
                <DatePicker 
                  value={milestoneDueDate}
                  onChange={setMilestoneDueDate}
                  className="py-3 bg-theme-input focus:bg-theme-panel"
                  direction="up"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isPending}
                  className="w-full bg-theme-accent hover:bg-theme-accent-hover text-theme-panel font-bold py-3.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-98"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري إنشاء الهدف...</span>
                    </>
                  ) : (
                    <span>إنشاء الهدف الاستراتيجي</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. نافذة تعديل هدف قائم */}
      {isEditModalOpen && milestoneToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => { setIsEditModalOpen(false); setMilestoneToEdit(null); }}></div>
          <div className="relative bg-theme-panel w-full max-w-md mx-4 rounded-3xl p-6 sm:p-8 shadow-2xl border border-theme-border animate-modal-in z-10 text-right">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-theme-text">تعديل الهدف الاستراتيجي</h3>
                <p className="text-xs text-theme-text-muted mt-1">تحديث عنوان وتفاصيل وحالة المحطة الكبرى</p>
              </div>
              <button 
                onClick={() => { setIsEditModalOpen(false); setMilestoneToEdit(null); }}
                className="p-1.5 text-theme-text-muted hover:text-theme-text hover:bg-theme-bg rounded-xl transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateMilestone} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">عنوان الهدف الاستراتيجي</label>
                <input 
                  type="text" 
                  name="title" 
                  required 
                  defaultValue={milestoneToEdit.title}
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none" 
                  placeholder="مثال: إطلاق النسخة التجريبية (Beta)"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">وصف الهدف والمخرجات المتوقعة</label>
                <textarea 
                  name="description" 
                  rows={3}
                  defaultValue={milestoneToEdit.description || ''}
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none resize-none" 
                  placeholder="اكتب المخرجات الرئيسية للهدف (Key Results) بالتفصيل..."
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">الموعد النهائي لتحقيق الهدف</label>
                <DatePicker 
                  value={milestoneDueDate}
                  onChange={setMilestoneDueDate}
                  className="py-3 bg-theme-input focus:bg-theme-panel"
                  direction="up"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">حالة الهدف الحالية</label>
                <select 
                  name="status"
                  defaultValue={milestoneToEdit.status}
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none cursor-pointer font-semibold"
                >
                  <option value="active">نشط 🚀</option>
                  <option value="completed">مكتملة 💯</option>
                  <option value="delayed">متأخرة ⚠️</option>
                </select>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isPending}
                  className="w-full bg-theme-accent hover:bg-theme-accent-hover text-theme-panel font-bold py-3.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-98"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري حفظ التغييرات...</span>
                    </>
                  ) : (
                    <span>حفظ التعديلات</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* التنبيهات المنبثقة */}
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
