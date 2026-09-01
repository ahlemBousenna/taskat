'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import webpush from 'web-push'

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      'https://taskini-murex.vercel.app',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )
  } catch (err) {
    console.error('Error setting VAPID details:', err)
  }
}

// جلب معلومات المستخدم الحالي وملف تعريفه
export async function getCurrentUserProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile) {
    profile.role = 'admin' // Force user to be admin for personal single-user capabilities
  }

  return profile
}

// جلب قائمة المستخدمين (للإسناد ولتبويب فريق العمل)
export async function getProfiles() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}

// جلب مجموعات العمل لتاريخ محدد مع إحصائيات المهام
export async function getGroups(dateString: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  let query = supabase
    .from('task_groups')
    .select(`
      *,
      creator:profiles!task_groups_created_by_fkey(name, email, avatar_url),
      assignee:profiles!task_groups_assigned_to_fkey(name, email, avatar_url)
    `)
    .or(`date.eq.${dateString},is_permanent.eq.true`)

  const { data: groups, error } = await query.order('created_at', { ascending: true })
  if (error) throw new Error(error.message)

  // إذا لم يكن مسؤولاً، يرى فقط المجموعات التي أنشأها أو أسندت إليه
  const filteredGroups = profile.role === 'admin'
    ? (groups || [])
    : (groups || []).filter(g => g.created_by === profile.id || g.assigned_to === profile.id)

  // جلب إحصائيات المهام لكل مجموعة
  const groupsWithStats = await Promise.all(
    filteredGroups.map(async (group) => {
      let tasksQuery = supabase
        .from('tasks')
        .select('id, status, assigned_to')
        .eq('group_id', group.id)

      // إذا كانت المجموعة دائمة، نقوم بحساب الإحصائيات لليوم المحدد فقط
      if (group.is_permanent) {
        tasksQuery = tasksQuery.eq('due_date', dateString)
      }

      // للمستخدم العادي: نعد فقط المهام الخاصة به في هذه المجموعة
      if (profile.role !== 'admin') {
        tasksQuery = tasksQuery.eq('assigned_to', profile.id)
      }

      const { data: tasks } = await tasksQuery
      const total = tasks?.length || 0
      const completed = tasks?.filter(t => t.status === 'completed').length || 0
      const pending = total - completed

      return {
        ...group,
        totalTasks: total,
        completedTasks: completed,
        pendingTasks: pending
      }
    })
  )

  return groupsWithStats
}

// إنشاء مجموعة جديدة
export async function createGroup(name: string, color: string, date: string, assignedTo?: string, isPermanent: boolean = false) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const newGroup = {
    name,
    color,
    date,
    created_by: profile.id,
    assigned_to: profile.role === 'admin' ? (assignedTo || profile.id) : profile.id,
    is_permanent: isPermanent
  }

  const { data, error } = await supabase
    .from('task_groups')
    .insert(newGroup)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/')
  return data
}

// حذف مجموعة عمل
export async function deleteGroup(groupId: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  let query = supabase
    .from('task_groups')
    .delete()
    .eq('id', groupId)

  // إذا لم يكن مشرفاً، لا يمكنه حذف المجموعات إلا التي أنشأها بنفسه
  if (profile.role !== 'admin') {
    query = query.eq('created_by', profile.id)
  }

  const { error } = await query
  if (error) throw new Error(error.message)

  revalidatePath('/')
  return { success: true }
}

// تعديل مجموعة عمل
export async function updateGroup(
  groupId: string,
  name: string,
  color: string,
  isPermanent: boolean,
  assignedTo?: string
) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // التأكد من الصلاحية (منشئ المجموعة أو مسؤول)
  const { data: group } = await supabase
    .from('task_groups')
    .select('created_by')
    .eq('id', groupId)
    .single()

  if (!group) throw new Error('المجموعة غير موجودة')
  if (profile.role !== 'admin' && group.created_by !== profile.id) {
    throw new Error('ليست لديك الصلاحية لتعديل هذه المجموعة')
  }

  const updateData: any = {
    name,
    color,
    is_permanent: isPermanent
  }

  if (profile.role === 'admin') {
    updateData.assigned_to = assignedTo || null
  }

  const { data, error } = await supabase
    .from('task_groups')
    .update(updateData)
    .eq('id', groupId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/')
  return data
}

// جلب المهام التابعة لمجموعة عمل مع الفرز بالتاريخ للمجموعات الدائمة
export async function getTasks(groupId: string, statusFilter: string = 'all', dateString?: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // جلب تفاصيل المجموعة لمعرفة ما إذا كانت دائمة
  const { data: group } = await supabase
    .from('task_groups')
    .select('is_permanent')
    .eq('id', groupId)
    .single()

  let query = supabase
    .from('tasks')
    .select(`
      *,
      assignee:profiles!tasks_assigned_to_fkey(name, email, avatar_url),
      milestone:project_milestones(id, title)
    `)
    .eq('group_id', groupId)

  if (group?.is_permanent && dateString) {
    query = query.eq('due_date', dateString)
  }

  // الفرز حسب حالة المهمة
  if (statusFilter === 'pending') {
    query = query.neq('status', 'completed')
  } else if (statusFilter === 'completed') {
    query = query.eq('status', 'completed')
  }

  // إذا لم يكن مسؤولاً، يرى فقط مهامه المسندة إليه
  if (profile.role !== 'admin') {
    query = query.eq('assigned_to', profile.id)
  }

  const { data: tasks, error } = await query.order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return tasks || []
}

// إضافة مهمة جديدة وإسنادها
export async function addTask(
  title: string,
  description: string,
  groupId: string,
  assignedTo: string,
  dueDate: string,
  color: string,
  milestoneId?: string | null,
  workMinutes?: number,
  videoId?: string | null,
  videoPhase?: string | null,
  videoStepId?: string | null
) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const newTask = {
    group_id: groupId,
    title,
    description,
    assigned_to: profile.role === 'admin' ? assignedTo : profile.id,
    due_date: dueDate,
    color,
    status: 'not_started',
    milestone_id: milestoneId || null,
    work_minutes: workMinutes || 0,
    video_id: videoId || null,
    video_phase: videoPhase || null,
    video_step_id: videoStepId || null
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert(newTask)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/')
  revalidatePath('/roadmap')
  revalidatePath('/youtube')
  return data
}

// تعديل حالة مهمة
export async function updateTaskStatus(taskId: string, newStatus: string, workMinutes?: number, completedDate?: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // التأكد من الصلاحية (أن المهمة مسندة للمستخدم أو أنه مسؤول)
  const { data: task } = await supabase
    .from('tasks')
    .select('assigned_to')
    .eq('id', taskId)
    .single()

  if (!task) throw new Error('المهمة غير موجودة')
  if (profile.role !== 'admin' && task.assigned_to !== profile.id) {
    throw new Error('ليست لديك الصلاحية لتعديل حالة هذه المهمة')
  }

  const todayStr = new Date().toISOString().split('T')[0]
  const finalCompletedDate = newStatus === 'completed'
    ? (completedDate || todayStr)
    : null

  const updateData: any = {
    status: newStatus,
    completed_date: finalCompletedDate
  }

  if (workMinutes !== undefined) {
    updateData.work_minutes = workMinutes
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', taskId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/')
  revalidatePath('/roadmap')
  revalidatePath('/archive')
  return data
}

// تعديل نصوص وتفاصيل مهمة
export async function updateTaskDetails(
  taskId: string,
  title: string,
  description: string,
  milestoneId?: string | null,
  assignedTo?: string | null,
  dueDate?: string | null,
  color?: string | null,
  workMinutes?: number,
  videoId?: string | null,
  videoPhase?: string | null,
  videoStepId?: string | null
) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const updateData: any = {
    title,
    description,
    milestone_id: milestoneId || null
  }

  if (assignedTo !== undefined) updateData.assigned_to = assignedTo || null
  if (dueDate !== undefined) updateData.due_date = dueDate
  if (color !== undefined) updateData.color = color
  if (workMinutes !== undefined) updateData.work_minutes = workMinutes
  if (videoId !== undefined) updateData.video_id = videoId || null
  if (videoPhase !== undefined) updateData.video_phase = videoPhase || null
  if (videoStepId !== undefined) updateData.video_step_id = videoStepId || null

  const { error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', taskId)

  if (error) throw new Error(error.message)
  revalidatePath('/')
  revalidatePath('/roadmap')
  revalidatePath('/youtube')
  return { success: true }
}

// حذف مهمة (Admin Only)
export async function deleteTask(taskId: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'admin') throw new Error('صلاحيات غير كافية')

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)

  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}

// ترحيل المهام غير المكتملة لليوم التالي
export async function migrateTasks(groupId: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // 1. جلب بيانات المجموعة الحالية
  const { data: group } = await supabase
    .from('task_groups')
    .select('*')
    .eq('id', groupId)
    .single()

  if (!group) throw new Error('المجموعة غير موجودة')

  // 2. جلب المهام غير المكتملة
  let tasksQuery = supabase
    .from('tasks')
    .select('*')
    .eq('group_id', groupId)
    .neq('status', 'completed')

  // للمستخدم العادي: ترحيل مهامه الخاصة فقط
  if (profile.role !== 'admin') {
    tasksQuery = tasksQuery.eq('assigned_to', profile.id)
  }

  const { data: unfinishedTasks, error: tasksError } = await tasksQuery
  if (tasksError) throw new Error(tasksError.message)
  if (!unfinishedTasks || unfinishedTasks.length === 0) {
    return { success: false, message: 'لا توجد مهام غير مكتملة لترحيلها.' }
  }

  // 3. تحديد تاريخ الغد
  const currentDate = new Date(group.date)
  currentDate.setDate(currentDate.getDate() + 1)
  const tomorrowStr = currentDate.toISOString().split('T')[0]

  // 4. البحث عن مجموعة الغد أو إنشائها
  let nextGroupId = ''
  const { data: nextGroup } = await supabase
    .from('task_groups')
    .select('id')
    .eq('name', group.name)
    .eq('date', tomorrowStr)
    .single()

  if (nextGroup) {
    nextGroupId = nextGroup.id
  } else {
    // إنشاء مجموعة جديدة للغد
    const { data: newGroup, error: groupCreateError } = await supabase
      .from('task_groups')
      .insert({
        name: group.name,
        color: group.color,
        date: tomorrowStr,
        created_by: group.created_by,
        assigned_to: group.assigned_to
      })
      .select()
      .single()

    if (groupCreateError) throw new Error(groupCreateError.message)
    nextGroupId = newGroup.id
  }

  // 5. تحديث المجموعات للمهام المترحلة
  const taskIds = unfinishedTasks.map(t => t.id)
  const { error: updateTasksError } = await supabase
    .from('tasks')
    .update({
      group_id: nextGroupId,
      migrated_from_date: group.date
    })
    .in('id', taskIds)

  if (updateTasksError) throw new Error(updateTasksError.message)

  revalidatePath('/')
  return { success: true, message: 'تم ترحيل المهام بنجاح!' }
}

