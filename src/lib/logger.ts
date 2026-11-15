// src/lib/logger.ts
//
// Logger centralizzato: debug/info sono silenziati in produzione, warn/error
// restano sempre attivi. Non passare mai PII (email, trascrizioni, numeri di
// telefono) a warn/error: usa identificativi opachi (es. user.id troncato).
const isDev = process.env.NODE_ENV !== 'production'

export const logger = {
  debug: (...args: any[]) => { if (isDev) console.log(...args) },
  info: (...args: any[]) => { if (isDev) console.log(...args) },
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args),
}
