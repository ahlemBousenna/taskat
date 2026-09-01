import { getCurrentUserProfile, getProfiles, getMilestones } from '../actions'
import { redirect } from 'next/navigation'
import StandupClient from './standup-client'

export const revalidate = 0 // تعطيل التخزين المؤقت لضمان حداثة البيانات عند كل تحميل

export default async function StandupPage() {
  const profile = await getCurrentUserProfile()

  if (!profile) {
    redirect('/login')
  }

  const teamProfiles = await getProfiles()
  const milestones = await getMilestones()

  return (
    <StandupClient 
      currentProfile={profile} 
      teamProfiles={teamProfiles} 
      initialMilestones={milestones} 
    />
  )
}