// إنشاء حساب مستخدم جديد (Admin Only)
export async function createTeamUser(name: string, email: string, role: 'admin' | 'user') {
  const adminProfile = await getCurrentUserProfile()
  if (!adminProfile || adminProfile.role !== 'admin') {
    throw new Error('صلاحيات غير كافية لإنشاء مستخدمين')
  }

  // استخدام Admin Client لتفادي تفعيل تسجيل الدخول التلقائي أو إرسال تأكيد بالبريد الإلكتروني
  const adminSupabase = createAdminClient()

  // كلمة مرور افتراضية مبدئية: اسم المستخدم + 123
  const defaultPassword = 'user123'

  const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: {
      name,
      role
    }
  })

  if (authError) throw new Error(authError.message)

  // ملاحظة: جدول profiles سيتم تعبئته تلقائياً من خلال المحفّز (trigger) الذي أنشأناه في قاعدة البيانات.
  
  revalidatePath('/team')
  return { 
    success: true, 
    user: authData.user, 
    message: `تم إنشاء الحساب بنجاح. كلمة المرور الافتراضية هي: ${defaultPassword}` 
  }
}

// جلب المهام المنجزة في تاريخ محدد (لسجل الإنجاز)
export async function getArchiveTasks(dateString: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  let query = supabase
    .from('tasks')
    .select(`
      *,
      group:task_groups(name, color),
      assignee:profiles!tasks_assigned_to_fkey(name, email, avatar_url)
    `)
    .eq('status', 'completed')
    .eq('completed_date', dateString)

  // إذا لم يكن مسؤولاً، يرى فقط مهامه المكتملة هو بنفسه
  if (profile.role !== 'admin') {
    query = query.eq('assigned_to', profile.id)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data || []
}

// جلب الملفات المرفقة لمهمة محددة
export async function getTaskFiles(taskId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('task_files')
    .select('*')
    .eq('task_id', taskId)
    .order('uploaded_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

// حذف ملف مرفق لمهمة
export async function deleteTaskFile(fileId: string, filePath: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // 1. حذف الملف من مخزن Supabase Storage السحابي
  const { error: storageError } = await supabase.storage
    .from('task-attachments')
    .remove([filePath])

  if (storageError) throw new Error(storageError.message)

  // 2. حذف مسار الملف من جدول task_files لقاعدة البيانات
  const { error: dbError } = await supabase
    .from('task_files')
    .delete()
    .eq('id', fileId)

  if (dbError) throw new Error(dbError.message)

  return { success: true }
}

// رفع ملف مرفق لمهمة سحابياً إلى Supabase Storage
export async function uploadTaskFile(taskId: string, formData: FormData) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const file = formData.get('task_file') as File
  if (!file || file.size === 0) throw new Error('الملف المختار غير صالح')

  // تحويل الملف لـ ArrayBuffer للرفع السحابي
  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)
  
  // تنظيف اسم الملف لتفادي المشاكل الأمنية ومشاكل المسارات
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const storagePath = `${taskId}/${Date.now()}_${cleanFileName}`

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('task-attachments')
    .upload(storagePath, buffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false
    })

  if (uploadError) throw new Error(uploadError.message)

  const { error: dbError } = await supabase
    .from('task_files')
    .insert({
      task_id: taskId,
      file_name: file.name,
      file_path: storagePath,
      uploaded_by: profile.id
    })

  if (dbError) {
    // التراجع عن رفع الملف السحابي في حال فشل الإدخال بقاعدة البيانات
    await supabase.storage.from('task-attachments').remove([storagePath])
    throw new Error(dbError.message)
  }

  revalidatePath(`/task/${taskId}`)
  return { success: true }
}

// تحديث بيانات الملف الشخصي (الاسم والأفاتار) للمستخدم الحالي
export async function updateProfile(name: string, formData?: FormData, newPassword?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح بالدخول')

  if (newPassword && newPassword.trim().length > 0) {
    if (newPassword.trim().length < 6) {
      throw new Error('يجب أن تكون كلمة المرور 6 أحرف على الأقل')
    }
    const { error: passError } = await supabase.auth.updateUser({
      password: newPassword
    })
    if (passError) throw new Error(passError.message)
  }

  let avatarUrl = null
  
  if (formData) {
    const file = formData.get('avatar_file') as File
    if (file && file.size > 0) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)
      
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const storagePath = `avatars/${user.id}/${Date.now()}_${cleanFileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(storagePath, buffer, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) throw new Error(uploadError.message)

      avatarUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/task-attachments/${storagePath}`
    }
  }

  const updateData: any = { name }
  if (avatarUrl) {
    updateData.avatar_url = avatarUrl
  }

  // تحديث جدول profiles
  const { error: dbError } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', user.id)

  if (dbError) throw new Error(dbError.message)

  // تحديث بيانات Auth metadata
  const { error: authError } = await supabase.auth.updateUser({
    data: { 
      name, 
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}) 
    }
  })

  if (authError) throw new Error(authError.message)

  revalidatePath('/')
  return { success: true, avatarUrl }
}

// جلب شبكة المتاحية للمستخدم المحدد
export async function getUserAvailability(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_availability')
    .select('*')
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  return data || []
}

// تحديث حالة ساعة معينة في جدول المتاحية للمستخدم الحالي
export async function updateAvailabilitySlot(dayOfWeek: number, hour: number, status: 'available' | 'unavailable' | 'maybe') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح بالدخول')

  const { data, error } = await supabase
    .from('user_availability')
    .upsert({
      user_id: user.id,
      day_of_week: dayOfWeek,
      hour: hour,
      status: status,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,day_of_week,hour'
    })

  if (error) throw new Error(error.message)
  return { success: true }
}

// جلب تقارير اليوميات (daily standup) لتاريخ محدد مع تفاعلاتها وتعليقاتها
export async function getDailyStandups(dateString: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data, error } = await supabase
    .from('daily_standups')
    .select(`
      *,
      user:profiles(name, email, avatar_url),
      milestone:project_milestones(id, title),
      reactions:standup_reactions(user_id, reaction_type),
      comments:standup_comments(*, user:profiles(name, avatar_url))
    `)
    .eq('date', dateString)

  if (error) throw new Error(error.message)
  return data || []
}

// حفظ أو تحديث التقرير اليومي للمستخدم الحالي
export async function submitDailyStandup(
  todayTasks: string,
  tomorrowTasks: string,
  blockers: string,
  mood: 'energetic' | 'stable' | 'tired' | 'stressed',
  progressRate: 'all' | 'most' | 'half' | 'low',
  productivityScore: number,
  dateString: string,
  milestoneId?: string | null,
  workMinutes: number = 0
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح بالدخول')

  const { data, error } = await supabase
    .from('daily_standups')
    .upsert({
      user_id: user.id,
      date: dateString,
      today_tasks: todayTasks,
      tomorrow_tasks: tomorrowTasks,
      blockers: blockers || null,
      mood,
      progress_rate: progressRate,
      productivity_score: productivityScore,
      milestone_id: milestoneId || null,
      work_minutes: workMinutes,
      created_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,date'
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // إرسال إشعار لحظي لبقية أعضاء الفريق
  try {
    const profile = await getCurrentUserProfile()
    const userName = profile?.name || 'زميل لك'

    // استخدام حساب الأدمن (Service Role) لتخطي RLS لجلب اشتراكات بقية الفريق
    const adminSupabase = createAdminClient()
    const { data: subscriptions } = await adminSupabase
      .from('push_subscriptions')
      .select('id, user_id, subscription')
      .neq('user_id', user.id)

    if (subscriptions && subscriptions.length > 0) {
      const payload = JSON.stringify({
        title: 'تحديث يومي جديد 🚀',
        body: `قام ${userName} بكتابة تحديثه اليومي في اللقاء السريع.`,
        url: '/standup'
      })

      // إرسال الإشعارات بالتوازي وانتظارها لحل مشكلة Serverless timeout
      const pushPromises = subscriptions.map(async (subRecord: any) => {
        try {
          await webpush.sendNotification(subRecord.subscription, payload)
        } catch (pushErr: any) {
          // إذا كان الاشتراك منتهي أو تم إلغاؤه (410 أو 404)، نظف قاعدة البيانات منه باستخدام حساب الأدمن
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            console.log(`حذف اشتراك منتهي للمستخدم: ${subRecord.user_id}`)
            await adminSupabase
              .from('push_subscriptions')
              .delete()
              .eq('id', subRecord.id)
          } else {
            console.error('فشل إرسال إشعار Push لجهاز:', pushErr)
          }
        }
      })

      await Promise.allSettled(pushPromises)
    }
  } catch (pushGeneralErr) {
    console.error('خطأ عام أثناء معالجة الإشعارات اللحظية:', pushGeneralErr)
  }

  revalidatePath('/standup')
  return data
}

// حذف التقرير اليومي للمستخدم الحالي للتاريخ المحدد
export async function deleteDailyStandup(dateString: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح بالدخول')

  const { error } = await supabase
    .from('daily_standups')
    .delete()
    .eq('user_id', user.id)
    .eq('date', dateString)

  if (error) throw new Error(error.message)
  revalidatePath('/standup')
  return { success: true }
}

// جلب المحطات الكبرى (milestones) مع المهام التابعة لحساب التقدم
export async function getMilestones() {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // استعلام أمثل للأداء: جلب المحطات مع حقول id و status فقط من المهام المرتبطة
  const { data, error } = await supabase
    .from('project_milestones')
    .select(`
      *,
      tasks(id, status)
    `)
    .order('due_date', { ascending: true })

  if (error) throw new Error(error.message)

  // حساب نسبة التقدم لكل محطة
  const milestonesWithProgress = (data || []).map((milestone: any) => {
    const total = milestone.tasks?.length || 0
    const completed = milestone.tasks?.filter((t: any) => t.status === 'completed').length || 0
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0
    
    return {
      ...milestone,
      totalTasks: total,
      completedTasks: completed,
      progress
    }
  })

  return milestonesWithProgress
}

// إنشاء محطة كبرى جديدة (Admin Only)
export async function createMilestone(title: string, description: string, dueDate: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'admin') throw new Error('صلاحيات غير كافية')

  const { data, error } = await supabase
    .from('project_milestones')
    .insert({
      title,
      description,
      due_date: dueDate,
      status: 'active'
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/roadmap')
  return data
}

// تعديل محطة كبرى (Admin Only)
export async function updateMilestone(id: string, title: string, description: string, dueDate: string, status: 'active' | 'completed' | 'delayed') {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'admin') throw new Error('صلاحيات غير كافية')

  const { data, error } = await supabase
    .from('project_milestones')
    .update({
      title,
      description,
      due_date: dueDate,
      status
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/roadmap')
  return data
}

// حذف محطة كبرى (Admin Only)
export async function deleteMilestone(id: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'admin') throw new Error('صلاحيات غير كافية')

  const { error } = await supabase
    .from('project_milestones')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/roadmap')
  return { success: true }
}

// حفظ اشتراك إشعارات ويب لحظية للمستخدم الحالي
export async function savePushSubscription(subscription: any) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // حفظ الاشتراك في جدول push_subscriptions مع تجنب التكرار
  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: profile.id,
      subscription: subscription,
      created_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,subscription'
    })

  if (error) throw new Error(error.message)
  return { success: true }
}

