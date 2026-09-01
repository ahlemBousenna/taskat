import { getCurrentUserProfile, getProfiles, getMilestones, getYoutubeVideos } from './actions'
import { redirect } from 'next/navigation'
import DashboardClient from './dashboard-client'

export const revalidate = 0 // تعطيل التخزين المؤقت لضمان حداثة البيانات عند كل تحميل

export default async function DashboardPage() {
  const profile = await getCurrentUserProfile()

  if (!profile) {
    redirect('/login')
  }

  const teamProfiles = await getProfiles()
  const milestones = await getMilestones()
  const videos = await getYoutubeVideos()

  return (
    <DashboardClient 
      currentProfile={profile} 
      teamProfiles={teamProfiles} 
      initialMilestones={milestones}
      youtubeVideos={videos}
    />
  )
}
