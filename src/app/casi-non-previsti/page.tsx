import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database.types';
import DashboardLayout from '@/components/layout/DashboardLayout';
import CasiNonPrevistiList from './_components/CasiNonPrevistiList';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CasiNonPrevistiPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore
          }
        },
      },
    }
  );

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div>Non autenticato</div>;
  }

  // Get user profile to check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin';

  // Fetch all cases with creator info
  const { data: cases, error } = await supabase
    .from('unpredicted_cases')
    .select(`
      *,
      created_by_profile:profiles!unpredicted_cases_created_by_fkey(full_name),
      completed_by_profile:profiles!unpredicted_cases_completed_by_fkey(full_name)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching cases:', error);
    return <div>Errore nel caricamento dei casi</div>;
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="mb-3">
            <Link
              href="/procedure"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Torna alle Procedure</span>
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Casi NON Previsti</h1>
              <p className="text-sm text-gray-600 mt-1">
                Situazioni non coperte dalle procedure esistenti
              </p>
              {process.env.NODE_ENV === 'development' && (
                <p className="text-xs text-gray-400 mt-1">
                  Debug: Role = {profile?.role} | isAdmin = {isAdmin ? 'true' : 'false'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 bg-gray-50 overflow-auto">
          <CasiNonPrevistiList
            cases={cases || []}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