// حذف اشتراك إشعارات ويب لحظية
export async function deletePushSubscription(endpoint: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // حذف الاشتراك بناءً على رابط الـ endpoint
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', profile.id)
    .eq('subscription->>endpoint', endpoint)

  if (error) throw new Error(error.message)
  return { success: true }
}

// جلب التقارير والإحصائيات الشهرية للأعضاء والفريق بالكامل
export async function getMonthlyAnalytics(month: number, year: number) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // 1. جلب التقارير اليومية للمستخدم الحالي في هذا الشهر (كاملة مع المحطة لعدم التأخير في العرض)
  const { data: standups, error: standupsError } = await supabase
    .from('daily_standups')
    .select('*, milestone:project_milestones(id, title)')
    .eq('user_id', profile.id)
    .gte('date', startDate)
    .lte('date', endDate)

  if (standupsError) throw new Error(standupsError.message)

  // 2. جلب كافة المهام المكتملة في هذا الشهر للمستخدم الحالي
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select(`
      id,
      title,
      completed_date,
      work_minutes,
      color,
      group_id,
      group:task_groups(id, name, color)
    `)
    .eq('assigned_to', profile.id)
    .eq('status', 'completed')
    .gte('completed_date', startDate)
    .lte('completed_date', endDate)

  if (tasksError) throw new Error(tasksError.message)

  // 3. حساب إجمالي ساعات المهام وساعات اليوميات
  const totalJournalMinutes = (standups || []).reduce((sum, s) => sum + (s.work_minutes || 0), 0)
  const totalTaskMinutes = (tasks || []).reduce((sum, t) => sum + (t.work_minutes || 0), 0)
  
  const totalJournalHours = Math.round((totalJournalMinutes / 60) * 10) / 10
  const totalTaskHours = Math.round((totalTaskMinutes / 60) * 10) / 10
  
  const daysLogged = (standups || []).length
  const avgProductivity = daysLogged > 0
    ? Math.round(((standups || []).reduce((sum, s) => sum + s.productivity_score, 0) / daysLogged) * 10) / 10
    : 0

  // 4. توزيع الوقت على المشاريع / مجموعات العمل (للرسم البياني)
  const groupHoursMap: Record<string, { name: string; color: string; minutes: number }> = {}
  
  // نجمع الدقائق من جميع مهام المستخدم (المكتملة والجارية في هذا الشهر)
  const { data: allUserTasks } = await supabase
    .from('tasks')
    .select('work_minutes, group:task_groups(id, name, color)')
    .eq('assigned_to', profile.id)
    .gte('due_date', startDate)
    .lte('due_date', endDate)

  if (allUserTasks) {
    allUserTasks.forEach((task: any) => {
      if (task.work_minutes > 0 && task.group) {
        const groupId = task.group.id
        if (!groupHoursMap[groupId]) {
          groupHoursMap[groupId] = {
            name: task.group.name,
            color: task.group.color,
            minutes: 0
          }
        }
        groupHoursMap[groupId].minutes += task.work_minutes
      }
    })
  }

  const groupDistribution = Object.values(groupHoursMap).map(g => ({
    name: g.name,
    color: g.color,
    totalMinutes: g.minutes,
    totalHours: Math.round((g.minutes / 60) * 10) / 10
  })).filter(g => g.totalHours > 0)

  // 5. جلب إحصائيات الشهر السابق للمقارنة
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const prevStartDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
  const prevLastDay = new Date(prevYear, prevMonth, 0).getDate()
  const prevEndDate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`

  // الشهر السابق: المهام واليوميات
  const { data: prevStandups } = await supabase
    .from('daily_standups')
    .select('work_minutes')
    .eq('user_id', profile.id)
    .gte('date', prevStartDate)
    .lte('date', prevEndDate)

  const { data: prevTasks } = await supabase
    .from('tasks')
    .select('work_minutes')
    .eq('assigned_to', profile.id)
    .eq('status', 'completed')
    .gte('completed_date', prevStartDate)
    .lte('completed_date', prevEndDate)

  const prevJournalMinutes = (prevStandups || []).reduce((sum, s) => sum + (s.work_minutes || 0), 0)
  const prevTaskMinutes = (prevTasks || []).reduce((sum, t) => sum + (t.work_minutes || 0), 0)
  
  const prevJournalHours = Math.round((prevJournalMinutes / 60) * 10) / 10
  const prevTaskHours = Math.round((prevTaskMinutes / 60) * 10) / 10
  const prevCompletedCount = (prevTasks || []).length

  // 6. تقسيم تفصيلي يومي للشهر الحالي (Daily activity list)
  const dailyBreakdown: Record<string, { date: string; workMinutes: number; journalMinutes: number; tasksCount: number; productivityScore: number; mood: string }> = {}
  
  // تهيئة الأيام
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    dailyBreakdown[dateStr] = {
      date: dateStr,
      workMinutes: 0,
      journalMinutes: 0,
      tasksCount: 0,
      productivityScore: 0,
      mood: ''
    }
  }

  // ملء بيانات اليوميات
  (standups || []).forEach(s => {
    if (dailyBreakdown[s.date]) {
      dailyBreakdown[s.date].journalMinutes = s.work_minutes
      dailyBreakdown[s.date].productivityScore = s.productivity_score
      dailyBreakdown[s.date].mood = s.mood
      // تخزين تفاصيل الجرنال اليومي بالكامل لتفادي استدعاء الخادم عند النقر
      ;(dailyBreakdown[s.date] as any).standupDetails = s
    }
  });

  // ملء بيانات المهام المكتملة
  (tasks || []).forEach(t => {
    if (t.completed_date && dailyBreakdown[t.completed_date]) {
      dailyBreakdown[t.completed_date].workMinutes += t.work_minutes
      dailyBreakdown[t.completed_date].tasksCount += 1
    }
  })

  return {
    personalSummary: {
      totalJournalHours,
      totalTaskHours,
      completedTasksCount: (tasks || []).length,
      daysLogged,
      avgProductivity,
      comparison: {
        hoursDiff: Math.round((totalTaskHours - prevTaskHours) * 10) / 10,
        tasksDiff: (tasks || []).length - prevCompletedCount,
        journalDiff: Math.round((totalJournalHours - prevJournalHours) * 10) / 10
      }
    },
    groupDistribution,
    dailyBreakdown: Object.values(dailyBreakdown).reverse() // من الأحدث للأقدم
  }
}

// 6. منسق الاجتماعات والتصويت أسبوعياً

// جلب متاحية كافة الأعضاء لبناء الـ Heatmap
export async function getAllMembersAvailability() {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data, error } = await supabase
    .from('user_availability')
    .select('*')

  if (error) throw new Error(error.message)
  return data || []
}

// جلب التصويتات النشطة
export async function getActivePolls() {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data: polls, error: pollsError } = await supabase
    .from('meeting_polls')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (pollsError) throw new Error(pollsError.message)
  if (!polls || polls.length === 0) return []

  const pollIds = polls.map(p => p.id)

  const { data: options, error: optionsError } = await supabase
    .from('meeting_poll_options')
    .select('*')
    .in('poll_id', pollIds)

  if (optionsError) throw new Error(optionsError.message)

  const optionIds = options?.map(o => o.id) || []
  let votes: any[] = []
  if (optionIds.length > 0) {
    const { data: votesData, error: votesError } = await supabase
      .from('meeting_poll_votes')
      .select('*, profile:profiles(name, avatar_url)')
      .in('option_id', optionIds)
    if (votesError) throw new Error(votesError.message)
    votes = votesData || []
  }

  return polls.map(poll => {
    const pollOptions = (options || []).filter(o => o.poll_id === poll.id).map(opt => {
      const optVotes = votes.filter(v => v.option_id === opt.id)
      return {
        ...opt,
        votes: optVotes
      }
    })
    return {
      ...poll,
      options: pollOptions
    }
  })
}

// إنشاء استطلاع موعد اجتماع جديد (Admin Only)
export async function createMeetingPoll(
  title: string,
  meetingType: 'online' | 'offline',
  options: { proposed_date: string; proposed_time: string }[]
) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'admin') throw new Error('صلاحيات غير كافية')

  const { data: poll, error: pollError } = await supabase
    .from('meeting_polls')
    .insert({
      title,
      meeting_type: meetingType,
      status: 'active'
    })
    .select()
    .single()

  if (pollError) throw new Error(pollError.message)

  const optionsToInsert = options.map(opt => ({
    poll_id: poll.id,
    proposed_date: opt.proposed_date,
    proposed_time: opt.proposed_time
  }))

  const { error: optionsError } = await supabase
    .from('meeting_poll_options')
    .insert(optionsToInsert)

  if (optionsError) {
    await supabase.from('meeting_polls').delete().eq('id', poll.id)
    throw new Error(optionsError.message)
  }

  try {
    const adminSupabase = createAdminClient()
    const { data: subscriptions } = await adminSupabase
      .from('push_subscriptions')
      .select('id, user_id, subscription')
      .neq('user_id', profile.id)

    if (subscriptions && subscriptions.length > 0) {
      const payload = JSON.stringify({
        title: 'استطلاع موعد اجتماع جديد 🗳️',
        body: `تم فتح تصويت جديد: "${title}". شاركنا مواعيدك المفضلة!`,
        url: '/availability'
      })

      const pushPromises = subscriptions.map(async (subRecord: any) => {
        try {
          await webpush.sendNotification(subRecord.subscription, payload)
        } catch (pushErr: any) {
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            await adminSupabase.from('push_subscriptions').delete().eq('id', subRecord.id)
          }
        }
      })
      await Promise.allSettled(pushPromises)
    }
  } catch (err) {
    console.error('Error sending poll push notification:', err)
  }

  revalidatePath('/availability')
  return poll
}

// حفظ تصويتات العضو
export async function submitMeetingVotes(pollId: string, optionIds: string[]) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data: pollOptions, error: optError } = await supabase
    .from('meeting_poll_options')
    .select('id')
    .eq('poll_id', pollId)

  if (optError) throw new Error(optError.message)
  const pollOptionIds = pollOptions.map(o => o.id)

  if (pollOptionIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('meeting_poll_votes')
      .delete()
      .eq('user_id', profile.id)
      .in('option_id', pollOptionIds)

    if (deleteError) throw new Error(deleteError.message)
  }

  if (optionIds.length > 0) {
    const votesToInsert = optionIds.map(optId => ({
      option_id: optId,
      user_id: profile.id
    }))

    const { error: insertError } = await supabase
      .from('meeting_poll_votes')
      .insert(votesToInsert)

    if (insertError) throw new Error(insertError.message)
  }

  revalidatePath('/availability')
  return { success: true }
}

// جدولة اجتماع جديد (Admin Only)
export async function scheduleMeeting(
  pollId: string | null,
  title: string,
  meetingType: 'online' | 'offline',
  date: string,
  time: string,
  locationUrl: string,
  notes: string
) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'admin') throw new Error('صلاحيات غير كافية')

  const { data: meeting, error: meetingError } = await supabase
    .from('scheduled_meetings')
    .insert({
      title,
      meeting_type: meetingType,
      meeting_date: date,
      meeting_time: time,
      location_url: locationUrl || null,
      notes: notes || null,
      created_by: profile.id
    })
    .select()
    .single()

  if (meetingError) throw new Error(meetingError.message)

  if (pollId) {
    const { error: pollError } = await supabase
      .from('meeting_polls')
      .update({ status: 'completed' })
      .eq('id', pollId)
    if (pollError) console.error('Error updating poll status:', pollError)
  }

  try {
    const adminSupabase = createAdminClient()
    const { data: subscriptions } = await adminSupabase
      .from('push_subscriptions')
      .select('id, user_id, subscription')
      .neq('user_id', profile.id)

    if (subscriptions && subscriptions.length > 0) {
      const typeLabel = meetingType === 'online' ? 'Google Meet' : 'لقاء حضوري'
      const payload = JSON.stringify({
        title: 'تم تحديد موعد الاجتماع! 📅',
        body: `تم جدولة اجتماع: "${title}" (${typeLabel}) يوم ${date} في تمام الساعة ${time.slice(0, 5)}.`,
        url: '/availability'
      })

      const pushPromises = subscriptions.map(async (subRecord: any) => {
        try {
          await webpush.sendNotification(subRecord.subscription, payload)
        } catch (pushErr: any) {
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            await adminSupabase.from('push_subscriptions').delete().eq('id', subRecord.id)
          }
        }
      })
      await Promise.allSettled(pushPromises)
    }
  } catch (err) {
    console.error('Error sending scheduled meeting push notification:', err)
  }

  revalidatePath('/availability')
  return meeting
}

// جلب الاجتماعات المجدولة
export async function getScheduledMeetings() {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const todayStr = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('scheduled_meetings')
    .select('*, creator:profiles(name, avatar_url)')
    .gte('meeting_date', todayStr)
    .order('meeting_date', { ascending: true })
    .order('meeting_time', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}

// حذف أو إلغاء اجتماع (Admin Only)
export async function deleteScheduledMeeting(meetingId: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'admin') throw new Error('صلاحيات غير كافية')

  const { error } = await supabase
    .from('scheduled_meetings')
    .delete()
    .eq('id', meetingId)

  if (error) throw new Error(error.message)

  revalidatePath('/availability')
  return { success: true }
}

// تعديل اجتماع مجدول (Admin Only)
export async function updateScheduledMeeting(
  meetingId: string,
  title: string,
  meetingType: 'online' | 'offline',
  date: string,
  time: string,
  locationUrl: string,
  notes: string
) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'admin') throw new Error('صلاحيات غير كافية')

  const { data: meeting, error } = await supabase
    .from('scheduled_meetings')
    .update({
      title,
      meeting_type: meetingType,
      meeting_date: date,
      meeting_time: time,
      location_url: locationUrl || null,
      notes: notes || null
    })
    .eq('id', meetingId)
    .select(`
      *,
      creator:profiles!scheduled_meetings_created_by_fkey(name, email, avatar_url)
    `)
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/availability')
  return meeting
}

// 7. تفاعلات وتعليقات اللقاء اليومي (Daily Standup Reactions & Comments)

// إضافة أو تعديل تفاعل إيموجي على تحديث يومي
export async function toggleStandupReaction(standupId: string, reactionType: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // التحقق من تفاعل المستخدم الحالي على هذه اليومية
  const { data: existing, error: fetchErr } = await supabase
    .from('standup_reactions')
    .select('id, reaction_type')
    .eq('standup_id', standupId)
    .eq('user_id', profile.id)
    .maybeSingle()

  if (fetchErr) throw new Error(fetchErr.message)

  if (existing) {
    if (existing.reaction_type === reactionType) {
      // إذا نقر على نفس التفاعل، نقوم بحذفه (Toggle off)
      const { error: deleteErr } = await supabase
        .from('standup_reactions')
        .delete()
        .eq('id', existing.id)
      if (deleteErr) throw new Error(deleteErr.message)
    } else {
      // إذا كان التفاعل مختلفاً، نقوم بتحديثه
      const { error: updateErr } = await supabase
        .from('standup_reactions')
        .update({ reaction_type: reactionType })
        .eq('id', existing.id)
      if (updateErr) throw new Error(updateErr.message)
    }
  } else {
    // إضافة تفاعل جديد
    const { error: insertErr } = await supabase
      .from('standup_reactions')
      .insert({
        standup_id: standupId,
        user_id: profile.id,
        reaction_type: reactionType
      })
    if (insertErr) throw new Error(insertErr.message)
  }

  revalidatePath('/standup')
  return { success: true }
}

// إضافة تعليق جديد (رئيسي أو رد متداخل)
export async function addStandupComment(standupId: string, content: string, parentId: string | null = null) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  if (!content.trim()) throw new Error('محتوى التعليق فارغ')

  const { data: comment, error: insertErr } = await supabase
    .from('standup_comments')
    .insert({
      standup_id: standupId,
      user_id: profile.id,
      parent_id: parentId,
      content: content.trim()
    })
    .select()
    .single()

  if (insertErr) throw new Error(insertErr.message)

  // إرسال إشعار Push موجه
  try {
    const adminSupabase = createAdminClient()
    
    // جلب معلومات كاتب التقرير اليومي
    const { data: standup } = await supabase
      .from('daily_standups')
      .select('user_id')
      .eq('id', standupId)
      .single()

    if (standup) {
      const targetUserIds = new Set<string>()
      let notificationTitle = 'تعليق جديد 💬'
      let notificationBody = `قام ${profile.name} بالتعليق على تحديثك اليومي.`

      if (parentId) {
        // هذا رد متداخل: جلب كاتب التعليق الأب لإرسال إشعار له
        const { data: parentComment } = await supabase
          .from('standup_comments')
          .select('user_id')
          .eq('id', parentId)
          .single()

        if (parentComment && parentComment.user_id !== profile.id) {
          targetUserIds.add(parentComment.user_id)
        }
        
        notificationTitle = 'رد جديد على تعليقك 💬'
        notificationBody = `قام ${profile.name} بالرد على تعليقك في اللقاء اليومي.`

        // نرسل أيضاً لصاحب التقرير اليومي إذا لم يكن هو كاتب الرد الحالي أو صاحب التعليق الأب
        if (standup.user_id !== profile.id && (!parentComment || standup.user_id !== parentComment.user_id)) {
          targetUserIds.add(standup.user_id)
        }
      } else {
        // تعليق رئيسي جديد: نرسل لصاحب التقرير فقط
        if (standup.user_id !== profile.id) {
          targetUserIds.add(standup.user_id)
        }
      }

      const targetList = Array.from(targetUserIds)
      if (targetList.length > 0) {
        const { data: subscriptions } = await adminSupabase
          .from('push_subscriptions')
          .select('id, user_id, subscription')
          .in('user_id', targetList)

        if (subscriptions && subscriptions.length > 0) {
          const payload = JSON.stringify({
            title: notificationTitle,
            body: notificationBody,
            url: '/standup'
          })

          const pushPromises = subscriptions.map(async (subRecord: any) => {
            try {
              await webpush.sendNotification(subRecord.subscription, payload)
            } catch (pushErr: any) {
              if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                await adminSupabase.from('push_subscriptions').delete().eq('id', subRecord.id)
              }
            }
          })
          await Promise.allSettled(pushPromises)
        }
      }
    }
  } catch (err) {
    console.error('Error sending comment push notification:', err)
  }

  revalidatePath('/standup')
  return comment
}

// حذف تعليق
export async function deleteStandupComment(commentId: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data: comment, error: fetchErr } = await supabase
    .from('standup_comments')
    .select('user_id')
    .eq('id', commentId)
    .single()

  if (fetchErr) throw new Error(fetchErr.message)

  // لا يحذف التعليق إلا صاحبه أو الأدمن
  if (profile.role !== 'admin' && comment.user_id !== profile.id) {
    throw new Error('غير مصرح لك بحذف هذا التعليق')
  }

  const { error: deleteErr } = await supabase
    .from('standup_comments')
    .delete()
    .eq('id', commentId)

  if (deleteErr) throw new Error(deleteErr.message)

  revalidatePath('/standup')
  return { success: true }
}

// تعديل تعليق
export async function updateStandupComment(commentId: string, content: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  if (!content.trim()) throw new Error('محتوى التعليق لا يمكن أن يكون فارغاً')

  const { data: comment, error: fetchErr } = await supabase
    .from('standup_comments')
    .select('user_id')
    .eq('id', commentId)
    .single()

  if (fetchErr) throw new Error(fetchErr.message)

  // لا يمكن تعديل التعليق إلا لصاحب التعليق نفسه
  if (comment.user_id !== profile.id) {
    throw new Error('غير مصرح لك بتعديل هذا التعليق')
  }

  const { data: updatedComment, error: updateErr } = await supabase
    .from('standup_comments')
    .update({ content: content.trim() })
    .eq('id', commentId)
    .select()
    .single()

  if (updateErr) throw new Error(updateErr.message)

  revalidatePath('/standup')
  return updatedComment
}

// --------------------------------------------------------------------
// 17. عمليات لوحة الأفكار والعصف الذهني (Ideas Board Actions)
// --------------------------------------------------------------------

export async function getIdeas() {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data, error } = await supabase
    .from('ideas')
    .select(`
      *,
      user:profiles!user_id(name, avatar_url),
      idea_upvotes(user_id),
      idea_comments(
        id,
        content,
        created_at,
        user_id,
        user:profiles!user_id(name, avatar_url)
      )
    `)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data || []).map((idea: any) => {
    const upvotes = idea.idea_upvotes || []
    const hasUpvoted = upvotes.some((u: any) => u.user_id === profile.id)
    
    // ترتيب التعليقات تصاعدياً حسب تاريخ الإنشاء
    const sortedComments = (idea.idea_comments || []).sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    return {
      ...idea,
      upvotes_count: upvotes.length,
      comments_count: sortedComments.length,
      idea_comments: sortedComments,
      has_upvoted: hasUpvoted
    }
  })
}

export async function createIdea(title: string, description: string, category: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  if (!title.trim()) throw new Error('عنوان الفكرة مطلوب')

  const { data, error } = await supabase
    .from('ideas')
    .insert({
      title: title.trim(),
      description: description.trim(),
      category,
      user_id: profile.id,
      status: 'draft'
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/ideas')
  return data
}

export async function toggleIdeaUpvote(ideaId: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data: existing, error: checkErr } = await supabase
    .from('idea_upvotes')
    .select('idea_id')
    .eq('idea_id', ideaId)
    .eq('user_id', profile.id)
    .maybeSingle()

  if (checkErr) throw new Error(checkErr.message)

  if (existing) {
    // إلغاء التصويت
    const { error: deleteErr } = await supabase
      .from('idea_upvotes')
      .delete()
      .eq('idea_id', ideaId)
      .eq('user_id', profile.id)

    if (deleteErr) throw new Error(deleteErr.message)
  } else {
    // إضافة تصويت جديد
    const { error: insertErr } = await supabase
      .from('idea_upvotes')
      .insert({
        idea_id: ideaId,
        user_id: profile.id
      })

    if (insertErr) throw new Error(insertErr.message)
  }

  revalidatePath('/ideas')
  return { success: true }
}

export async function addIdeaComment(ideaId: string, content: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  if (!content.trim()) throw new Error('محتوى التعليق لا يمكن أن يكون فارغاً')

  const { data, error } = await supabase
    .from('idea_comments')
    .insert({
      idea_id: ideaId,
      user_id: profile.id,
      content: content.trim()
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/ideas')
  return data
}

export async function deleteIdeaComment(commentId: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data: comment, error: fetchErr } = await supabase
    .from('idea_comments')
    .select('user_id')
    .eq('id', commentId)
    .single()

  if (fetchErr) throw new Error(fetchErr.message)

  if (comment.user_id !== profile.id && profile.role !== 'admin') {
    throw new Error('غير مصرح لك بحذف هذا التعليق')
  }

  const { error: deleteErr } = await supabase
    .from('idea_comments')
    .delete()
    .eq('id', commentId)

  if (deleteErr) throw new Error(deleteErr.message)

  revalidatePath('/ideas')
  return { success: true }
}

export async function convertIdeaToTask(
  ideaId: string,
  groupId: string,
  assignedTo: string | null,
  dueDate: string
) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // جلب الفكرة الأصلية
  const { data: idea, error: ideaErr } = await supabase
    .from('ideas')
    .select('*')
    .eq('id', ideaId)
    .single()

  if (ideaErr) throw new Error(ideaErr.message)

  // إنشاء المهمة الجديدة
  const { data: task, error: taskErr } = await supabase
    .from('tasks')
    .insert({
      group_id: groupId,
      title: idea.title,
      description: idea.description || '',
      assigned_to: assignedTo,
      due_date: dueDate,
      status: 'not_started',
      color: 'classic'
    })
    .select()
    .single()

  if (taskErr) throw new Error(taskErr.message)

  // ربط الفكرة بالمهمة وتغيير الحالة
  const { error: updateErr } = await supabase
    .from('ideas')
    .update({
      converted_task_id: task.id,
      status: 'converted'
    })
    .eq('id', ideaId)

  if (updateErr) throw new Error(updateErr.message)

  revalidatePath('/')
  revalidatePath('/ideas')
  return task
}

export async function updateIdea(ideaId: string, title: string, description: string, category: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  if (!title.trim()) throw new Error('عنوان الفكرة مطلوب')

  // التحقق من الملكية
  const { data: idea, error: fetchErr } = await supabase
    .from('ideas')
    .select('user_id')
    .eq('id', ideaId)
    .single()

  if (fetchErr) throw new Error(fetchErr.message)

  if (idea.user_id !== profile.id) {
    throw new Error('غير مصرح لك بتعديل هذه الفكرة')
  }

  const { data, error } = await supabase
    .from('ideas')
    .update({
      title: title.trim(),
      description: description.trim(),
      category
    })
    .eq('id', ideaId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/ideas')
  return data
}

export async function deleteIdea(ideaId: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // التحقق من الملكية أو الصلاحية الإدارية
  const { data: idea, error: fetchErr } = await supabase
    .from('ideas')
    .select('user_id')
    .eq('id', ideaId)
    .single()

  if (fetchErr) throw new Error(fetchErr.message)

  if (idea.user_id !== profile.id && profile.role !== 'admin') {
    throw new Error('غير مصرح لك بحذف هذه الفكرة')
  }

  const { error } = await supabase
    .from('ideas')
    .delete()
    .eq('id', ideaId)

  if (error) throw new Error(error.message)

  revalidatePath('/ideas')
  return { success: true }
}

// --------------------------------------------------------------------
// 18. عمليات ستوديو اليوتيوب لقناة baron | بارون (YouTube Studio Actions)
// --------------------------------------------------------------------

export async function getYoutubeVideos() {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // جلب كافة الفيديوهات
  const { data: videos, error } = await supabase
    .from('youtube_videos')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  if (!videos || videos.length === 0) return []

  // جلب كافة المهام المرتبطة بأي فيديو للمستخدم
  const { data: allTasks } = await supabase
    .from('tasks')
    .select('video_id, work_minutes, status')
    .eq('assigned_to', profile.id)
    .not('video_id', 'is', null)

  const tasksMap: Record<string, { minutes: number; total: number; completed: number }> = {}
  if (allTasks) {
    allTasks.forEach((t: any) => {
      if (t.video_id) {
        if (!tasksMap[t.video_id]) {
          tasksMap[t.video_id] = { minutes: 0, total: 0, completed: 0 }
        }
        tasksMap[t.video_id].minutes += t.work_minutes || 0
        tasksMap[t.video_id].total += 1
        if (t.status === 'completed') {
          tasksMap[t.video_id].completed += 1
        }
      }
    })
  }

  // حساب ساعات العمل والمهام لكل فيديو بناءً على حقل الخطوات والمهام المربوطة بالفيديو
  const videosWithStats = videos.map((video) => {
    const stepsList = video.steps || []
    const videoTasks = tasksMap[video.id] || { minutes: 0, total: 0, completed: 0 }
    
    const stepsMinutes = stepsList.reduce((sum: number, s: any) => sum + (s.work_minutes || 0), 0)
    const tasksMinutes = videoTasks.minutes
    const totalMinutes = stepsMinutes + tasksMinutes
    
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10

    const hasTasks = videoTasks.total > 0
    const totalTasks = hasTasks ? videoTasks.total : stepsList.length
    const completedTasks = hasTasks ? videoTasks.completed : stepsList.filter((s: any) => s.completed).length

    return {
      ...video,
      totalTasks,
      completedTasks,
      totalHours,
      progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    }
  })

  return videosWithStats
}

export async function getYoutubeVideoDetails(videoId: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // جلب تفاصيل الفيديو
  const { data: video, error } = await supabase
    .from('youtube_videos')
    .select('*')
    .eq('id', videoId)
    .eq('user_id', profile.id)
    .single()

  if (error) throw new Error('الفيديو غير موجود')

  // جلب المهام المرتبطة بالفيديو
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select(`
      *,
      group:task_groups(id, name, color),
      milestone:project_milestones(id, title)
    `)
    .eq('video_id', videoId)
    .order('created_at', { ascending: true })

  if (tasksError) throw new Error(tasksError.message)

  // حساب توزيع الوقت على مراحل الإنتاج بناءً على الخطوات والمهام المرتبطة بالفيديو
  const stepsList = video.steps || []
  const phases = {
    scripting: { name: 'السيناريو والكتابة ✍️', minutes: 0, hours: 0, tasksCount: 0, completedCount: 0 },
    recording: { name: 'التصوير والتسجيل 🎙️', minutes: 0, hours: 0, tasksCount: 0, completedCount: 0 },
    editing: { name: 'المونتاج والتحريك 🎬', minutes: 0, hours: 0, tasksCount: 0, completedCount: 0 },
    publishing: { name: 'الغلاف والنشر 🎨', minutes: 0, hours: 0, tasksCount: 0, completedCount: 0 },
    other: { name: 'أعمال أخرى ⚙️', minutes: 0, hours: 0, tasksCount: 0, completedCount: 0 }
  }

  // حساب إجمالي الدقائق لكل خطوة بما يشمل المهام المكتملة المرتبطة بها
  const stepsWithTotalMinutes = stepsList.map((s: any) => {
    const stepTasks = (tasks || []).filter((t: any) => t.video_step_id === s.id && t.status === 'completed')
    const stepTasksMinutes = stepTasks.reduce((sum: number, t: any) => sum + (t.work_minutes || 0), 0)
    return {
      ...s,
      total_minutes: (s.work_minutes || 0) + stepTasksMinutes
    }
  })

  // إضافة دقائق الخطوات إلى المراحل
  stepsWithTotalMinutes.forEach((s: any) => {
    const phaseKey = (s.phase || 'other') as keyof typeof phases
    if (phases[phaseKey]) {
      phases[phaseKey].minutes += s.total_minutes || 0
      phases[phaseKey].tasksCount += 1
      if (s.completed) {
        phases[phaseKey].completedCount += 1
      }
    }
  })

  // إضافة دقائق المهام المرتبطة بالفيديو إلى مراحلها المقابلة (فقط للمهام غير المربوطة بخطوة محددة، أو غير المكتملة بعد لمنع التكرار)
  if (tasks) {
    tasks.forEach((t: any) => {
      if (!t.video_step_id || t.status !== 'completed') {
        const phaseKey = (t.video_phase || 'other') as keyof typeof phases
        if (phases[phaseKey]) {
          phases[phaseKey].minutes += t.work_minutes || 0
        }
      }
    })
  }

  // تحويل الدقائق إلى ساعات وتدويرها
  Object.keys(phases).forEach((key) => {
    const k = key as keyof typeof phases
    phases[k].hours = Math.round((phases[k].minutes / 60) * 10) / 10
  })

  const stepsMinutes = stepsList.reduce((sum: number, s: any) => sum + (s.work_minutes || 0), 0)
  const tasksMinutes = (tasks || []).reduce((sum: number, t: any) => sum + (t.work_minutes || 0), 0)
  const totalMinutes = stepsMinutes + tasksMinutes
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10

  const hasTasks = tasks && tasks.length > 0
  const totalTasks = hasTasks ? tasks.length : stepsList.length
  const completedTasks = hasTasks 
    ? tasks.filter((t: any) => t.status === 'completed').length 
    : stepsList.filter((s: any) => s.completed).length
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return {
    video: {
      ...video,
      steps: stepsWithTotalMinutes,
      totalHours,
      totalTasks,
      completedTasks,
      progress
    },
    phases,
    tasks: tasks || []
  }
}

export async function createYoutubeVideo(
  title: string,
  description: string,
  thumbnailUrl: string,
  targetHours: number = 0,
  contentType: 'video' | 'reel' = 'video',
  durationSeconds: number = 0
) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  if (!title.trim()) throw new Error('عنوان الفيديو مطلوب')

  // الخطوات العشرة الافتراضية لقناة بارون (الفيديوهات الطويلة)
  const defaultSteps = [
    { id: "1", title: "البحث وفكرة الفيديو", completed: false, work_minutes: 0, phase: "scripting" },
    { id: "2", title: "دراسة المنافسين والمحتوى", completed: false, work_minutes: 0, phase: "scripting" },
    { id: "3", title: "كتابة السيناريو (السكربت)", completed: false, work_minutes: 0, phase: "scripting" },
    { id: "4", title: "تسجيل التعليق الصوتي", completed: false, work_minutes: 0, phase: "recording" },
    { id: "5", title: "توليد صور المشاهد (nano banana)", completed: false, work_minutes: 0, phase: "editing" },
    { id: "6", title: "تحويل الصور لفيديوهات (vio/omni)", completed: false, work_minutes: 0, phase: "editing" },
    { id: "7", title: "المونتاج والمؤثرات الصوتية والبصرية", completed: false, work_minutes: 0, phase: "editing" },
    { id: "8", title: "تصميم الصورة المصغرة", completed: false, work_minutes: 0, phase: "publishing" },
    { id: "9", title: "تحسين السيو (العنوان والوصف)", completed: false, work_minutes: 0, phase: "publishing" },
    { id: "10", title: "النشر والإطلاق على يوتيوب", completed: false, work_minutes: 0, phase: "publishing" }
  ]

  // الخطوات الخمس المختصرة للريلز والمحتوى القصير
  const reelSteps = [
    { id: "1", title: "البحث وصياغة الفكرة والهوك", completed: false, work_minutes: 0, phase: "scripting" },
    { id: "2", title: "كتابة السيناريو المختصر", completed: false, work_minutes: 0, phase: "scripting" },
    { id: "3", title: "إعداد المشاهد والتسجيل", completed: false, work_minutes: 0, phase: "recording" },
    { id: "4", title: "المونتاج السريع والمؤثرات", completed: false, work_minutes: 0, phase: "editing" },
    { id: "5", title: "الغلاف والسيو والنشر", completed: false, work_minutes: 0, phase: "publishing" }
  ]

  const isReel = contentType === 'reel'

  const { data, error } = await supabase
    .from('youtube_videos')
    .insert({
      title: title.trim(),
      description: description.trim(),
      thumbnail_url: thumbnailUrl.trim() || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=300&auto=format&fit=crop',
      target_hours: targetHours || (isReel ? 6 : 20),
      content_type: isReel ? 'reel' : 'video',
      duration_seconds: Math.max(0, Math.round(durationSeconds) || 0),
      user_id: profile.id,
      status: 'planning',
      steps: isReel ? reelSteps : defaultSteps
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/youtube')
  return data
}

// رفع صورة مصغرة (غلاف) لفيديو بارون سحابياً وإرجاع رابطها العام
export async function uploadYoutubeThumbnail(videoId: string, file: File) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  if (!file || file.size === 0) throw new Error('الصورة المختارة غير صالحة')
  if (!file.type.startsWith('image/')) throw new Error('يجب اختيار ملف صورة صالح (JPG أو PNG أو WEBP)')
  if (file.size > 5 * 1024 * 1024) throw new Error('حجم الصورة يجب أن يكون أقل من 5 ميغابايت')

  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_') || 'thumbnail.jpg'
  const storagePath = `thumbnails/${profile.id}/${videoId}_${Date.now()}_${cleanFileName}`

  const { error: uploadError } = await supabase.storage
    .from('task-attachments')
    .upload(storagePath, buffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false
    })

  if (uploadError) throw new Error(uploadError.message)

  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/task-attachments/${storagePath}`
}

