// app/hub/page.tsx - Hub disabled, redirects to dashboard
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function HubPage() {
  // Hub disabled - redirect everyone to dashboard for presentation
  redirect('/dashboard')
}
