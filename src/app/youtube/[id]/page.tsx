import { redirect } from 'next/navigation'
import { getCurrentUserProfile, getYoutubeVideoDetails } from '../../actions'
import VideoDetailsClient from './video-details-client'

export const revalidate = 0

interface VideoDetailsPageProps {
  params: Promise<{ id: string }>
}

export default async function VideoDetailsPage({ params }: VideoDetailsPageProps) {
  const { id } = await params
  const profile = await getCurrentUserProfile()
  if (!profile) {
    redirect('/login')
  }

  let data
  try {
    data = await getYoutubeVideoDetails(id)
  } catch (e) {
    redirect('/youtube')
  }

  return (
    <VideoDetailsClient 
      currentProfile={profile} 
      video={data.video}
      phases={data.phases}
      initialTasks={data.tasks}
    />
  )
}