export async function updateYoutubeVideo(
  videoId: string,
  title: string,
  description: string,
  thumbnailUrl: string,
  status: 'planning' | 'in_progress' | 'completed' | 'published',
  targetHours: number,
  durationSeconds?: number
) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const updateData: any = {
    title: title.trim(),
    description: description.trim(),
    thumbnail_url: thumbnailUrl.trim() || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=300&auto=format&fit=crop',
    status,
    target_hours: targetHours
  }

  if (durationSeconds !== undefined && durationSeconds !== null) {
    updateData.duration_seconds = Math.max(0, Math.round(durationSeconds))
  }

  if (status === 'published' || status === 'completed') {
    updateData.completed_at = new Date().toISOString()
  } else {
    updateData.completed_at = null
  }

  const { data, error } = await supabase
    .from('youtube_videos')
    .update(updateData)
    .eq('id', videoId)
    .eq('user_id', profile.id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/youtube')
  revalidatePath(`/youtube/${videoId}`)
  return data
}

export async function updateYoutubeVideoSteps(videoId: string, steps: any[]) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data, error } = await supabase
    .from('youtube_videos')
    .update({ steps })
    .eq('id', videoId)
    .eq('user_id', profile.id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/youtube')
  revalidatePath(`/youtube/${videoId}`)
  return data
}

