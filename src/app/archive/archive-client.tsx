'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import DatePicker from '@/components/DatePicker'
import { Calendar as CalendarIcon, ClipboardCheck, AlertCircle, Clock } from 'lucide-react'
import { getArchiveTasks } from '../actions'

interface Profile {
  id: string
  name: string
  email: string
  role: string
  avatar_url: string
}

interface ArchiveClientProps {
  currentProfile: Profile
}

// خريطة لتنسيق ألوان المهام التاريخية
const colorClassMap: Record<string, { card: string; badge: string }> = {
  'classic': {
    card: 'bg-theme-panel border-theme-border hover:border-theme-accent text-theme-text',
    badge: 'bg-theme-bg text-theme-text-muted'
  },
  'pastel-red': {
    card: 'bg-rose-500/10 border-rose-500/20 hover:border-rose-500/50 text-theme-text',
    badge: 'bg-rose-500/20 text-rose-450'
  },
  'pastel-blue': {
    card: 'bg-sky-500/10 border-sky-500/20 hover:border-sky-500/50 text-theme-text',
    badge: 'bg-sky-500/20 text-sky-400'
  },
  'pastel-green': {
    card: 'bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/50 text-theme-text',
    badge: 'bg-emerald-500/20 text-emerald-400'
  },
  'pastel-amber': {
    card: 'bg-amber-500/10 border-amber-500/20 hover:border-amber-500/50 text-theme-text',
    badge: 'bg-amber-500/20 text-amber-400'
  },
  'pastel-purple': {
    card: 'bg-purple-500/10 border-purple-500/20 hover:border-purple-500/50 text-theme-text',
    badge: 'bg-purple-500/20 text-purple-400'
  },
  'pastel-neutral': {
    card: 'bg-orange-500/10 border-orange-500/20 hover:border-orange-500/50 text-theme-text',
    badge: 'bg-orange-500/20 text-orange-400'
  }
}

