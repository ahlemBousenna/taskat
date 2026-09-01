import { createClient } from '@/utils/supabase/server'
import { getCurrentUserProfile, getTaskFiles, getProfiles, getMilestones, getYoutubeVideos } from '../../actions'
import { redirect } from 'next/navigation'
import TaskDetailClient from './task-client'

export const revalidate = 0 // لضمان حداثة بيانات المهمة والملفات المرفقة

interface TaskPageProps {
  params: Promise<{ id: string }>
}

export default async function TaskPage({ params }: TaskPageProps) {
  const { id } = await params
  const profile = await getCurrentUserProfile()
  
  if (!profile) {
    redirect('/login')
  }

  const supabase = await createClient()

  // جلب تفاصيل المهمة مع بيانات المجموعة والمسؤول والمحطة الكبرى والفيديو المرتبط
  const { data: task, error } = await supabase
    .from('tasks')
    .select(`
      *,
      group:task_groups(name, color),
      assignee:profiles!tasks_assigned_to_fkey(name, email, avatar_url),
      milestone:project_milestones(id, title),
      video:youtube_videos(id, title)
    `)
    .eq('id', id)
    .single()

  if (error || !task) {
    redirect('/')
  }

  // فحص أمني: إذا لم يكن مشرفاً، لا يحق له رؤية المهمة إلا إذا كانت مسندة إليه
  if (profile.role !== 'admin' && task.assigned_to !== profile.id) {
    redirect('/')
  }

  // جلب الملفات المرفقة
  const files = await getTaskFiles(id)
  
  // جلب الملفات الشخصية للفريق والمحطات الكبرى لتعديل المهمة
  const teamProfiles = await getProfiles()
  const milestones = await getMilestones()
  const youtubeVideos = await getYoutubeVideos()

  return (
    <TaskDetailClient 
      currentProfile={profile} 
      initialTask={task} 
      initialFiles={files} 
      teamProfiles={teamProfiles}
      milestones={milestones}
      youtubeVideos={youtubeVideos}
    />
  )
}
