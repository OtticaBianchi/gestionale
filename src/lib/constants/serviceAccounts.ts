/**
 * Account di servizio: profili che esistono solo per scopi tecnici e NON
 * rappresentano persone reali. Vanno esclusi da roster/statistiche (controllo
 * letture procedure, compliance, ecc.) dove altrimenti sporcano i dati come
 * utenti che "non hanno mai letto nulla".
 *
 * NON cancellare questi account: servono al funzionamento (es. login del bot
 * Telegram). Si filtrano solo dalle viste.
 */
export const SERVICE_ACCOUNT_IDS: readonly string[] = [
  // negozio@obvocalitelegram.eu — login usato dall'integrazione bot Telegram
  '6b99d988-56fc-4584-a0b8-6261d9095d94',
]

/** True se il profilo è un account di servizio (da escludere dalle statistiche). */
export function isServiceAccount(userId: string | null | undefined): boolean {
  return !!userId && SERVICE_ACCOUNT_IDS.includes(userId)
}
