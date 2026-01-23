import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

export const dynamic = 'force-dynamic';

const VALID_TABLES = ['buste', 'clienti', 'ordini_materiali', 'info_pagamenti', 'lavorazioni'];

type RecoveryCheckResult = {
  can_recover: boolean;
  warnings: string[];
  errors: string[];
  details: Record<string, unknown>;
};

// POST - Recover an item from cestino
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Accesso riservato agli amministratori' }, { status: 403 });
    }

    const body = await request.json();
    const { table_name, record_id, force = false } = body;

    if (!table_name || !record_id) {
      return NextResponse.json({ error: 'table_name e record_id sono obbligatori' }, { status: 400 });
    }

    if (!VALID_TABLES.includes(table_name)) {
      return NextResponse.json({ error: 'Tabella non valida' }, { status: 400 });
    }

    // Use service client
    const serviceClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Run pre-recovery checks
    const checkResult = await runRecoveryChecks(serviceClient, table_name, record_id);

    if (!checkResult.can_recover && !force) {
      return NextResponse.json({
        success: false,
        error: 'Recovery blocked due to conflicts',
        check_result: checkResult
      }, { status: 409 });
    }

    // Perform the recovery using the database function
    const { data: recoveryResult, error: recoveryError } = await serviceClient.rpc(
      'recover_cestino_item',
      {
        p_table_name: table_name,
        p_record_id: record_id,
        p_user_id: user.id
      }
    );

    if (recoveryError) {
      console.error('CESTINO_RECOVERY_ERROR', recoveryError);
      return NextResponse.json({ error: 'Errore durante il recupero' }, { status: 500 });
    }

    const result = recoveryResult as { success: boolean; error?: string; recovered_at?: string };

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Recupero fallito'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Elemento recuperato con successo',
      recovered_at: result.recovered_at,
      warnings: checkResult.warnings
    });
  } catch (error) {
    console.error('CESTINO_RECOVERY_UNEXPECTED_ERROR', error);
    return NextResponse.json({ error: 'Errore imprevisto' }, { status: 500 });
  }
}

// Run checks before recovery
async function runRecoveryChecks(
  serviceClient: ReturnType<typeof createClient<Database>>,
  tableName: string,
  recordId: string
): Promise<RecoveryCheckResult> {
  const result: RecoveryCheckResult = {
    can_recover: true,
    warnings: [],
    errors: [],
    details: {}
  };

  try {
    switch (tableName) {
      case 'buste': {
        // Check if readable_id is already in use
        const { data: deletedBusta } = await serviceClient
          .from('buste')
          .select('readable_id, cliente_id')
          .eq('id', recordId)
          .single();

        if (deletedBusta?.readable_id) {
          const { data: existingBusta } = await serviceClient
            .from('buste')
            .select('id')
            .eq('readable_id', deletedBusta.readable_id)
            .is('deleted_at', null)
            .neq('id', recordId)
            .single();

          if (existingBusta) {
            result.errors.push(`Il codice busta "${deletedBusta.readable_id}" è già in uso da un'altra busta attiva`);
            result.can_recover = false;
          }
        }

        // Check if parent client exists and is not deleted
        if (deletedBusta?.cliente_id) {
          const { data: cliente } = await serviceClient
            .from('clienti')
            .select('id, deleted_at')
            .eq('id', deletedBusta.cliente_id)
            .single();

          if (!cliente) {
            result.errors.push('Il cliente associato non esiste più');
            result.can_recover = false;
          } else if (cliente.deleted_at) {
            result.warnings.push('Il cliente associato è anche nel cestino. Verrà recuperato automaticamente.');
            result.details.needs_parent_recovery = true;
            result.details.parent_cliente_id = deletedBusta.cliente_id;
          }
        }
        break;
      }

      case 'clienti': {
        // Check if there are active buste referencing this client (shouldn't happen but check)
        const { data: activeBuste } = await serviceClient
          .from('buste')
          .select('id')
          .eq('cliente_id', recordId)
          .is('deleted_at', null)
          .limit(1);

        if (activeBuste && activeBuste.length > 0) {
          result.warnings.push('Ci sono buste attive associate a questo cliente');
        }

        // Check for deleted buste that would also be orphaned
        const { data: deletedBuste } = await serviceClient
          .from('buste')
          .select('id, readable_id')
          .eq('cliente_id', recordId)
          .not('deleted_at', 'is', null);

        if (deletedBuste && deletedBuste.length > 0) {
          result.warnings.push(`${deletedBuste.length} busta/e nel cestino sono associate a questo cliente`);
          result.details.deleted_buste = deletedBuste;
        }
        break;
      }

      case 'ordini_materiali': {
        // Check if parent busta exists and is not deleted
        const { data: deletedOrdine } = await serviceClient
          .from('ordini_materiali')
          .select('busta_id')
          .eq('id', recordId)
          .single();

        if (deletedOrdine?.busta_id) {
          const { data: busta } = await serviceClient
            .from('buste')
            .select('id, deleted_at')
            .eq('id', deletedOrdine.busta_id)
            .single();

          if (!busta) {
            result.errors.push('La busta associata non esiste più');
            result.can_recover = false;
          } else if (busta.deleted_at) {
            result.warnings.push('La busta associata è anche nel cestino. Deve essere recuperata prima.');
            result.details.needs_parent_recovery = true;
            result.details.parent_busta_id = deletedOrdine.busta_id;
          }
        }
        break;
      }

      case 'info_pagamenti': {
        // Check if parent busta exists
        const { data: deletedPagamento } = await serviceClient
          .from('info_pagamenti')
          .select('busta_id')
          .eq('id', recordId)
          .single();

        if (deletedPagamento?.busta_id) {
          const { data: busta } = await serviceClient
            .from('buste')
            .select('id, deleted_at')
            .eq('id', deletedPagamento.busta_id)
            .single();

          if (!busta) {
            result.errors.push('La busta associata non esiste più');
            result.can_recover = false;
          } else if (busta.deleted_at) {
            result.warnings.push('La busta associata è anche nel cestino. Deve essere recuperata prima.');
            result.details.needs_parent_recovery = true;
            result.details.parent_busta_id = deletedPagamento.busta_id;
          }
        }
        break;
      }

      case 'lavorazioni': {
        // Check if parent busta exists
        const { data: deletedLavorazione } = await serviceClient
          .from('lavorazioni')
          .select('busta_id')
          .eq('id', recordId)
          .single();

        if (deletedLavorazione?.busta_id) {
          const { data: busta } = await serviceClient
            .from('buste')
            .select('id, deleted_at')
            .eq('id', deletedLavorazione.busta_id)
            .single();

          if (!busta) {
            result.errors.push('La busta associata non esiste più');
            result.can_recover = false;
          } else if (busta.deleted_at) {
            result.warnings.push('La busta associata è anche nel cestino. Deve essere recuperata prima.');
            result.details.needs_parent_recovery = true;
            result.details.parent_busta_id = deletedLavorazione.busta_id;
          }
        }
        break;
      }
    }
  } catch (error) {
    console.error('CESTINO_CHECK_ERROR', error);
    result.warnings.push('Impossibile completare tutti i controlli pre-recupero');
  }

  return result;
}