export async function deleteYoutubeVideo(videoId: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { error } = await supabase
    .from('youtube_videos')
    .delete()
    .eq('id', videoId)
    .eq('user_id', profile.id)

  if (error) throw new Error(error.message)

  revalidatePath('/youtube')
  return { success: true }
}

export async function getYoutubeAnalytics() {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // جلب كافة الفيديوهات
  const { data: videos } = await supabase
    .from('youtube_videos')
    .select('*')
    .eq('user_id', profile.id)

  if (!videos || videos.length === 0) {
    return {
      totalVideos: 0,
      completedVideosCount: 0,
      totalHours: 0,
      avgHoursPerVideo: 0,
      phaseAverages: {
        scripting: 0,
        recording: 0,
        editing: 0,
        publishing: 0
      },
      mostTimeConsumingPhase: 'لا توجد بيانات',
      videoStats: [],
      efficiency: {
        avgHoursPerMinute: 0,
        bestVideo: null,
        hardestVideo: null,
        trackedVideosCount: 0,
        totalContentMinutes: 0
      },
      reelsCount: 0
    }
  }

  // جلب كافة المهام المرتبطة بأي فيديو للمستخدم
  const { data: allTasks } = await supabase
    .from('tasks')
    .select('video_id, work_minutes, video_phase')
    .eq('assigned_to', profile.id)
    .not('video_id', 'is', null)

  const tasksMap: Record<string, number> = {}
  const taskPhaseMinutes = { scripting: 0, recording: 0, editing: 0, publishing: 0 }
  
  if (allTasks) {
    allTasks.forEach((t: any) => {
      if (t.video_id) {
        tasksMap[t.video_id] = (tasksMap[t.video_id] || 0) + (t.work_minutes || 0)
      }
      const phase = t.video_phase
      if (phase === 'scripting') taskPhaseMinutes.scripting += t.work_minutes || 0
      else if (phase === 'recording') taskPhaseMinutes.recording += t.work_minutes || 0
      else if (phase === 'editing') taskPhaseMinutes.editing += t.work_minutes || 0
      else if (phase === 'publishing') taskPhaseMinutes.publishing += t.work_minutes || 0
    })
  }

  let totalMinutesSum = 0
  let scriptingMinutes = 0
  let recordingMinutes = 0
  let editingMinutes = 0
  let publishingMinutes = 0
  let completedVideosCount = 0
  let reelsCount = 0

  // بيانات كفاءة الإنتاج: ساعات العمل لكل دقيقة من مدة المحتوى النهائي
  const efficiencyEntries: Array<{ title: string; hpm: number; hours: number; durationMin: number }> = []
  let totalContentSeconds = 0

  const videoStats = videos.map((video) => {
    const stepsList = video.steps || []
    const stepsMins = stepsList.reduce((sum: number, s: any) => sum + (s.work_minutes || 0), 0)
    const tasksMins = tasksMap[video.id] || 0
    const minutes = stepsMins + tasksMins
    totalMinutesSum += minutes

    if (video.status === 'published' || video.status === 'completed') {
      completedVideosCount += 1
    }

    if (video.content_type === 'reel') {
      reelsCount += 1
    }

    const durationSeconds = video.duration_seconds || 0
    totalContentSeconds += durationSeconds
    const durationMin = durationSeconds / 60

    stepsList.forEach((s: any) => {
      const mins = s.work_minutes || 0
      if (s.phase === 'scripting') scriptingMinutes += mins
      else if (s.phase === 'recording') recordingMinutes += mins
      else if (s.phase === 'editing') editingMinutes += mins
      else if (s.phase === 'publishing') publishingMinutes += mins
    })

    // حساب كفاءة الفيديو فقط للمنجز مع توفر المدة ووقت الصنع
    const isDone = video.status === 'published' || video.status === 'completed'
    if (isDone && durationMin > 0 && minutes > 0) {
      efficiencyEntries.push({
        title: video.title,
        hpm: Math.round(((minutes / 60) / durationMin) * 100) / 100,
        hours: Math.round((minutes / 60) * 10) / 10,
        durationMin
      })
    }

    return {
      id: video.id,
      title: video.title,
      hours: Math.round((minutes / 60) * 10) / 10,
      status: video.status,
      content_type: video.content_type || 'video',
      duration_seconds: durationSeconds,
      hoursPerMinute: (isDone && durationMin > 0 && minutes > 0)
        ? Math.round(((minutes / 60) / durationMin) * 100) / 100
        : null as number | null
    }
  })

  // إضافة دقائق المهام للمراحل الإجمالية للتحليلات
  scriptingMinutes += taskPhaseMinutes.scripting
  recordingMinutes += taskPhaseMinutes.recording
  editingMinutes += taskPhaseMinutes.editing
  publishingMinutes += taskPhaseMinutes.publishing

  const divisor = completedVideosCount || videos.length || 1
  const phaseAverages = {
    scripting: Math.round(((scriptingMinutes / divisor) / 60) * 10) / 10,
    recording: Math.round(((recordingMinutes / divisor) / 60) * 10) / 10,
    editing: Math.round(((editingMinutes / divisor) / 60) * 10) / 10,
    publishing: Math.round(((publishingMinutes / divisor) / 60) * 10) / 10
  }

  // تحديد أطول مرحلة وقتاً
  const phasesArr = [
    { key: 'scripting', name: 'السيناريو والكتابة ✍️', val: scriptingMinutes },
    { key: 'recording', name: 'التصوير والتسجيل 🎙️', val: recordingMinutes },
    { key: 'editing', name: 'المونتاج والتحريك 🎬', val: editingMinutes },
    { key: 'publishing', name: 'الغلاف والنشر 🎨', val: publishingMinutes }
  ]
  phasesArr.sort((a, b) => b.val - a.val)
  const mostTimeConsumingPhase = phasesArr[0].val > 0 ? phasesArr[0].name : 'لا توجد بيانات'

  // حساب مؤشرات الكفاءة العامة (ساعة عمل لكل دقيقة محتوى — كلما انخفضت كان الإنتاج أسرع)
  const sortedByEfficiency = [...efficiencyEntries].sort((a, b) => a.hpm - b.hpm)
  const avgHpm = efficiencyEntries.length > 0
    ? Math.round((efficiencyEntries.reduce((sum, e) => sum + e.hpm, 0) / efficiencyEntries.length) * 100) / 100
    : 0

  return {
    totalVideos: videos.length,
    completedVideosCount,
    totalHours: Math.round((totalMinutesSum / 60) * 10) / 10,
    avgHoursPerVideo: Math.round(((totalMinutesSum / divisor) / 60) * 10) / 10,
    phaseAverages,
    mostTimeConsumingPhase,
    videoStats,
    reelsCount,
    efficiency: {
      avgHoursPerMinute: avgHpm,
      bestVideo: sortedByEfficiency[0] || null,
      hardestVideo: sortedByEfficiency.length > 1 ? sortedByEfficiency[sortedByEfficiency.length - 1] : null,
      trackedVideosCount: efficiencyEntries.length,
      totalContentMinutes: Math.round((totalContentSeconds / 60) * 10) / 10
    }
  }
}

