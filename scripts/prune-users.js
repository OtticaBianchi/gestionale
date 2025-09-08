// Danger: delete all Supabase auth users except one email.
// Usage:
//   KEEP_EMAIL="admin@example.com" node scripts/prune-users.js
// Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

/* eslint-disable no-console */
const { createClient } = require('@supabase/supabase-js')

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const keepEmail = process.env.KEEP_EMAIL

  if (!url || !serviceKey) throw new Error('Missing Supabase env vars')
  if (!keepEmail) throw new Error('Set KEEP_EMAIL environment variable')

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  console.log('Fetching users...')
  let deleted = 0
  let kept = 0
  let page = 1
  // Paginate until empty
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    if (!data.users || data.users.length === 0) break

    for (const u of data.users) {
      if ((u.email || '').toLowerCase() === keepEmail.toLowerCase()) {
        console.log('Keeping', u.email, u.id)
        kept++
        continue
      }
      // Delete profile row first (best effort)
      try {
        await admin.from('profiles').delete().eq('id', u.id)
      } catch {}
      // Delete auth user
      const { error: delErr } = await admin.auth.admin.deleteUser(u.id)
      if (delErr) {
        console.error('Failed to delete', u.email, delErr.message)
      } else {
        console.log('Deleted', u.email, u.id)
        deleted++
      }
    }
    page++
  }

  console.log(`Done. Kept: ${kept}, Deleted: ${deleted}`)
}

main().catch((e) => { console.error(e); process.exit(1) })

