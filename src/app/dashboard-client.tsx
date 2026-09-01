'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import DatePicker from '@/components/DatePicker'
import Link from 'next/link'
import { 
  FolderKanban, 
  Calendar as CalendarIcon, 
  Plus, 
  ArrowRight, 
  Trash2, 
  Eye, 
  FolderCheck, 
  AlertCircle,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  Edit2,
  Pin,
  ChevronDown
} from 'lucide-react'
import { 
  getGroups, 
  createGroup, 
  deleteGroup, 
  updateGroup,
  getTasks, 
  addTask, 
  updateTaskStatus, 
  deleteTask, 
  migrateTasks,
  updateTaskDetails
} from './actions'

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
  due_date: string
  status: string
}

interface DashboardClientProps {
  currentProfile: Profile
  teamProfiles: Profile[]
  initialMilestones: Milestone[]
  youtubeVideos?: any[]
}

// خريطة ترجمة الألوان للفئات المعتمدة في التصميم الفاخر
const colorClassMap: Record<string, { card: string; badge: string; border: string }> = {
  'classic': {
    card: 'bg-theme-panel border-theme-border hover:border-theme-accent text-theme-text',
    badge: 'bg-theme-bg text-theme-text-muted',
    border: 'border-theme-border'
  },
  'pastel-red': {
    card: 'bg-rose-500/10 border-rose-500/20 hover:border-rose-500/50 text-theme-text',
    badge: 'bg-rose-500/20 text-rose-400',
    border: 'border-rose-500/20'
  },
  'pastel-blue': {
    card: 'bg-sky-500/10 border-sky-500/20 hover:border-sky-500/50 text-theme-text',
    badge: 'bg-sky-500/20 text-sky-400',
    border: 'border-sky-500/20'
  },
  'pastel-green': {
    card: 'bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/50 text-theme-text',
    badge: 'bg-emerald-500/20 text-emerald-400',
    border: 'border-emerald-500/20'
  },
  'pastel-amber': {
    card: 'bg-amber-500/10 border-amber-500/20 hover:border-amber-500/50 text-theme-text',
    badge: 'bg-amber-500/20 text-amber-400',
    border: 'border-amber-500/20'
  },
  'pastel-purple': {
    card: 'bg-purple-500/10 border-purple-500/20 hover:border-purple-500/50 text-theme-text',
    badge: 'bg-purple-500/20 text-purple-400',
    border: 'border-purple-500/20'
  },
  'pastel-neutral': {
    card: 'bg-orange-500/10 border-orange-500/20 hover:border-orange-500/50 text-theme-text',
    badge: 'bg-orange-500/20 text-orange-400',
    border: 'border-orange-500/20'
  }
}