export default function ArchiveClient({ currentProfile }: ArchiveClientProps) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  
  const [completedTasks, setCompletedTasks] = useState<any[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null)

  useEffect(() => {
    fetchArchiveData()
    setSelectedUserId('all') // إعادة تعيين الفلترة عند تغيير التاريخ
  }, [selectedDate])

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, type })
  }

  const fetchArchiveData = async () => {
    try {
      setIsLoading(true)
      const data = await getArchiveTasks(selectedDate)
      setCompletedTasks(data)
    } catch (err: any) {
      showToast('فشل جلب الأرشيف: ' + err.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-grow flex flex-col min-h-screen pb-24 md:pb-8">
      <Header user={currentProfile} />

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <section className="space-y-6 animate-modal-in">
          
          <div className="border-b border-theme-border pb-5 text-right">
            <h1 className="text-2xl font-bold text-theme-text">سجل الإنجاز التاريخي</h1>
            <p className="text-xs text-theme-text-muted mt-1">اختر أي يوم على طول السنوات والشهور لاستعراض المهام التي أتمها الفريق بنجاح في هذا اليوم</p>
          </div>

          {/* بطاقة التحكم واختيار التاريخ عبر السنوات */}
          <div className="bg-theme-panel rounded-2xl p-6 border border-theme-border shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 text-right">
              <div className="w-12 h-12 bg-theme-accent text-theme-panel rounded-xl flex items-center justify-center font-bold text-lg shrink-0">
                🗓️
              </div>
              <div>
                <h3 className="text-sm font-bold text-theme-text">مستكشف التقويم المستمر</h3>
                <p className="text-xs text-theme-text-muted mt-0.5">يمكنك تغيير السنة واليوم بحرية للتحقق من الموثوقية</p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-stretch md:self-auto w-full md:w-auto">
              <label className="text-xs font-bold text-theme-text-muted hidden sm:block">اختر التاريخ المطلوب:</label>
              <DatePicker 
                value={selectedDate}
                onChange={setSelectedDate}
                className="py-3 text-base md:text-xs min-w-[180px]"
              />
            </div>
          </div>

          {/* نتائج الإنجاز المكتملة في ذلك اليوم */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme-border pb-3">
              <div className="flex items-center justify-between gap-2 px-1 w-full sm:w-auto">
                <h2 className="text-sm font-bold text-theme-text">المهام المنجزة في التاريخ المحدد</h2>
                <span className="text-xs font-bold text-theme-panel bg-theme-accent px-3 py-1 rounded-full sm:hidden">
                  {selectedDate}
                </span>
              </div>
              <span className="text-xs font-bold text-theme-panel bg-theme-accent px-3 py-1 rounded-full hidden sm:inline">
                {selectedDate}
              </span>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-theme-text-muted">
                <Clock className="w-8 h-8 animate-spin mb-2" />
                <span className="text-xs">جاري تحميل سجل الإنجاز...</span>
              </div>
            ) : completedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 text-center bg-theme-panel rounded-2xl border border-dashed border-theme-border">
                <ClipboardCheck className="w-12 h-12 text-theme-text-muted mb-3 opacity-60" />
                <h3 className="text-sm font-bold text-theme-text">لم يتم إنجاز مهام في هذا اليوم</h3>
                <p className="text-xs text-theme-text-muted max-w-xs mt-1 leading-relaxed">
                  لم يتم إكمال أو تسليم أي مهام في التاريخ المحدد عبر كافة المجموعات النشطة.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* تبويبات تصفية الإنجازات حسب أعضاء الفريق */}
                {(() => {
                  const uniqueAssignees = Array.from(
                    new Map(
                      completedTasks
                        .filter(t => t.assignee)
                        .map(t => [t.assigned_to, { id: t.assigned_to, ...t.assignee }])
                    ).values()
                  ) as any[]

                  const displayedTasks = selectedUserId === 'all'
                    ? completedTasks
                    : completedTasks.filter(t => t.assigned_to === selectedUserId)

                  const getUserTaskCount = (userId: string) => {
                    return completedTasks.filter(t => t.assigned_to === userId).length
                  }

                  return (
                    <>
                      {uniqueAssignees.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide select-none">
                          <button
                            onClick={() => setSelectedUserId('all')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                              selectedUserId === 'all'
                                ? 'bg-theme-accent text-theme-panel shadow-sm'
                                : 'bg-theme-panel border border-theme-border text-theme-text-muted hover:text-theme-text hover:border-theme-accent'
                            }`}
                          >
                            الجميع ({completedTasks.length})
                          </button>
                          {uniqueAssignees.map((user) => {
                            const count = getUserTaskCount(user.id)
                            const isActive = selectedUserId === user.id
                            return (
                              <button
                                key={user.id}
                                onClick={() => setSelectedUserId(user.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                                  isActive
                                    ? 'bg-theme-accent text-theme-panel shadow-sm'
                                    : 'bg-theme-panel border border-theme-border text-theme-text-muted hover:text-theme-text hover:border-theme-accent'
                                }`}
                              >
                                <img 
                                  src={user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100&auto=format&fit=crop'} 
                                  alt={user.name} 
                                  className="w-4 h-4 rounded-full object-cover"
                                />
                                <span>{user.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                                  isActive ? 'bg-theme-panel text-theme-text' : 'bg-theme-bg text-theme-text-muted'
                                }`}>
                                  {count}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {displayedTasks.map((task) => {
                          const style = colorClassMap[task.color] || colorClassMap.classic
                          return (
                            <div 
                              key={task.id}
                              className={`border rounded-2xl p-5 flex flex-col justify-between text-right ${style.card}`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <span className={`text-[9px] font-bold px-2.5 py-1 rounded-md ${style.badge}`}>
                                    {task.group ? task.group.name : 'مجموعة العمل'}
                                  </span>
                                  <span className="text-[10px] text-emerald-500 bg-emerald-950/20 px-2 py-0.5 rounded font-bold">
                                    ✓ مكتملة
                                  </span>
                                </div>
                                
                                <h4 className="text-xs font-bold text-theme-text mb-1.5">{task.title}</h4>
                                <p className="text-xs text-theme-text-muted line-clamp-3 leading-relaxed">
                                  {task.description || 'لا يوجد وصف تفصيلي لهذه المهمة.'}
                                </p>
                              </div>

                              <div className="mt-4 pt-3 border-t border-theme-border flex items-center justify-between text-[10px] text-theme-text-muted">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-theme-text">المنفّذ:</span>
                                  <span>{task.assignee ? task.assignee.name : 'غير محدد'}</span>
                                </div>
                                <div>
                                  <span>تم الإكمال: {task.completed_date}</span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
          </div>

        </section>
      </main>

      {/* عرض التنبيهات المنبثقة */}
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
