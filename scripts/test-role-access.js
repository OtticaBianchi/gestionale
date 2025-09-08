#!/usr/bin/env node

/**
 * Test script to validate role-based access to APIs
 * This simulates requests from different user roles
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Test endpoints that should be role-protected
const ENDPOINTS = [
  {
    path: '/api/ordini',
    method: 'GET',
    requiredRole: ['admin', 'manager'],
    description: 'Console Operativa - Lista ordini'
  },
  {
    path: '/api/voice-notes',
    method: 'GET',
    requiredRole: ['admin'],
    description: 'Voice Triage - Lista note vocali'
  },
  {
    path: '/api/admin/users',
    method: 'GET',
    requiredRole: ['admin'],
    description: 'Gestione Utenti - Lista utenti'
  }
]

async function testRoleAccess() {
  try {
    console.log('🧪 Testing role-based access control...\n')

    // Get all users with their profiles
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const { data: profiles } = await supabase.from('profiles').select('*')
    const profileMap = new Map(profiles.map(p => [p.id, p]))

    // Test each endpoint for each user
    for (const endpoint of ENDPOINTS) {
      console.log(`📡 Testing ${endpoint.description}`)
      console.log(`   Endpoint: ${endpoint.method} ${endpoint.path}`)
      console.log(`   Required roles: ${endpoint.requiredRole.join(', ')}\n`)

      for (const user of users) {
        const profile = profileMap.get(user.id)
        const userRole = profile?.role || 'none'
        const shouldHaveAccess = endpoint.requiredRole.includes(userRole)
        
        try {
          // Create a session for this user
          const { data: session } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: user.email,
            options: { redirectTo: 'http://localhost:3000' }
          })

          // Test the endpoint
          const response = await fetch(`http://localhost:3000${endpoint.path}`, {
            method: endpoint.method,
            headers: {
              'Content-Type': 'application/json',
              'Cookie': `sb-access-token=${session.properties?.access_token}; sb-refresh-token=${session.properties?.refresh_token}`
            }
          })

          const hasAccess = response.status !== 401 && response.status !== 403
          const statusIcon = hasAccess ? '✅' : '❌'
          const expectedIcon = shouldHaveAccess ? '✅' : '❌'
          
          console.log(`   ${statusIcon} ${user.email} (${userRole}) - Status: ${response.status}`)
          
          if (shouldHaveAccess !== hasAccess) {
            console.log(`      ⚠️  UNEXPECTED: Expected ${expectedIcon}, got ${statusIcon}`)
          }

        } catch (error) {
          console.log(`   💥 ${user.email} (${userRole}) - Error: ${error.message}`)
        }
      }
      console.log()
    }

  } catch (error) {
    console.error('💥 Test error:', error.message)
  }
}

// Wait a moment for the server to be ready
setTimeout(() => {
  testRoleAccess().then(() => {
    console.log('🎯 Role access testing completed!')
    process.exit(0)
  }).catch(error => {
    console.error('💥 Test failed:', error)
    process.exit(1)
  })
}, 3000) // Wait 3 seconds for server startup