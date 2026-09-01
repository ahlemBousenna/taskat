import { redirect } from 'next/navigation'
import { getCurrentUserProfile, getAIReferenceScripts } from '../../actions'
import SettingsClient from './settings-client'

export const revalidate = 0

export default async function YoutubeSettingsPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) {
    redirect('/login')
  }

  const referenceScripts = await getAIReferenceScripts()

  return (
    <SettingsClient 
      currentProfile={profile} 
      initialReferenceScripts={referenceScripts}
    />
  )
}
