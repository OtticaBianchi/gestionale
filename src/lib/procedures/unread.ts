import type { SupabaseClient } from '@supabase/supabase-js';

type Supabase = SupabaseClient<any>;

export type ProcedureRecord = {
  id: string;
  updated_at: string;
  created_at: string;
  last_reviewed_at?: string | null;
  version?: number | null;
};

export type ProcedureReceiptRecord = {
  procedure_id: string;
  acknowledged_at: string;
  acknowledged_updated_at: string;
  acknowledged_version: number | null;
};

export type ProcedureReadStatus = {
  acknowledgedAt: string | null;
  acknowledgedUpdatedAt: string | null;
  acknowledgedVersion: number | null;
  isUnread: boolean;
  isNew: boolean;
  isUpdated: boolean;
};

export function computeReadStatus(
  procedure: ProcedureRecord,
  receipt?: ProcedureReceiptRecord | null
): ProcedureReadStatus {
  const contentUpdatedAtIso =
    procedure.last_reviewed_at || procedure.updated_at || procedure.created_at;
  const contentUpdatedAt = contentUpdatedAtIso
    ? new Date(contentUpdatedAtIso).getTime()
    : 0;

  const acknowledgedUpdatedAtIso =
    receipt?.acknowledged_updated_at || receipt?.acknowledged_at || null;
  const acknowledgedUpdatedAt = acknowledgedUpdatedAtIso
    ? new Date(acknowledgedUpdatedAtIso).getTime()
    : 0;

  const isNew = !receipt;
  const version = procedure.version ?? null;
  const acknowledgedVersion = receipt?.acknowledged_version ?? null;
  const isVersionUpdated =
    version !== null &&
    acknowledgedVersion !== null &&
    version > acknowledgedVersion;
  const isUpdated = !!receipt && (isVersionUpdated || contentUpdatedAt > acknowledgedUpdatedAt);
  const isUnread = isNew || isUpdated;

  return {
    acknowledgedAt: receipt?.acknowledged_at ?? null,
    acknowledgedUpdatedAt: acknowledgedUpdatedAtIso,
    acknowledgedVersion: receipt?.acknowledged_version ?? null,
    isUnread,
    isNew,
    isUpdated,
  };
}

export async function fetchReceiptsMap(
  adminClient: Supabase,
  userId: string,
  procedureIds: string[]
): Promise<Map<string, ProcedureReceiptRecord>> {
  if (!procedureIds.length) {
    return new Map();
  }

  const { data: receipts, error } = await adminClient
    .from('procedure_read_receipts')
    .select('procedure_id, acknowledged_at, acknowledged_updated_at, acknowledged_version')
    .eq('user_id', userId)
    .in('procedure_id', procedureIds);

  if (error) {
    throw error;
  }

  const map = new Map<string, ProcedureReceiptRecord>();
  (receipts ?? []).forEach((receipt) => {
    map.set(receipt.procedure_id, receipt);
  });

  return map;
}

export async function getUnreadProceduresCount(
  adminClient: Supabase,
  userId: string
): Promise<number> {
  const { data: procedures, error } = await adminClient
    .from('procedures')
    .select('id, updated_at, created_at, last_reviewed_at, version')
    .eq('is_active', true);

  if (error) {
    throw error;
  }

  const list = procedures ?? [];
  if (!list.length) {
    return 0;
  }

  const receiptsMap = await fetchReceiptsMap(
    adminClient,
    userId,
    list.map((proc) => proc.id)
  );

  let count = 0;
  list.forEach((proc) => {
    const status = computeReadStatus(proc, receiptsMap.get(proc.id));
    if (status.isUnread) {
      count += 1;
    }
  });

  return count;
}
