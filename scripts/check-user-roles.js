#!/usr/bin/env node

/**
 * Diagnostic script to check user roles and profiles
 * Run with: node scripts/check-user-roles.js
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkUserRoles() {
  try {
    console.log('🔍 Checking user roles and profiles...\n')

    // Get all auth users
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers()
    if (authError) {
      console.error('❌ Error fetching auth users:', authError.message)
      return
    }

    console.log(`📊 Found ${users.length} auth users`)

    // Get all profiles
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
    
    if (profileError) {
      console.error('❌ Error fetching profiles:', profileError.message)
      return
    }

    console.log(`📊 Found ${profiles.length} profiles\n`)

    // Map profiles by user ID
    const profileMap = new Map(profiles.map(p => [p.id, p]))

    // Check each user
    for (const user of users) {
      const profile = profileMap.get(user.id)
      
      console.log(`👤 User: ${user.email}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Created: ${new Date(user.created_at).toLocaleString('it-IT')}`)
      console.log(`   Last sign in: ${user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('it-IT') : 'Never'}`)
      console.log(`   Auth metadata role: ${user.user_metadata?.role || 'Not set'}`)
      
      if (profile) {
        console.log(`   ✅ Profile exists`)
        console.log(`   Profile role: ${profile.role || 'Not set'}`)
        console.log(`   Full name: ${profile.full_name || 'Not set'}`)
        
        // Check for inconsistencies
        if (user.user_metadata?.role && profile.role !== user.user_metadata.role) {
          console.log(`   ⚠️  INCONSISTENCY: Auth metadata role (${user.user_metadata.role}) != Profile role (${profile.role})`)
        }
      } else {
        console.log(`   ❌ NO PROFILE FOUND - This user cannot access the application!`)
      }
      console.log()
    }

    // Summary
    console.log('\n📈 SUMMARY:')
    const adminUsers = profiles.filter(p => p.role === 'admin')
    const managerUsers = profiles.filter(p => p.role === 'manager')
    const operatoreUsers = profiles.filter(p => p.role === 'operatore')
    const noRoleUsers = profiles.filter(p => !p.role)

    console.log(`   👑 Admins: ${adminUsers.length}`)
    console.log(`   👔 Managers: ${managerUsers.length}`)
    console.log(`   👤 Operatori: ${operatoreUsers.length}`)
    console.log(`   ❓ No role: ${noRoleUsers.length}`)

    if (noRoleUsers.length > 0) {
      console.log('\n⚠️  USERS WITHOUT ROLES:')
      noRoleUsers.forEach(user => {
        console.log(`   - ${user.full_name || user.id} (${user.id})`)
      })
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error.message)
  }
}

checkUserRoles()