// app/dashboard/clienti/[id]/page.tsx
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database.types';
import { notFound, redirect } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import ClientDetailClient from './_components/ClientDetailClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ClienteDettagliato = Database['public']['Tables']['clienti']['Row'] & {
  buste: Array<{
    id: string;
    readable_id: string;
    tipo_lavorazione: string | null;
    stato_attuale: string;
    priorita: string;
    data_apertura: string;
    data_completamento_consegna: string | null;
  }>;
  follow_up_chiamate: Array<{
    id: string;
    data_chiamata: string | null;
    livello_soddisfazione: string | null;
    stato_chiamata: string;
    note_chiamata: string | null;
  }>;
  error_tracking: Array<{
    id: string;
    error_type: string;
    error_category: string;
    error_description: string;
    created_at: string | null;
    resolution_status: string | null;
  }>;
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
            // Server Component limitation
          }
        },
      },
    }
  );

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  // Get user role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const userRole = profile?.role || 'operatore';

  // Fetch client with all related data
  // Fetch client data
  const { data: cliente, error: clienteError } = await supabase
    .from('clienti')
    .select('*')
    .eq('id', id)
    .single();

  if (clienteError || !cliente) {
    console.error('Error fetching cliente:', clienteError);
    notFound();
  }

  // Fetch related buste
  const { data: buste } = await supabase
    .from('buste')
    .select('id, readable_id, tipo_lavorazione, stato_attuale, priorita, data_apertura, data_completamento_consegna')
    .eq('cliente_id', id)
    .order('data_apertura', { ascending: false });

  // Fetch related follow-up calls
  const { data: follow_up_chiamate } = await supabase
    .from('follow_up_chiamate')
    .select('id, data_chiamata, livello_soddisfazione, stato_chiamata, note_chiamata')
    .in('busta_id', (buste || []).map(b => b.id));

  // Fetch related errors
  const { data: error_tracking } = await supabase
    .from('error_tracking')
    .select('id, error_type, error_category, error_description, created_at, resolution_status')
    .eq('cliente_id', id);

  // Combine the data
  const clienteWithRelations = {
    ...cliente,
    buste: buste || [],
    follow_up_chiamate: follow_up_chiamate || [],
    error_tracking: error_tracking || [],
  } as ClienteDettagliato;

  return (
    <DashboardLayout>
      <ClientDetailClient cliente={clienteWithRelations} userRole={userRole} />
    </DashboardLayout>
  );
}
