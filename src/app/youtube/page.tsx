import { redirect } from 'next/navigation'
import { getCurrentUserProfile, getYoutubeVideos, getYoutubeAnalytics } from '../actions'
import YoutubeClient from './youtube-client'

export const revalidate = 0

export default async function YoutubePage() {
  const profile = await getCurrentUserProfile()
  if (!profile) {
    redirect('/login')
  }

  const [videos, analytics] = await Promise.all([
    getYoutubeVideos(),
    getYoutubeAnalytics()
  ])

  return (
    <YoutubeClient 
      currentProfile={profile} 
      initialVideos={videos}
      analytics={analytics}
    />
  )
}
