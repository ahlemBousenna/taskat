import { getCurrentUserProfile } from '../actions'
import { redirect } from 'next/navigation'
import ArchiveClient from './archive-client'

export const revalidate = 0 // لضمان جلب أحدث المهام المنجزة مباشرة من قاعدة البيانات

export default async function ArchivePage() {
  const profile = await getCurrentUserProfile()

  if (!profile) {
    redirect('/login')
  }

  return <ArchiveClient currentProfile={profile} />
}