export async function getUserActiveTasks() {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data, error } = await supabase
    .from('tasks')
    .select(`
      id,
      title,
      status,
      work_minutes,
      group:task_groups(id, name, color)
    `)
    .eq('assigned_to', profile.id)
    .neq('status', 'completed')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data
}

export async function logTaskMinutes(taskId: string, minutes: number) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('work_minutes')
    .eq('id', taskId)
    .single()

  if (fetchError || !task) throw new Error('المهمة غير موجودة')

  const currentMinutes = task.work_minutes || 0
  const newMinutes = currentMinutes + minutes

  const { data, error } = await supabase
    .from('tasks')
    .update({ work_minutes: newMinutes })
    .eq('id', taskId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/')
  revalidatePath(`/task/${taskId}`)
  return data
}

// --------------------------------------------------------------------
// 19. عمليات مساعد الذكاء الاصطناعي لاستوديو يوتيوب (Azure AI Studio Actions)
// --------------------------------------------------------------------

async function callAzureAI(apiKey: string, endpoint: string, modelName: string, systemPrompt: string, userPrompt: string) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120000) // تحديد مهلة قصوى 120 ثانية لتمكين موديلات الاستدلال من التفكير والاستجابة الكافية

  try {
    const isResponsesApi = endpoint.includes('/responses') || endpoint.includes('/v1/responses')
    
    let requestBody: any = {}
    if (isResponsesApi) {
      requestBody = {
        model: modelName || 'gpt-4o',
        instructions: systemPrompt,
        input: userPrompt,
        max_output_tokens: 8000
      }
    } else {
      requestBody = {
        model: modelName || 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 4000,
        temperature: 0.7
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`خطأ في بوابة الذكاء الاصطناعي (${response.status}): ${errText || response.statusText}`)
    }

    const result = await response.json()
    
    let content = ''
    if (isResponsesApi) {
      content = result.output_text
      if (!content && Array.isArray(result.output)) {
        for (const item of result.output) {
          if (item.content && Array.isArray(item.content)) {
            for (const block of item.content) {
              if (block.text && typeof block.text === 'string') {
                content = block.text
                break
              }
            }
          }
          if (content) break
        }
      }
    } else {
      content = result.choices?.[0]?.message?.content
    }

    // Fallback parsing if formatting differs or fails
    if (!content) {
      content = result.output_text
      
      if (!content && Array.isArray(result.output)) {
        for (const item of result.output) {
          if (item.content && Array.isArray(item.content)) {
            for (const block of item.content) {
              if (block.text && typeof block.text === 'string') {
                content = block.text
                break
              }
            }
          }
          if (content) break
        }
      }

      if (!content) {
        content = result.choices?.[0]?.message?.content || 
                  result.choices?.[0]?.text ||
                  (typeof result.output === 'string' ? result.output : '')
      }
    }

    if (!content) {
      console.error('فشل في قراءة الاستجابة. بنية الـ JSON المستلمة هي:', JSON.stringify(result))
      throw new Error('لا تتوفر استجابة مقروءة من الذكاء الاصطناعي')
    }

    return content
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('انتهت مهلة استدعاء الذكاء الاصطناعي (120 ثانية). يرجى المحاولة مرة أخرى لضمان الأمان.')
    }
    throw error
  }
}

