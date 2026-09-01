import { getCurrentUserProfile, getMilestones } from '../actions'
import { redirect } from 'next/navigation'
import RoadmapClient from './roadmap-client'

export const revalidate = 0 // لضمان حداثة البيانات ونسب التقدم عند التحميل

export default async function RoadmapPage() {
  const profile = await getCurrentUserProfile()

  if (!profile) {
    redirect('/login')
  }

  const milestones = await getMilestones()

  return <RoadmapClient currentProfile={profile} initialMilestones={milestones} />
}