export default function DashboardClient({ currentProfile, teamProfiles, initialMilestones, youtubeVideos = [] }: DashboardClientProps) {
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones || [])
  
  // حالة التاريخ المختار
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })

  // مجموعات العمل النشطة وتفاصيل الجلب
  const [groups, setGroups] = useState<any[]>([])
  const [isLoadingGroups, setIsLoadingGroups] = useState(true)

  // المجموعة المفتوحة حالياً وعرض التفاصيل
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [activeGroup, setActiveGroup] = useState<any | null>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [isLoadingTasks, setIsLoadingTasks] = useState(false)
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'completed'>('all')

  // النوافذ المنبثقة
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [isConfirmDeleteGroupOpen, setIsConfirmDeleteGroupOpen] = useState(false)
  const [groupIdToDelete, setGroupIdToDelete] = useState<string | null>(null)
  
  // تعديل المجموعات
  const [isEditGroupModalOpen, setIsEditGroupModalOpen] = useState(false)
  const [groupToEdit, setGroupToEdit] = useState<any | null>(null)

  // نافذة تسجيل الوقت عند إنجاز المهمة
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false)
  const [completionTaskId, setCompletionTaskId] = useState<string | null>(null)
  const [completionTaskTitle, setCompletionTaskTitle] = useState('')
  const [completionTaskCurrentMinutes, setCompletionTaskCurrentMinutes] = useState(0)
  const [completionHours, setCompletionHours] = useState('0')
  const [completionMinutes, setCompletionMinutes] = useState('0')
  const [completionDate, setCompletionDate] = useState('')
  const [isSavingCompletion, setIsSavingCompletion] = useState(false)

  // إشعار Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null)

  const [taskDueDate, setTaskDueDate] = useState('')
  const [selectedVideoId, setSelectedVideoId] = useState('')
  const [taskVideoStepId, setTaskVideoStepId] = useState('')

  // تصفية المجموعات للآدمن (مجموعاتي، المجموعات العامة، الشركاء الآخرين)
  const [activeTab, setActiveTab] = useState<string>('my-groups')
  const [isPartnerDropdownOpen, setIsPartnerDropdownOpen] = useState(false)

  useEffect(() => {
    if (isTaskModalOpen) {
      setTaskDueDate(selectedDate)
      setSelectedVideoId('')
      setTaskVideoStepId('')
    }
  }, [isTaskModalOpen, selectedDate])

  // جلب المجموعات عند تغيير التاريخ
  useEffect(() => {
    setActiveTab('my-groups')
    setIsPartnerDropdownOpen(false)
    fetchGroupsList()
  }, [selectedDate])

  // جلب مهام المجموعة عند تغيير المجموعة المفتوحة أو الفلترة
  useEffect(() => {
    if (activeGroupId) {
      fetchTasksList()
    }
  }, [activeGroupId, taskFilter])

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, type })
  }

  const fetchGroupsList = async () => {
    try {
      setIsLoadingGroups(true)
      const data = await getGroups(selectedDate)
      setGroups(data)
    } catch (err: any) {
      showToast('فشل جلب مجموعات العمل: ' + err.message, 'error')
    } finally {
      setIsLoadingGroups(false)
    }
  }

  const fetchTasksList = async () => {
    if (!activeGroupId) return
    try {
      setIsLoadingTasks(true)
      const data = await getTasks(activeGroupId, taskFilter, selectedDate)
      setTasks(data)
    } catch (err: any) {
      showToast('فشل جلب المهام: ' + err.message, 'error')
    } finally {
      setIsLoadingTasks(false)
    }
  }

  const handleOpenGroup = (group: any) => {
    setActiveGroupId(group.id)
    setActiveGroup(group)
    setTaskFilter('all')
  }

  const handleCloseGroup = () => {
    setActiveGroupId(null)
    setActiveGroup(null)
    setTasks([])
    fetchGroupsList() // تحديث الإحصائيات في الكروت
  }

  // إنشاء مجموعة عمل جديدة
  const handleCreateGroup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    const name = formData.get('name') as string
    const color = formData.get('color') as string
    const assignedTo = formData.get('assigned_to') as string
    const isPermanent = formData.get('is_permanent') === 'on'

    try {
      await createGroup(name, color, selectedDate, assignedTo || undefined, isPermanent)
      showToast(`تم إنشاء المجموعة الجديدة: ${name} بنجاح!`, 'success')
      setIsGroupModalOpen(false)
      form.reset()
      fetchGroupsList()
    } catch (err: any) {
      showToast('فشل إنشاء المجموعة: ' + err.message, 'error')
    }
  }

  // تعديل مجموعة عمل
  const handleEditGroupClick = (e: React.MouseEvent, group: any) => {
    e.stopPropagation()
    e.preventDefault()
    setGroupToEdit(group)
    setIsEditGroupModalOpen(true)
  }

  const handleUpdateGroup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!groupToEdit) return
    const form = e.currentTarget
    const formData = new FormData(form)
    const name = formData.get('name') as string
    const color = formData.get('color') as string
    const assignedTo = formData.get('assigned_to') as string
    const isPermanent = formData.get('is_permanent') === 'on'

    try {
      await updateGroup(groupToEdit.id, name, color, isPermanent, assignedTo || undefined)
      showToast(`تم تعديل المجموعة: ${name} بنجاح!`, 'success')
      setIsEditGroupModalOpen(false)
      setGroupToEdit(null)
      fetchGroupsList()
      // تحديث المجموعة النشطة حالياً إذا كانت هي التي تم تعديلها
      if (activeGroupId === groupToEdit.id) {
        const updatedGroups = await getGroups(selectedDate)
        const updatedGroup = updatedGroups.find((g: any) => g.id === groupToEdit.id)
        if (updatedGroup) {
          setActiveGroup(updatedGroup)
        }
      }
    } catch (err: any) {
      showToast('فشل تعديل المجموعة: ' + err.message, 'error')
    }
  }

  // حذف مجموعة عمل
  const handleDeleteGroupClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    e.preventDefault()
    setGroupIdToDelete(id)
    setIsConfirmDeleteGroupOpen(true)
  }

  const handleConfirmDeleteGroup = async () => {
    if (!groupIdToDelete) return
    try {
      await deleteGroup(groupIdToDelete)
      showToast('تم حذف وإلغاء مجموعة العمل بنجاح', 'success')
      fetchGroupsList()
    } catch (err: any) {
      showToast('فشل حذف المجموعة: ' + err.message, 'error')
    } finally {
      setIsConfirmDeleteGroupOpen(false)
      setGroupIdToDelete(null)
    }
  }

  // إضافة مهمة جديدة
  const handleAddTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!activeGroupId) return
    const form = e.currentTarget
    const formData = new FormData(form)
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const assignedTo = formData.get('assigned_to') as string
    const dueDate = formData.get('due_date') as string
    const color = formData.get('color') as string
    const milestoneId = formData.get('milestone_id') as string

    const videoId = formData.get('video_id') as string || null
    const videoPhase = formData.get('video_phase') as string || null
    const videoStepId = formData.get('video_step_id') as string || null

    try {
      await addTask(title, description, activeGroupId, assignedTo, dueDate, color, milestoneId || undefined, 0, videoId, videoPhase, videoStepId)
      showToast('تمت إضافة المهمة بنجاح لقائمة اليوم 🚀', 'success')
      setIsTaskModalOpen(false)
      form.reset()
      fetchTasksList()
    } catch (err: any) {
      showToast('فشل إضافة المهمة: ' + err.message, 'error')
    }
  }

  // تغيير حالة مهمة
  const handleToggleTaskStatus = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed'
    if (nextStatus === 'completed') {
      const taskToComplete = tasks.find(t => t.id === taskId)
      if (taskToComplete) {
        setCompletionTaskId(taskId)
        setCompletionTaskTitle(taskToComplete.title)
        setCompletionTaskCurrentMinutes(taskToComplete.work_minutes || 0)
        setCompletionHours('0')
        setCompletionMinutes('0')
        setCompletionDate(selectedDate || new Date().toISOString().split('T')[0])
        setIsCompletionModalOpen(true)
        return
      }
    }

    try {
      await updateTaskStatus(taskId, nextStatus)
      showToast('تمت إعادة المهمة إلى قائمة العمل الفعلي', 'success')
      fetchTasksList()
    } catch (err: any) {
      showToast('فشل تعديل حالة المهمة: ' + err.message, 'error')
    }
  }

  const handleConfirmCompletion = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!completionTaskId) return

    const hours = parseInt(completionHours || '0', 10)
    const minutes = parseInt(completionMinutes || '0', 10)
    const additionalMinutes = hours * 60 + minutes
    const newTotalMinutes = completionTaskCurrentMinutes + additionalMinutes

    try {
      setIsSavingCompletion(true)
      await updateTaskStatus(completionTaskId, 'completed', newTotalMinutes, completionDate)
      showToast('أحسنت! تم تسجيل الوقت وتأكيد إنجاز المهمة بنجاح 🚀', 'success')
      setIsCompletionModalOpen(false)
      setCompletionTaskId(null)
      fetchTasksList()
    } catch (err: any) {
      showToast('فشل إنجاز المهمة وتسجيل الوقت: ' + err.message, 'error')
    } finally {
      setIsSavingCompletion(false)
    }
  }

  const handleCompleteWithoutAddingTime = async () => {
    if (!completionTaskId) return
    try {
      setIsSavingCompletion(true)
      await updateTaskStatus(completionTaskId, 'completed', completionTaskCurrentMinutes, completionDate)
      showToast('أحسنت! تم تأكيد إنجاز المهمة بنجاح 🚀', 'success')
      setIsCompletionModalOpen(false)
      setCompletionTaskId(null)
      fetchTasksList()
    } catch (err: any) {
      showToast('فشل إنجاز المهمة: ' + err.message, 'error')
    } finally {
      setIsSavingCompletion(false)
    }
  }

  // ترحيل المهام غير المكتملة لليوم التالي
  const handleMigrateTasks = async () => {
    if (!activeGroupId) return
    if (!confirm('هل أنت متأكد من ترحيل جميع المهام غير المكتملة إلى اليوم التالي؟')) return

    try {
      const res = await migrateTasks(activeGroupId)
      if (res.success) {
        showToast(res.message, 'success')
        fetchTasksList()
      } else {
        showToast(res.message, 'warning')
      }
    } catch (err: any) {
      showToast('فشل ترحيل المهام: ' + err.message, 'error')
    }
  }

  // حذف مهمة
  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المهمة نهائياً؟')) return
    try {
      await deleteTask(taskId)
      showToast('تم حذف المهمة بنجاح', 'success')
      fetchTasksList()
    } catch (err: any) {
      showToast('فشل حذف المهمة: ' + err.message, 'error')
    }
  }

  // تصفية مجموعات العمل (موقرة للمستخدم الحالي فقط)
  const filteredGroups = groups

  return (
    <div className="flex-grow flex flex-col min-h-screen pb-24 md:pb-8">
      <Header user={currentProfile} />

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        
        {/* واجهة المجموعات الافتراضية */}
        {!activeGroupId && (
          <section className="space-y-8 animate-modal-in">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-theme-border pb-5">
              <div className="text-right">
                <h1 className="text-2xl font-bold text-theme-text">مجموعات العمل النشطة</h1>
                <p className="text-xs text-theme-text-muted mt-1">اضغط على أي مجموعة عمل لاستكشاف وإدارة المهام داخلها</p>
              </div>

              <div className="flex items-center gap-3 self-stretch md:self-auto justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-theme-text-muted hidden sm:inline">تاريخ المجموعات:</span>
                  <DatePicker 
                    value={selectedDate}
                    onChange={setSelectedDate}
                  />
                </div>

                {/* زر الإضافة متاح للجميع (لكن الصلاحيات مختلفة) */}
                <button 
                  onClick={() => setIsGroupModalOpen(true)}
                  className="bg-theme-accent hover:bg-theme-accent-hover text-theme-panel text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>إنشاء مجموعة</span>
                </button>
              </div>
            </div>

            {/* تم إخفاء تبويبات الفلترة لكون التطبيق مخصصاً للمستخدم الشخصي */}

            {/* شبكة كروت المجموعات */}
            {isLoadingGroups ? (
              <div className="flex flex-col items-center justify-center p-12 text-theme-text-muted">
                <Clock className="w-8 h-8 animate-spin mb-2" />
                <span className="text-xs">جاري تحميل مجموعات العمل...</span>
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 text-center bg-theme-panel rounded-3xl border border-dashed border-theme-border">
                <FolderKanban className="w-12 h-12 text-theme-text-muted mb-3 opacity-60" />
                <h3 className="text-sm font-bold text-theme-text">لا توجد مجموعات عمل لهذا اليوم</h3>
                <p className="text-xs text-theme-text-muted max-w-xs mt-1 leading-relaxed">
                  لم يتم العثور على مجموعات نشطة في هذا التاريخ. يمكنك إنشاء واحدة جديدة فوراً!
                </p>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 text-center bg-theme-panel rounded-3xl border border-dashed border-theme-border">
                <FolderKanban className="w-12 h-12 text-theme-text-muted mb-3 opacity-40" />
                <h3 className="text-sm font-bold text-theme-text">لا توجد مجموعات عمل في هذا القسم</h3>
                <p className="text-xs text-theme-text-muted max-w-xs mt-1 leading-relaxed">
                  لم يتم العثور على مجموعات نشطة تابعة للفلتر المختار لهذا اليوم.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredGroups.map((group) => {
                  const style = colorClassMap[group.color] || colorClassMap.classic
                  const canEditGroup = currentProfile.role === 'admin' || group.created_by === currentProfile.id
                  return (
                    <div 
                      key={group.id}
                      onClick={() => handleOpenGroup(group)}
                      className={`group relative border rounded-2xl p-5 hover:shadow-md transition-all duration-300 cursor-pointer text-right flex flex-col justify-between min-h-[190px] ${style.card}`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            {group.is_permanent && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-theme-accent bg-theme-accent/10 px-2.5 py-0.5 rounded-md" title="مجموعة عمل دائمة">
                                <Pin className="w-3 h-3 rotate-45" />
                                <span>دائمة</span>
                              </span>
                            )}
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${style.badge}`}>
                              {group.color === 'classic' ? 'مجموعة عمل' : 'مخصصة'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {canEditGroup && (
                              <button 
                                onClick={(e) => handleEditGroupClick(e, group)}
                                className="p-1 hover:bg-theme-bg text-theme-text-muted hover:text-theme-accent rounded-lg transition-colors cursor-pointer"
                                title="تعديل المجموعة"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {currentProfile.role === 'admin' && (
                              <button 
                                onClick={(e) => handleDeleteGroupClick(e, group.id)}
                                className="p-1 hover:bg-rose-950/20 text-theme-text-muted hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                                title="حذف المجموعة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <h3 className="text-sm font-bold text-theme-text transition-colors group-hover:text-theme-accent">
                          {group.name}
                        </h3>
                        <p className="text-xs text-theme-text-muted mt-1.5 line-clamp-2 leading-relaxed">
                          {group.assignee ? `مسند لـ: ${group.assignee.name}` : 'مجموعة عامة'}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-theme-border flex items-center justify-between gap-2 text-[10px] text-theme-text-muted">
                        <span>إجمالي المهام: <strong className="text-theme-text">{group.totalTasks}</strong></span>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-600 font-medium">منجزة: <strong>{group.completedTasks}</strong></span>
                          <span className="w-[1px] h-3 bg-theme-border"></span>
                          <span className="text-amber-600 font-medium">متبقية: <strong>{group.pendingTasks}</strong></span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* واجهة تفاصيل المجموعة الواحدة */}
        {activeGroupId && activeGroup && (
          <section className="space-y-6 animate-modal-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-theme-border pb-5">
              <div className="flex items-center gap-3 text-right">
                <button 
                  onClick={handleCloseGroup}
                  className="p-2.5 bg-theme-panel hover:bg-theme-bg text-theme-text rounded-xl border border-theme-border transition-all flex items-center justify-center shadow-sm cursor-pointer shrink-0"
                  aria-label="الرجوع لقائمة المجموعات"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
                <div>
                  <span className="inline-block bg-theme-bg text-theme-text-muted text-[9px] font-bold px-2 py-0.5 rounded-md mb-1">
                    تفاصيل مجموعة العمل
                  </span>
                  <h2 className="text-xl font-bold text-theme-text">{activeGroup.name}</h2>
                  <p className="text-xs text-theme-text-muted mt-0.5">
                    تاريخ المجموعة: {activeGroup.date} {activeGroup.assignee ? `| المسند إليه: ${activeGroup.assignee.name}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
                <select 
                  value={taskFilter}
                  onChange={(e) => setTaskFilter(e.target.value as any)}
                  className="text-xs bg-theme-panel border border-theme-border focus:border-theme-accent text-theme-text rounded-xl px-3 py-2.5 outline-none transition-all cursor-pointer font-semibold w-full md:w-48"
                >
                  <option value="all">كل حالات المهام</option>
                  <option value="pending">قيد التنفيذ فقط</option>
                  <option value="completed">المكتملة فقط</option>
                </select>

                <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-2">
                  <button 
                    onClick={handleMigrateTasks}
                    className="bg-theme-panel border border-theme-border hover:bg-theme-bg text-theme-text text-xs font-bold px-4 py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>ترحيل المهام</span>
                  </button>

                  <button 
                    onClick={() => setIsTaskModalOpen(true)}
                    className="bg-theme-accent hover:bg-theme-accent-hover text-theme-panel text-xs font-bold px-4 py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إسناد مهمة</span>
                  </button>
                </div>
              </div>
            </div>

            {/* شبكة المهام داخل المجموعة */}
            {isLoadingTasks ? (
              <div className="flex flex-col items-center justify-center p-12 text-theme-text-muted">
                <Clock className="w-8 h-8 animate-spin mb-2" />
                <span className="text-xs">جاري تحميل مهام المجموعة...</span>
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center bg-theme-panel rounded-2xl border border-dashed border-theme-border">
                <AlertCircle className="w-10 h-10 text-theme-text-muted mb-2 opacity-60" />
                <h3 className="text-xs font-bold text-theme-text">لا توجد مهام مطابقة</h3>
                <p className="text-[11px] text-theme-text-muted max-w-xs mt-1">
                  هذه المجموعة خالية تماماً من المهام المطابقة لخيارات الفلترة المحددة.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tasks.map((task) => {
                  const isCompleted = task.status === 'completed'
                  const style = colorClassMap[task.color] || colorClassMap.classic
                  return (
                    <div 
                      key={task.id}
                      className={`border rounded-2xl p-4 flex flex-col justify-between transition-all duration-205 text-right ${style.card}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <button 
                            onClick={() => handleToggleTaskStatus(task.id, task.status)}
                            className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                              isCompleted 
                                ? 'bg-theme-accent border-theme-accent text-theme-panel' 
                                : 'bg-theme-panel border-theme-border hover:border-theme-accent'
                            }`}
                          >
                            {isCompleted && <span className="text-[10px]">✓</span>}
                          </button>

                          <div>
                            <Link 
                              href={`/task/${task.id}`}
                              className={`text-xs font-bold block hover:underline text-theme-text ${
                                isCompleted ? 'line-through text-theme-text-muted' : ''
                              }`}
                            >
                              {task.title}
                            </Link>

                            {task.milestone && (
                              <span className="inline-block text-[9px] text-theme-accent bg-theme-accent/10 px-2 py-0.5 rounded-md mt-1 ml-1.5 font-bold">
                                🎯 {task.milestone.title}
                              </span>
                            )}

                            {task.migrated_from_date && (
                              <span className="inline-block text-[9px] text-amber-600 bg-amber-950/20 px-2 py-0.5 rounded-md mt-1">
                                ↬ مترحلة من يوم {task.migrated_from_date}
                              </span>
                            )}

                            <p className={`text-[11px] mt-1.5 line-clamp-2 leading-relaxed ${
                              isCompleted ? 'text-theme-text-muted/65' : 'text-theme-text-muted'
                            }`}>
                              {task.description || 'لا يوجد وصف تفصيلي للمهمة.'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Link 
                            href={`/task/${task.id}`}
                            className="p-1.5 hover:bg-theme-bg text-theme-text-muted hover:text-theme-accent rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                            title="عرض تفاصيل المهمة"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          {currentProfile.role === 'admin' && (
                            <button 
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-1.5 text-theme-text-muted hover:text-rose-600 hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer shrink-0"
                              title="حذف المهمة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-theme-border flex items-center justify-between text-[10px] text-theme-text-muted">
                        <div className="flex items-center gap-2 flex-wrap">
                          {task.work_minutes > 0 && (
                            <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-md font-bold text-[9px] flex items-center gap-1 border border-indigo-500/20">
                              ⏱️ {Math.floor(task.work_minutes / 60)}س {task.work_minutes % 60}د
                            </span>
                          )}
                          {task.video_id && (
                            <span className="bg-rose-500/10 text-rose-450 px-2 py-0.5 rounded-md font-bold text-[9px] border border-rose-500/20">
                              🎬 {task.video_phase === 'scripting' ? 'سيناريو' : 
                                  task.video_phase === 'recording' ? 'تصوير' : 
                                  task.video_phase === 'editing' ? 'مونتاج' : 
                                  task.video_phase === 'publishing' ? 'غلاف ونشر' : 'عمل آخر'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span>الموعد: {task.due_date}</span>
                          {isCompleted && task.completed_date && (
                            <span className="text-emerald-500">أنجزت في: {task.completed_date}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

      </main>

      {/* ================== النوافذ المنبثقة (Modals) ================== */}

      {/* أ) نافذة إنشاء مجموعة جديدة */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setIsGroupModalOpen(false)}></div>
          <div className="relative bg-theme-panel w-full max-w-md mx-4 rounded-3xl p-6 sm:p-8 shadow-2xl border border-theme-border animate-modal-in z-10 text-right">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-theme-text">إنشاء مجموعة عمل جديدة</h3>
                <p className="text-xs text-theme-text-muted mt-1">تستخدم المجموعات لتقسيم العمل والمهام اليومية للفريق</p>
              </div>
              <button 
                onClick={() => setIsGroupModalOpen(false)}
                className="p-1.5 text-theme-text-muted hover:text-theme-text hover:bg-theme-bg rounded-xl transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">اسم المجموعة / المشروع</label>
                <input 
                  type="text" 
                  name="name" 
                  required 
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none" 
                  placeholder="مثال: تطوير متجر الهواتف"
                />
              </div>

              <input type="hidden" name="assigned_to" value={currentProfile.id} />

              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-2">اختر لون المجموعة:</label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {Object.keys(colorClassMap).map((colorKey) => (
                    <label key={colorKey} className="cursor-pointer">
                      <input 
                        type="radio" 
                        name="color" 
                        value={colorKey} 
                        defaultChecked={colorKey === 'classic'}
                        className="peer sr-only"
                      />
                      <div className="peer-checked:ring-2 peer-checked:ring-theme-accent border border-theme-border rounded-xl py-2 px-1 text-center text-[10px] font-bold bg-theme-panel text-theme-text transition-all select-none">
                        {colorKey === 'classic' ? 'أبيض' : 
                         colorKey === 'pastel-red' ? 'وردي' : 
                         colorKey === 'pastel-blue' ? 'سماوي' : 
                         colorKey === 'pastel-green' ? 'زمردي' : 
                         colorKey === 'pastel-amber' ? 'ذهبي' : 
                         colorKey === 'pastel-purple' ? 'بنفسجي' : 'رملي'}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 py-2">
                <input 
                  type="checkbox" 
                  name="is_permanent" 
                  id="is_permanent"
                  className="w-4 h-4 rounded border-theme-border text-theme-accent focus:ring-theme-accent bg-theme-input accent-[var(--theme-accent)] cursor-pointer"
                />
                <label htmlFor="is_permanent" className="text-xs font-bold text-theme-text-muted cursor-pointer select-none">
                  مجموعة عمل دائمة (تظهر في كل يوم تلقائياً)
                </label>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  className="w-full bg-theme-accent hover:bg-theme-accent-hover text-theme-panel font-bold py-3.5 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  إنشاء المجموعة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ب) نافذة إسناد مهمة جديدة */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setIsTaskModalOpen(false)}></div>
          <div className="relative bg-theme-panel w-full max-w-3xl mx-4 rounded-3xl p-6 sm:p-8 shadow-2xl border border-theme-border animate-modal-in z-10 text-right">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-theme-text">إسناد مهمة جديدة</h3>
                <p className="text-xs text-theme-text-muted mt-1">اختر المسؤول وتاريخ التسليم ولون التمييز البصري للكرت</p>
              </div>
              <button 
                onClick={() => setIsTaskModalOpen(false)}
                className="p-1.5 text-theme-text-muted hover:text-theme-text hover:bg-theme-bg rounded-xl transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTask} className="space-y-5">
              <input type="hidden" name="assigned_to" value={currentProfile.id} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* العمود الأيمن: تفاصيل المهمة الأساسية */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-theme-text-muted mb-1.5">عنوان المهمة</label>
                    <input 
                      type="text" 
                      name="title" 
                      required 
                      className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none" 
                      placeholder="مثال: تفعيل بوابات الدفع الإلكتروني"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-theme-text-muted mb-1.5">الوصف والتفاصيل</label>
                    <textarea 
                      name="description" 
                      rows={6}
                      className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none resize-none h-[calc(100%-2rem)] min-h-[120px]" 
                      placeholder="اكتب الخطوات أو المتطلبات لإنجاز هذه المهمة..."
                    ></textarea>
                  </div>
                </div>

                {/* العمود الأيسر: إعدادات وخيارات المهمة */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-theme-text-muted mb-1.5">الموعد النهائي للتسليم</label>
                    <DatePicker 
                      name="due_date"
                      value={taskDueDate}
                      onChange={setTaskDueDate}
                      className="bg-theme-input focus:bg-theme-panel py-3"
                      direction="up"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-theme-text-muted mb-1.5">المحطة الكبرى المرتبطة (Milestone)</label>
                    <select 
                      name="milestone_id"
                      className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none cursor-pointer"
                    >
                      <option value="">أعمال عامة / غير مرتبطة بمحطة</option>
                      {milestones.filter(m => m.status === 'active').map(m => (
                        <option key={m.id} value={m.id}>🎯 {m.title}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-theme-text-muted mb-1.5">فيديو مرتبط بقناتك (اختياري)</label>
                    <select 
                      name="video_id"
                      value={selectedVideoId}
                      onChange={(e) => {
                        setSelectedVideoId(e.target.value)
                        setTaskVideoStepId('')
                      }}
                      className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none cursor-pointer font-semibold"
                    >
                      <option value="">عمل عام / غير مرتبط بفيديو</option>
                      {youtubeVideos.map(v => (
                        <option key={v.id} value={v.id}>🎬 {v.title}</option>
                      ))}
                    </select>
                  </div>

                  {selectedVideoId && (() => {
                    const currentVid = youtubeVideos.find(v => v.id === selectedVideoId)
                    const videoSteps = currentVid?.steps || []
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-modal-in">
                        <div>
                          <label className="block text-xs font-bold text-theme-text-muted mb-1">مرحلة إنتاج الفيديو</label>
                          <select 
                            name="video_phase"
                            className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none cursor-pointer font-semibold"
                          >
                            <option value="other">أخرى / عمل عام</option>
                            <option value="scripting">✍️ السيناريو والكتابة</option>
                            <option value="recording">🎙️ التصوير والتسجيل</option>
                            <option value="editing">🎬 المونتاج والتحريك</option>
                            <option value="publishing">🎨 الغلاف والنشر</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-theme-text-muted mb-1">خطوة الإنتاج المحددة</label>
                          <select 
                            name="video_step_id"
                            value={taskVideoStepId}
                            onChange={(e) => setTaskVideoStepId(e.target.value)}
                            className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none cursor-pointer font-semibold"
                          >
                            <option value="">غير مرتبط بخطوة</option>
                            {videoSteps.map((step: any) => {
                              const phaseLabels: Record<string, string> = {
                                scripting: 'سيناريو',
                                recording: 'تسجيل',
                                editing: 'مونتاج',
                                publishing: 'نشر',
                                other: 'أخرى'
                              }
                              const phaseLabel = phaseLabels[step.phase || 'other'] || 'أخرى'
                              return (
                                <option key={step.id} value={step.id}>
                                  {step.title} ({phaseLabel})
                                </option>
                              )
                            })}
                          </select>
                        </div>
                      </div>
                    )
                  })()}
                </div>

              </div>

              {/* قسم اختيار الألوان والزر النهائي أسفل العمودين بكامل العرض */}
              <div className="border-t border-theme-border pt-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-theme-text-muted mb-2">اختر لون بوكس المهمة للتمييز البصري:</label>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    {Object.keys(colorClassMap).map((colorKey) => (
                      <label key={colorKey} className="cursor-pointer">
                        <input 
                          type="radio" 
                          name="color" 
                          value={colorKey} 
                          defaultChecked={colorKey === 'classic'}
                          className="peer sr-only"
                        />
                        <div className="peer-checked:ring-2 peer-checked:ring-theme-accent border border-theme-border rounded-xl py-2.5 px-1 text-center text-[10px] font-bold bg-theme-panel text-theme-text transition-all select-none hover:bg-theme-bg">
                          {colorKey === 'classic' ? 'أبيض' : 
                           colorKey === 'pastel-red' ? 'وردي' : 
                           colorKey === 'pastel-blue' ? 'سماوي' : 
                           colorKey === 'pastel-green' ? 'زمردي' : 
                           colorKey === 'pastel-amber' ? 'ذهبي' : 
                           colorKey === 'pastel-purple' ? 'بنفسجي' : 'رملي'}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <button 
                    type="submit" 
                    className="w-full bg-theme-accent hover:bg-theme-accent-hover text-theme-panel font-bold py-4 rounded-xl text-xs transition-colors cursor-pointer shadow-sm active:scale-98"
                  >
                    إسناد المهمة للمجموعة
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ج) تأكيد حذف مجموعة عمل */}
      {isConfirmDeleteGroupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setIsConfirmDeleteGroupOpen(false)}></div>
          <div className="relative bg-theme-panel w-full max-w-md mx-4 rounded-3xl p-6 sm:p-8 shadow-2xl border border-theme-border animate-modal-in z-10 text-right">
            <h3 className="text-base font-bold text-theme-text mb-2">تأكيد الحذف</h3>
            <p className="text-xs text-theme-text-muted mb-6 leading-relaxed">
              هل أنت متأكد من حذف هذه المجموعة؟ سيتم حذف جميع المهام والملفات بداخلها بشكل نهائي ولا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button 
                onClick={() => setIsConfirmDeleteGroupOpen(false)}
                className="px-4 py-2.5 bg-theme-input hover:bg-theme-border text-theme-text text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button 
                onClick={handleConfirmDeleteGroup}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                نعم، احذف نهائياً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* د) نافذة تعديل مجموعة عمل */}
      {isEditGroupModalOpen && groupToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => { setIsEditGroupModalOpen(false); setGroupToEdit(null); }}></div>
          <div className="relative bg-theme-panel w-full max-w-md mx-4 rounded-3xl p-6 sm:p-8 shadow-2xl border border-theme-border animate-modal-in z-10 text-right">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-theme-text">تعديل مجموعة العمل</h3>
                <p className="text-xs text-theme-text-muted mt-1">تعديل تفاصيل المجموعة وخيارات ظهورها</p>
              </div>
              <button 
                onClick={() => { setIsEditGroupModalOpen(false); setGroupToEdit(null); }}
                className="p-1.5 text-theme-text-muted hover:text-theme-text hover:bg-theme-bg rounded-xl transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">اسم المجموعة / المشروع</label>
                <input 
                  type="text" 
                  name="name" 
                  required 
                  defaultValue={groupToEdit.name}
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none" 
                  placeholder="مثال: تطوير متجر الهواتف"
                />
              </div>

              <input type="hidden" name="assigned_to" value={currentProfile.id} />

              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-2">اختر لون المجموعة:</label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {Object.keys(colorClassMap).map((colorKey) => (
                    <label key={colorKey} className="cursor-pointer">
                      <input 
                        type="radio" 
                        name="color" 
                        value={colorKey} 
                        defaultChecked={groupToEdit.color === colorKey}
                        className="peer sr-only"
                      />
                      <div className="peer-checked:ring-2 peer-checked:ring-theme-accent border border-theme-border rounded-xl py-2 px-1 text-center text-[10px] font-bold bg-theme-panel text-theme-text transition-all select-none">
                        {colorKey === 'classic' ? 'أبيض' : 
                         colorKey === 'pastel-red' ? 'وردي' : 
                         colorKey === 'pastel-blue' ? 'سماوي' : 
                         colorKey === 'pastel-green' ? 'زمردي' : 
                         colorKey === 'pastel-amber' ? 'ذهبي' : 
                         colorKey === 'pastel-purple' ? 'بنفسجي' : 'رملي'}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 py-2">
                <input 
                  type="checkbox" 
                  name="is_permanent" 
                  id="edit_is_permanent"
                  defaultChecked={groupToEdit.is_permanent}
                  className="w-4 h-4 rounded border-theme-border text-theme-accent focus:ring-theme-accent bg-theme-input accent-[var(--theme-accent)] cursor-pointer"
                />
                <label htmlFor="edit_is_permanent" className="text-xs font-bold text-theme-text-muted cursor-pointer select-none">
                  مجموعة عمل دائمة (تظهر في كل يوم تلقائياً)
                </label>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  className="w-full bg-theme-accent hover:bg-theme-accent-hover text-theme-panel font-bold py-3.5 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* هـ) نافذة تسجيل الوقت عند إنجاز المهمة */}
      {isCompletionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => { if (!isSavingCompletion) setIsCompletionModalOpen(false) }}></div>
          <div className="relative bg-theme-panel w-full max-w-md mx-4 rounded-3xl p-6 sm:p-8 shadow-2xl border border-theme-border animate-modal-in z-10 text-right">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-theme-text">تسجيل وقت إنجاز المهمة</h3>
                <p className="text-xs text-theme-text-muted mt-1">لقد قمت بإنجاز المهمة: <strong className="text-theme-text">{completionTaskTitle}</strong></p>
              </div>
              <button 
                onClick={() => setIsCompletionModalOpen(false)}
                disabled={isSavingCompletion}
                className="p-1.5 text-theme-text-muted hover:text-theme-text hover:bg-theme-bg rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmCompletion} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">تاريخ الإنجاز (تلقائياً تاريخ اليوم المختار):</label>
                <DatePicker 
                  value={completionDate}
                  onChange={setCompletionDate}
                  className="bg-theme-input focus:bg-theme-panel py-3"
                  direction="up"
                />
              </div>

              {completionTaskCurrentMinutes > 0 && (
                <div className="bg-theme-bg/50 border border-theme-border rounded-xl p-3.5 text-xs text-theme-text-muted">
                  ⏱️ الوقت المسجل سابقاً على هذه المهمة: <strong className="text-theme-text">{Math.floor(completionTaskCurrentMinutes / 60)}س {completionTaskCurrentMinutes % 60}د</strong>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-theme-text-muted">كم عدد الساعات والدقائق الإضافية التي استغرقتها لإنجاز المهمة؟</label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-theme-text-muted mb-1">عدد الساعات</label>
                    <input 
                      type="number" 
                      min="0"
                      value={completionHours}
                      onChange={(e) => setCompletionHours(e.target.value)}
                      className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none" 
                      placeholder="ساعات"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-theme-text-muted mb-1">عدد الدقائق</label>
                    <input 
                      type="number" 
                      min="0"
                      max="59"
                      value={completionMinutes}
                      onChange={(e) => setCompletionMinutes(e.target.value)}
                      className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none" 
                      placeholder="دقائق"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-theme-text-muted mt-1 leading-relaxed">
                  * سيتم إضافة هذا الوقت إلى إجمالي ساعات إنجاز المهمة.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button 
                  type="submit" 
                  disabled={isSavingCompletion}
                  className="w-full bg-theme-accent hover:bg-theme-accent-hover disabled:bg-neutral-300 text-theme-panel font-bold py-3.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSavingCompletion ? (
                    <>
                      <span className="w-4 h-4 border-2 border-theme-panel border-t-transparent rounded-full animate-spin"></span>
                      <span>جاري الحفظ وتأكيد الإنجاز...</span>
                    </>
                  ) : (
                    <span>حفظ الوقت وتأكيد الإنجاز ⏱️✓</span>
                  )}
                </button>
                
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    type="button"
                    onClick={handleCompleteWithoutAddingTime}
                    disabled={isSavingCompletion}
                    className="w-full bg-theme-input hover:bg-theme-border disabled:opacity-50 text-theme-text font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer text-center"
                  >
                    إنجاز بدون إضافة وقت
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsCompletionModalOpen(false)}
                    disabled={isSavingCompletion}
                    className="w-full bg-theme-input hover:bg-theme-border disabled:opacity-50 text-theme-text font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer text-center"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

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
