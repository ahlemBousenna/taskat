import { redirect } from 'next/navigation'
import { getCurrentUserProfile, getUserActiveTasks, getYoutubeVideos, getGroups } from '../actions'
import TimerClient from './timer-client'

export const revalidate = 0

export default async function TimerPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) {
    redirect('/login')
  }

  const today = new Date().toISOString().split('T')[0]
  const [activeTasks, youtubeVideos, groups] = await Promise.all([
    getUserActiveTasks(),
    getYoutubeVideos(),
    getGroups(today)
  ])

  return (
    <TimerClient 
      currentProfile={profile} 
      initialActiveTasks={activeTasks}
      youtubeVideos={youtubeVideos}
      groups={groups}
    />
  )
}
