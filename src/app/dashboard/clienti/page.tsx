// app/dashboard/clienti/page.tsx
import { redirect } from 'next/navigation';

// Redirect to advanced search since that's the main client search interface
export default function ClientiPage() {
  redirect('/dashboard/ricerca-avanzata');
}
