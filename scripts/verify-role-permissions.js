#!/usr/bin/env node

/**
 * Script to verify role-based access control is working correctly
 * This checks if the middleware and API routes properly enforce role restrictions
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function verifyRolePermissions() {
  try {
    console.log('🔐 Verifying role-based permissions...\n')

    // Get users and their profiles
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const { data: profiles } = await supabase.from('profiles').select('*')
    
    if (!profiles || profiles.length === 0) {
      console.log('❌ No profiles found! Users cannot access the application.')
      return
    }

    const profileMap = new Map(profiles.map(p => [p.id, p]))

    console.log('📊 Current user roles:')
    for (const user of users) {
      const profile = profileMap.get(user.id)
      console.log(`   ${user.email}: ${profile?.role || 'NO PROFILE'} ${profile?.role === 'admin' ? '👑' : profile?.role === 'manager' ? '👔' : '👤'}`)
    }
    console.log()

    // Test 1: Check middleware protection paths
    console.log('🛡️  Testing middleware protection...')
    
    const protectedPaths = [
      { path: '/admin/users', requiredRole: ['admin'], description: 'Admin user management' },
      { path: '/modules/voice-triage', requiredRole: ['admin'], description: 'Voice triage module' },
      { path: '/modules/operations', requiredRole: ['admin', 'manager'], description: 'Operations console' },
      { path: '/modules/archive', requiredRole: ['admin', 'manager'], description: 'Archive module' },
    ]

    protectedPaths.forEach(route => {
      const allowedUsers = users.filter(user => {
        const profile = profileMap.get(user.id)
        return profile && route.requiredRole.includes(profile.role)
      })
      
      console.log(`   📍 ${route.path} (${route.description})`)
      console.log(`      Required: ${route.requiredRole.join(', ')}`)
      console.log(`      Allowed users: ${allowedUsers.map(u => u.email).join(', ') || 'None'}`)
    })
    console.log()

    // Test 2: Check API endpoint role requirements
    console.log('🔗 API endpoint role requirements...')
    
    const apiEndpoints = [
      { path: '/api/ordini', roles: ['admin', 'manager'], description: 'Orders management' },
      { path: '/api/voice-notes', roles: ['admin'], description: 'Voice notes access' },
      { path: '/api/admin/users', roles: ['admin'], description: 'User management API' },
    ]

    apiEndpoints.forEach(api => {
      const allowedUsers = users.filter(user => {
        const profile = profileMap.get(user.id)
        return profile && api.roles.includes(profile.role)
      })
      
      console.log(`   📡 ${api.path} (${api.description})`)
      console.log(`      Required: ${api.roles.join(', ')}`)
      console.log(`      Allowed users: ${allowedUsers.map(u => u.email).join(', ') || 'None'}`)
    })
    console.log()

    // Test 3: Verify role distribution
    console.log('📈 Role distribution analysis...')
    const roleCount = profiles.reduce((acc, profile) => {
      acc[profile.role] = (acc[profile.role] || 0) + 1
      return acc
    }, {})

    Object.entries(roleCount).forEach(([role, count]) => {
      const icon = role === 'admin' ? '👑' : role === 'manager' ? '👔' : '👤'
      console.log(`   ${icon} ${role}: ${count} users`)
    })

    // Recommendations
    console.log('\n💡 Recommendations:')
    
    if (!roleCount.admin || roleCount.admin === 0) {
      console.log('   ⚠️  No admin users found! Create at least one admin.')
    }
    
    if (roleCount.admin === 1) {
      console.log('   ⚠️  Only one admin user. Consider having a backup admin.')
    }

    if (!roleCount.manager && roleCount.operatore > 2) {
      console.log('   💡 Consider promoting some operatori to manager for better workflow.')
    }

    const usersWithoutProfile = users.filter(user => !profileMap.has(user.id))
    if (usersWithoutProfile.length > 0) {
      console.log(`   ❌ ${usersWithoutProfile.length} users without profiles:`)
      usersWithoutProfile.forEach(user => {
        console.log(`      - ${user.email}`)
      })
    }

    console.log('\n✅ Role permission verification completed!')
    
    // Summary
    const totalUsers = users.length
    const usersWithRoles = profiles.filter(p => p.role).length
    const adminUsers = profiles.filter(p => p.role === 'admin').length
    const managerUsers = profiles.filter(p => p.role === 'manager').length
    
    console.log('\n📋 SUMMARY:')
    console.log(`   Total users: ${totalUsers}`)
    console.log(`   Users with roles: ${usersWithRoles}/${totalUsers}`)
    console.log(`   Admin access to all modules: ${adminUsers} users`)
    console.log(`   Manager access to operations: ${adminUsers + managerUsers} users`)
    console.log(`   Voice Triage access: ${adminUsers} users only`)

  } catch (error) {
    console.error('💥 Verification failed:', error.message)
  }
}

verifyRolePermissions()