export async function getAIReferenceScripts() {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data, error } = await supabase
    .from('ai_reference_scripts')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

export async function createAIReferenceScript(title: string, content: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  if (!title.trim() || !content.trim()) throw new Error('العنوان والمحتوى مطلوبان')

  const { data, error } = await supabase
    .from('ai_reference_scripts')
    .insert({
      title: title.trim(),
      content: content.trim(),
      user_id: profile.id
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/youtube')
  return data
}

export async function updateAIReferenceScript(id: string, title: string, content: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  if (!title.trim() || !content.trim()) throw new Error('العنوان والمحتوى مطلوبان')

  const { data, error } = await supabase
    .from('ai_reference_scripts')
    .update({
      title: title.trim(),
      content: content.trim()
    })
    .eq('id', id)
    .eq('user_id', profile.id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/youtube')
  return data
}

export async function deleteAIReferenceScript(id: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { error } = await supabase
    .from('ai_reference_scripts')
    .delete()
    .eq('id', id)
    .eq('user_id', profile.id)

  if (error) throw new Error(error.message)

  revalidatePath('/youtube')
  return { success: true }
}

export async function updateAISettings(isEnabled: boolean, apiKey: string | null, apiEndpoint: string | null, apiModel: string | null) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data, error } = await supabase
    .from('profiles')
    .update({
      is_ai_enabled: isEnabled,
      azure_ai_key: apiKey?.trim() || null,
      azure_ai_endpoint: apiEndpoint?.trim() || null,
      azure_ai_model: apiModel?.trim() || null
    })
    .eq('id', profile.id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/youtube')
  revalidatePath('/')
  return data
}

export async function saveVideoScriptAndStoryboard(videoId: string, script: string | null, storyboard: any[]) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data, error } = await supabase
    .from('youtube_videos')
    .update({ script, storyboard })
    .eq('id', videoId)
    .eq('user_id', profile.id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath(`/youtube/${videoId}`)
  return data
}

export async function generateYoutubeScript(
  videoId: string,
  topic: string,
  lengthMinutes: number,
  tone: string,
  pacing: string,
  selectedRefIds: string[]
) {
  try {
    const supabase = await createClient()
    const profile = await getCurrentUserProfile()
    if (!profile) return { success: false, error: 'غير مصرح بالدخول' }

    if (!profile.is_ai_enabled) return { success: false, error: 'يرجى تفعيل الذكاء الاصطناعي في الإعدادات أولاً' }

    const apiKey = profile.azure_ai_key || process.env.AZURE_AI_KEY
    const apiEndpoint = profile.azure_ai_endpoint || process.env.AZURE_AI_ENDPOINT
    const apiModel = profile.azure_ai_model || process.env.AZURE_AI_MODEL || 'gpt-4o'

    if (!apiKey || !apiEndpoint) {
      return { success: false, error: 'يرجى تعبئة مفتاح الـ API والـ Endpoint الخاصة بك في الإعدادات أولاً لتفعيل التوليد.' }
    }

    let examplesText = ""
    if (selectedRefIds && selectedRefIds.length > 0) {
      const { data: refs } = await supabase
        .from('ai_reference_scripts')
        .select('title, content')
        .in('id', selectedRefIds)

      if (refs && refs.length > 0) {
        examplesText = "إليك أمثلة سابقة من نصوص كتبتها لتقتدي بأسلوبها وبنيتها وصياغتها وتصيغ النص الجديد تماماً مثلها:\n" + 
          refs.map((r: any, idx: number) => `--- مثال ${idx+1}: [${r.title}] ---\n${r.content}\n---`).join("\n\n")
      }
    }

    const systemPrompt = `أنت كاتب سيناريوهات محترف لقناة يوتيوب غامضة ومثيرة اسمها "baron | بارون".
أسلوب القناة متميز ومختلف تماماً: لغة سينمائية مشوقة ومفعمة بالغموض والإثارة والتشويق (Style: corporate thriller, Unreal Engine 5 aesthetic, surreal atmosphere).
تتحدث عن مواضيع عميقة، وتستخدم استعارات فنية ورموزاً مثل "الدمى البيضاء عديمة الملامح ذات الرؤوس الملساء" (Faceless mannequin dummies).
صوت الإلقاء يجب أن يكون مشوقاً، مفعماً بالغموض، مع توظيف وقفات ذكية لجذب الانتباه.

${examplesText}

المطلوب: كتابة سيناريو (سكربت) كامل باللغة العربية بناءً على الفكرة والموضوع المدخلين، مع الالتزام التام بالأسلوب الموضح في الأمثلة والتوجيهات أعلاه.
المعايير المحددة للسكربت المولد:
- النبرة الإبداعية: ${tone}
- سرعة الإلقاء والتدفق: ${pacing}
- الطول المتوقع للقراءة الإلقائية: ${lengthMinutes} دقائق (اكتب نصاً كافياً لتغطية هذه المدة بالكلمات، بمتوسط 130 كلمة لكل دقيقة).`

    const userPrompt = `اكتب لي سكربت فيديو يوتيوب مشوق حول الموضوع التالي بالتفصيل مستوحى من البصمة الفنية الموضحة:
"${topic}"`

    const generatedText = await callAzureAI(apiKey, apiEndpoint, apiModel, systemPrompt, userPrompt)

    const { error: updateErr } = await supabase
      .from('youtube_videos')
      .update({ script: generatedText })
      .eq('id', videoId)
      .eq('user_id', profile.id)

    if (updateErr) return { success: false, error: updateErr.message }

    return { success: true, data: generatedText }
  } catch (err: any) {
    return { success: false, error: err.message || 'حدث خطأ غير متوقع أثناء التوليد' }
  }
}

function extractAndParseJSON(text: string) {
  let cleaned = text.trim()
  
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "").trim()
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```/, "").replace(/```$/, "").trim()
  }
  
  try {
    return JSON.parse(cleaned)
  } catch (e) {
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0])
      } catch (err) {}
    }
    
    const objectMatch = cleaned.match(/\{[\s\S]*\}/)
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0])
      } catch (err) {}
    }
    
    throw e
  }
}

