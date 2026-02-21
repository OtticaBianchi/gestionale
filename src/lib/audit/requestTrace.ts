import { createHash, randomUUID } from 'crypto'

type RequestLike = {
  headers: Headers
  method?: string | null
  url?: string | null
}

export type RequestTraceContext = {
  request_id: string
  client_request_id: string | null
  correlation_id: string | null
  request_path: string | null
  request_method: string | null
  ip_address: string | null
  user_agent: string | null
  actor_fingerprint: string | null
  trace_timestamp: string
}

const SAFE_ID_REGEX = /^[A-Za-z0-9._:-]{8,128}$/

const sanitizeTraceId = (value?: string | null): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  if (!SAFE_ID_REGEX.test(trimmed)) return null
  return trimmed
}

const safeHeaderValue = (value?: string | null): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const getRequestPath = (url?: string | null): string | null => {
  if (!url) return null
  try {
    return new URL(url).pathname || null
  } catch {
    return null
  }
}

export const getRequestIp = (request: RequestLike): string | null => {
  const forwarded = safeHeaderValue(request.headers.get('x-forwarded-for'))
  if (forwarded) {
    const firstIp = forwarded.split(',')[0]?.trim()
    if (firstIp) return firstIp
  }

  return safeHeaderValue(request.headers.get('x-real-ip'))
}

export const getRequestId = (request: RequestLike): string => {
  void request
  return `req_${randomUUID()}`
}

const buildActorFingerprint = (parts: Array<string | null | undefined>): string | null => {
  const normalized = parts
    .map((part) => (part ? part.trim() : ''))
    .filter((part) => part.length > 0)

  if (normalized.length === 0) return null

  const digest = createHash('sha256')
    .update(normalized.join('|'))
    .digest('hex')

  return digest.slice(0, 24)
}

export const buildRequestTraceContext = (
  request: RequestLike,
  options?: {
    userId?: string | null
    requestId?: string
  }
): RequestTraceContext => {
  const requestId = sanitizeTraceId(options?.requestId) || getRequestId(request)
  const ipAddress = getRequestIp(request)
  const userAgent = safeHeaderValue(request.headers.get('user-agent'))
  const requestMethod = safeHeaderValue(request.method || null)?.toUpperCase() || null
  const requestPath = getRequestPath(request.url)
  const clientRequestId = sanitizeTraceId(request.headers.get('x-request-id'))
  const correlationId = sanitizeTraceId(request.headers.get('x-correlation-id'))
  const actorFingerprint = buildActorFingerprint([options?.userId || null, ipAddress, userAgent])

  return {
    request_id: requestId,
    client_request_id: clientRequestId,
    correlation_id: correlationId,
    request_path: requestPath,
    request_method: requestMethod,
    ip_address: ipAddress,
    user_agent: userAgent,
    actor_fingerprint: actorFingerprint,
    trace_timestamp: new Date().toISOString()
  }
}

export const mergeTraceIntoMetadata = (
  metadata: Record<string, any> | null | undefined,
  trace: Record<string, any> | null | undefined
): Record<string, any> | null => {
  const safeMetadata = metadata ? { ...metadata } : {}
  if (!trace) {
    return Object.keys(safeMetadata).length > 0 ? safeMetadata : null
  }

  const existingTrace =
    safeMetadata.trace && typeof safeMetadata.trace === 'object'
      ? { ...(safeMetadata.trace as Record<string, any>) }
      : {}

  return {
    ...safeMetadata,
    trace: {
      ...existingTrace,
      ...trace
    }
  }
}
