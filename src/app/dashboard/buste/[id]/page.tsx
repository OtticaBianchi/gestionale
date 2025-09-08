// app/dashboard/buste/[id]/page.tsx
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database.types';
import { notFound } from 'next/navigation';
import BustaDetailClient from './_components/BustaDetailClient';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

type BustaDettagliata = Database['public']['Tables']['buste']['Row'] & {
  clienti: Database['public']['Tables']['clienti']['Row'] | null;
  profiles: Pick<Database['public']['Tables']['profiles']['Row'], 'full_name'> | null;
  status_history: Array<
    Database['public']['Tables']['status_history']['Row'] & {
      profiles: Pick<Database['public']['Tables']['profiles']['Row'], 'full_name'> | null;
    }
  >;
};

interface BustaDetailPageProps {
  params: {
    id: string;
  };
}

export default async function BustaDetailPage({ params }: BustaDetailPageProps) {
  const cookieStore = cookies();
  
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
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  );

  // Fetch della busta con tutti i dettagli
  const { data: busta, error } = await supabase
    .from('buste')
    .select(`
      *,
      clienti (*),
      profiles:creato_da (full_name),
      status_history (
        *,
        profiles:operatore_id (full_name)
      )
    `)
    .eq('id', params.id)
    .order('data_ingresso', { 
      ascending: false,
      foreignTable: 'status_history' 
    })
    .single();

  if (error || !busta) {
    console.error('Errore nel caricamento della busta:', error);
    notFound();
  }

  const bustaDettagliata: BustaDettagliata = busta as BustaDettagliata;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Torna al Dashboard</span>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Busta {bustaDettagliata.readable_id}
                </h1>
                <p className="text-sm text-gray-500">
                  {bustaDettagliata.clienti?.cognome} {bustaDettagliata.clienti?.nome}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Status Badge */}
              <span className={`
                inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
                ${bustaDettagliata.stato_attuale === 'nuove' ? 'bg-blue-100 text-blue-800' :
                  bustaDettagliata.stato_attuale === 'consegnato_pagato' ? 'bg-green-100 text-green-800' :
                  bustaDettagliata.stato_attuale === 'pronto_ritiro' ? 'bg-purple-100 text-purple-800' :
                  'bg-yellow-100 text-yellow-800'}
              `}>
                {bustaDettagliata.stato_attuale.replace(/_/g, ' ').toUpperCase()}
              </span>
              
              {/* Priority Badge */}
              {bustaDettagliata.priorita !== 'normale' && (
                <span className={`
                  inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
                  ${bustaDettagliata.priorita === 'critica' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}
                `}>
                  {bustaDettagliata.priorita.toUpperCase()}
                </span>
              )}
              
              {/* Suspended Badge */}
              {bustaDettagliata.is_suspended && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  SOSPESO
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BustaDetailClient busta={bustaDettagliata} />
      </div>
    </div>
  );
}