export async function generateStoryboardPrompts(videoId: string, splitMethod: 'words' | 'sentences' | 'story') {
  try {
    const supabase = await createClient()
    const profile = await getCurrentUserProfile()
    if (!profile) return { success: false, error: 'غير مصرح بالدخول' }

    if (!profile.is_ai_enabled) return { success: false, error: 'يرجى تفعيل الذكاء الاصطناعي في الإعدادات أولاً' }

    const apiKey = profile.azure_ai_key || process.env.AZURE_AI_KEY
    const apiEndpoint = profile.azure_ai_endpoint || process.env.AZURE_AI_ENDPOINT
    const apiModel = profile.azure_ai_model || process.env.AZURE_AI_MODEL || 'gpt-4o'

    if (!apiKey || !apiEndpoint) {
      return { success: false, error: 'يرجى تهيئة مفتاح الـ API والـ Endpoint في صفحة الإعدادات.' }
    }

    const { data: video, error: fetchErr } = await supabase
      .from('youtube_videos')
      .select('script')
      .eq('id', videoId)
      .eq('user_id', profile.id)
      .single()

    if (fetchErr || !video || !video.script) {
      return { success: false, error: 'يرجى توليد السكربت أو كتابته وحفظه أولاً قبل تفكيك المشاهد.' }
    }

    const systemPrompt = `أنت مخرج ومصمم بصري لقناة يوتيوب "baron | بارون".
مهمتك هي قراءة نص السكربت باللغة العربية، وتقسيمه إلى مشاهد متسلسلة، وتوليد وصف للقطة البصرية (Image Prompt) لكل مشهد باللغة الإنجليزية ليتم توليدها بالذكاء الاصطناعي.

الستايل البصري الموحد الذي يجب أن تدمجه بالإنجليزية وتكتبه بالكامل في نهاية كل برومبت هو:
"Stylized 3D render, metaphorical corporate thriller style. Faceless white mannequin dummies with smooth, featureless blank heads . with high-tech elements. Moody cinematic lighting, contrasting warm golden lamp light with cold deep blue twilight. Unreal Engine 5 aesthetic, crisp details, eerie and surreal corporate atmosphere."

المعايير المحددة لتقطيع المشاهد:
- طريقة التقسيم المطلوبة: ${
      splitMethod === 'words' ? 'تقسيم قصير وسريع جداً (كل 8-12 كلمة مشهد للتنقل والمونتاج السريع).' :
      splitMethod === 'sentences' ? 'تقسيم بعد كل جملة كاملة (جملة مفيدة).' :
      'تقسيم درامي ذكي حسب سياق القصة وتدفق الأحداث.'
    }

المخرجات المطلوبة: يجب أن ترسل النتيجة بصيغة مصفوفة JSON صالحة ومباشرة دون أي نصوص إضافية (أو فواصل Markdown مثل \`\`\`json) تحتوي على كائنات بالبنية التالية:
[
  {
    "id": "1",
    "text": "النص العربي المقابل لهذا المشهد من السكربت",
    "prompt": "The generated prompt in English (e.g. A faceless dummy mannequin doing X, Stylized 3D render...)",
    "completed": false
  }
]`

    const userPrompt = `حلل هذا السكربت وقسمه إلى مشاهد مبرمجاً برومبتات بالإنجليزية متطابقة مع الستايل الموحد:
"${video.script}"`

    const responseContent = await callAzureAI(apiKey, apiEndpoint, apiModel, systemPrompt, userPrompt)
    
    const storyboardArray = extractAndParseJSON(responseContent)
    
    const { error: updateErr } = await supabase
      .from('youtube_videos')
      .update({ storyboard: storyboardArray })
      .eq('id', videoId)
      .eq('user_id', profile.id)

    if (updateErr) return { success: false, error: updateErr.message }

    return { success: true, data: storyboardArray }
  } catch (err: any) {
    return { success: false, error: "فشل تفكيك المشاهد وصياغتها بالذكاء الاصطناعي: " + err.message }
  }
}

export async function generateYoutubeSEO(videoId: string) {
  try {
    const supabase = await createClient()
    const profile = await getCurrentUserProfile()
    if (!profile) return { success: false, error: 'غير مصرح بالدخول' }

    if (!profile.is_ai_enabled) return { success: false, error: 'يرجى تفعيل الذكاء الاصطناعي في الإعدادات أولاً' }

    const apiKey = profile.azure_ai_key || process.env.AZURE_AI_KEY
    const apiEndpoint = profile.azure_ai_endpoint || process.env.AZURE_AI_ENDPOINT
    const apiModel = profile.azure_ai_model || process.env.AZURE_AI_MODEL || 'gpt-4o'

    if (!apiKey || !apiEndpoint) {
      return { success: false, error: 'يرجى تهيئة مفتاح الـ API والـ Endpoint في صفحة الإعدادات.' }
    }

    const { data: video, error: fetchErr } = await supabase
      .from('youtube_videos')
      .select('script')
      .eq('id', videoId)
      .eq('user_id', profile.id)
      .single()

    if (fetchErr || !video || !video.script) {
      return { success: false, error: 'يرجى توليد السكربت وحفظه أولاً قبل توليد خيارات السيو والعناوين.' }
    }

    const systemPrompt = `أنت خبير سيو (SEO) ويوتيوب محترف لقناة "baron | بارون".
مهمتك هي قراءة نص السكربت، ثم اقتراح العناوين والوصف والوسوم وفصول الفيديو.
يجب أن ترسل النتيجة بصيغة JSON صالحة ومباشرة دون أي نصوص إضافية، بالبنية التالية:
{
  "titles": ["عنوان 1 جذاب ونسبة نقر عالية", "عنوان 2...", "عنوان 3...", "عنوان 4...", "عنوان 5..."],
  "description": "وصف الفيديو الطويل المتوافق مع خوارزميات اليوتيوب والسيو ويحتوي على كلمات دلالية قوية ورابط تواصل...",
  "tags": ["وسم1", "وسم2", "وسم3", "وسم4"],
  "chapters": "00:00 - المقدمة والغموض\\n01:30 - بداية الرحلة\\n..."
}`

    const userPrompt = `حلل هذا السكربت وولد بيانات السيو والعناوين المقترحة:
"${video.script}"`

    const responseContent = await callAzureAI(apiKey, apiEndpoint, apiModel, systemPrompt, userPrompt)
    
    const seoData = extractAndParseJSON(responseContent)
    return { success: true, data: seoData }
  } catch (err: any) {
    return { success: false, error: "فشل صياغة السيو بنجاح: " + err.message }
  }
}

export async function updateYoutubeVideoScript(videoId: string, scriptContent: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data, error } = await supabase
    .from('youtube_videos')
    .update({ script: scriptContent })
    .eq('id', videoId)
    .eq('user_id', profile.id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  
  revalidatePath(`/youtube/${videoId}`)
  return data
}

export async function updateYoutubeVideoStoryboard(videoId: string, storyboard: any[]) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data, error } = await supabase
    .from('youtube_videos')
    .update({ storyboard })
    .eq('id', videoId)
    .eq('user_id', profile.id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  
  revalidatePath(`/youtube/${videoId}`)
  return data
}







