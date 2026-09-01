import { getCurrentUserProfile, getMonthlyAnalytics } from '../actions'
import { redirect } from 'next/navigation'
import AnalyticsClient from './analytics-client'

export const revalidate = 0 // Disable cache to ensure live reporting data

export default async function AnalyticsPage() {
  const profile = await getCurrentUserProfile()

  if (!profile) {
    redirect('/login')
  }

  const today = new Date()
  const initialMonth = today.getMonth() + 1
  const initialYear = today.getFullYear()

  const initialData = await getMonthlyAnalytics(initialMonth, initialYear)

  return (
    <AnalyticsClient 
      currentProfile={profile} 
      initialData={initialData}
      initialMonth={initialMonth}
      initialYear={initialYear}
    />
  )
}
