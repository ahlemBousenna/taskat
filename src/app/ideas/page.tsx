import { getCurrentUserProfile, getProfiles, getMilestones, getIdeas, getGroups } from '../actions'
import { redirect } from 'next/navigation'
import IdeasClient from './ideas-client'

export const revalidate = 0 // تعطيل التخزين المؤقت لضمان حداثة البيانات عند كل تحميل

export default async function IdeasPage() {
  const profile = await getCurrentUserProfile()

  if (!profile) {
    redirect('/login')
  }

  const teamProfiles = await getProfiles()
  const milestones = await getMilestones()
  
  let initialIdeas: any[] = []
  let dbError: string | null = null
  try {
    initialIdeas = await getIdeas()
  } catch (err: any) {
    console.error('Error fetching ideas:', err)
    dbError = err.message || 'فشل الاتصال بقاعدة البيانات'
  }

  let groups: any[] = []
  try {
    const todayStr = new Date().toISOString().split('T')[0]
    groups = await getGroups(todayStr)
  } catch (err) {}

  return (
    <IdeasClient 
      currentProfile={profile} 
      teamProfiles={teamProfiles} 
      initialMilestones={milestones}
      initialIdeas={initialIdeas}
      initialGroups={groups}
      dbError={dbError}
    />
  )
}
