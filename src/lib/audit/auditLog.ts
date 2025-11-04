// ============================================================================
// Audit Logging Utility (TIER 1C)
// ============================================================================
// Purpose: Centralized utility for logging all data changes to audit_log table
// Date: 2025-01-24

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

// ============================================================================
// Types
// ============================================================================

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

export interface FieldChange {
  old: any;
  new: any;
}

export interface ChangedFields {
  [fieldName: string]: FieldChange;
}

export interface AuditLogEntry {
  tableName: string;
  recordId: string;
  action: AuditAction;
  userId: string;
  changedFields?: ChangedFields | null;
  reason?: string | null;
  metadata?: Record<string, any> | null;
}

export interface AuditLogOptions {
  // If true, also logs to console
  logToConsole?: boolean;
  // Custom console log prefix
  consolePrefix?: string;
  // Include IP address (from request headers)
  ipAddress?: string;
  // Include user agent (from request headers)
  userAgent?: string;
}

// ============================================================================
// Main Audit Logging Function
// ============================================================================

/**
 * Logs a change to the audit_log table
 *
 * @example
 * await logAuditChange({
 *   tableName: 'ordini_materiali',
 *   recordId: ordine.id,
 *   action: 'UPDATE',
 *   userId: user.id,
 *   changedFields: {
 *     descrizione_prodotto: {
 *       old: 'Old description',
 *       new: 'New description'
 *     }
 *   },
 *   reason: 'User corrected product description'
 * });
 */
export async function logAuditChange(
  entry: AuditLogEntry,
  options: AuditLogOptions = {}
): Promise<{ success: boolean; auditId?: string; error?: string }> {
  const {
    logToConsole = true,
    consolePrefix = 'AUDIT',
    ipAddress,
    userAgent
  } = options;

  try {
    // Use service role client to bypass RLS for audit logging
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get user role for snapshot
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', entry.userId)
      .single();

    // Insert audit log
    const { data, error } = await supabase
      .from('audit_log')
      .insert({
        table_name: entry.tableName,
        record_id: entry.recordId,
        action: entry.action,
        user_id: entry.userId,
        user_role: profile?.role || null,
        changed_fields: (entry.changedFields || null) as any,
        reason: entry.reason || null,
        metadata: (entry.metadata || null) as any,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      console.error('❌ AUDIT_LOG_ERROR', {
        error: error.message,
        entry,
        timestamp: new Date().toISOString()
      });
      return { success: false, error: error.message };
    }

    // Console logging for real-time monitoring
    if (logToConsole) {
      const logLevel = entry.action === 'DELETE' ? 'warn' : 'info';
      console[logLevel](`${consolePrefix}_${entry.action}`, {
        table: entry.tableName,
        id: entry.recordId,
        user: entry.userId,
        role: profile?.role,
        fields: entry.changedFields ? Object.keys(entry.changedFields) : [],
        reason: entry.reason,
        auditId: data?.id,
        timestamp: new Date().toISOString()
      });
    }

    return { success: true, auditId: data?.id };

  } catch (error: any) {
    console.error('❌ AUDIT_LOG_EXCEPTION', {
      message: error?.message,
      entry,
      timestamp: new Date().toISOString()
    });
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

// ============================================================================
// Convenience Functions for Common Operations
// ============================================================================

/**
 * Log an UPDATE operation with field-level changes
 */
export async function logUpdate(
  tableName: string,
  recordId: string,
  userId: string,
  oldValues: Record<string, any>,
  newValues: Record<string, any>,
  reason?: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; auditId?: string; error?: string }> {
  // Build changed_fields object by comparing old and new
  const changedFields: ChangedFields = {};

  for (const key in newValues) {
    if (oldValues[key] !== newValues[key]) {
      changedFields[key] = {
        old: oldValues[key],
        new: newValues[key]
      };
    }
  }

  // Only log if something actually changed
  if (Object.keys(changedFields).length === 0) {
    console.info('AUDIT_NO_CHANGES', {
      table: tableName,
      id: recordId,
      message: 'No fields changed, skipping audit log'
    });
    return { success: true };
  }

  return logAuditChange({
    tableName,
    recordId,
    action: 'UPDATE',
    userId,
    changedFields,
    reason,
    metadata
  });
}

/**
 * Log an INSERT operation
 */
export async function logInsert(
  tableName: string,
  recordId: string,
  userId: string,
  newValues: Record<string, any>,
  reason?: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; auditId?: string; error?: string }> {
  return logAuditChange({
    tableName,
    recordId,
    action: 'INSERT',
    userId,
    changedFields: {
      _created: {
        old: null,
        new: newValues
      }
    },
    reason,
    metadata
  });
}

/**
 * Log a DELETE operation
 */
export async function logDelete(
  tableName: string,
  recordId: string,
  userId: string,
  deletedValues: Record<string, any>,
  reason?: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; auditId?: string; error?: string }> {
  return logAuditChange({
    tableName,
    recordId,
    action: 'DELETE',
    userId,
    changedFields: {
      _deleted: {
        old: deletedValues,
        new: null
      }
    },
    reason,
    metadata
  });
}

// ============================================================================
// Query Helpers
// ============================================================================

/**
 * Get audit history for a specific record
 */
export async function getAuditHistory(
  tableName: string,
  recordId: string
): Promise<any[]> {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('audit_log')
    .select(`
      *,
      profiles:user_id (
        full_name,
        role
      )
    `)
    .eq('table_name', tableName)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching audit history:', error);
    return [];
  }

  return data || [];
}

/**
 * Get recent changes by a user
 */
export async function getUserActivity(
  userId: string,
  limit: number = 100
): Promise<any[]> {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching user activity:', error);
    return [];
  }

  return data || [];
}
