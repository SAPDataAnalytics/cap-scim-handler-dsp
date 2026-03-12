const cds = require('@sap/cds')
const { fetchUsersRaw,  fetchUsers } = require('./scim_dsp')

module.exports = cds.service.impl(async function () {
  const { Users, Roles, UserRoles, UsersVH, RolesVH, UserRolesVH } = this.entities

  // --- map fields for the Users table (no ID here)
  const mapFields = u => ({
    familyName: u.lastName ?? null,
    givenName:  u.firstName ?? null,
    displayName: u.displayName ?? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
    email: u.email ?? null,
    userName: u.userName ?? null
  })

  this.on('READ', UsersVH, async (req) => {
    try {
      console.log('📥 Fetching users from SCIM (no cache)...')
      const userList = await fetchUsers()

      return userList.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        userName: user.userName
      }))
    } catch (error) {
      console.error('❌ Failed to fetch users from SCIM API')
      console.error('🔍 Error message:', error.message)
      console.error('📦 Full error:', error)
      console.error('📨 API response:', error.response?.data)
      req.reject(500, 'Could not retrieve users from SCIM API')
    }
  })


  this.on('READ', RolesVH, async (req) => {
    try {
      console.log('📥 Building RolesVH from SCIM…')
      const resources = await fetchUsersRaw()
      console.log(`📊 Total users fetched from SCIM: ${resources.length}`)

      // Only count active users (change if you want to include inactive)
      const rolesMap = new Map()

      for (const u of resources) {
        if (u.active === false) {
          console.log(`⏭️  Skipping inactive user: ${u.userName || u.id}`)
          continue
        }
        const roles = Array.isArray(u.roles) ? u.roles : []
        console.log(`👤 User: ${u.userName || u.id}, Roles count: ${roles.length}`)
        for (const r of roles) {
          // Normalize fields
          const roleValue = String(r.value || '').trim()
          const roleDisplay = String(r.display || roleValue).trim()
          if (!roleValue) continue
          console.log(`   ✓ Role: ${roleValue} (${roleDisplay})`)

          const entry = rolesMap.get(roleValue) || { roleValue, roleDisplay, usersCount: 0 }
          entry.usersCount += 1
          rolesMap.set(roleValue, entry)
        }
      }

      const finalRoles = Array.from(rolesMap.values()).sort((a, b) =>
        a.roleDisplay.localeCompare(b.roleDisplay)
      )
      console.log(`✅ Total unique roles: ${finalRoles.length}`)
      console.log(`📋 Role list: ${finalRoles.map(r => r.roleValue).join(', ')}`)
      return finalRoles
    } catch (error) {
      console.error('❌ Failed to build RolesVH', error)
      req.reject(500, 'Could not build RolesVH from SCIM API')
    }
  })

  this.on('READ', UserRolesVH, async (req) => {
    try {
      console.log('📥 Building UserRolesVH from SCIM…')
      const resources = await fetchUsersRaw()

      const rows = []
      for (const u of resources) {
        if (u.active === false) continue
        const userId = u.id
        const userName = u.userName || ''
        const displayName = u.displayName || (u.name?.formatted || '')
        const email =
          u.emails?.find(e => (e.type === 'work' && e.primary) || e.primary)?.value
          || u.emails?.[0]?.value
          || ''
        const roles = Array.isArray(u.roles) ? u.roles : []

        for (const r of roles) {
          const roleValue = String(r.value || '').trim()
          if (!roleValue) continue
          rows.push({
            userId,
            roleValue,
            userName,
            displayName,
            email,
            roleDisplay: String(r.display || roleValue).trim()
          })
        }
      }

      // Optional: sort for stable UI
      rows.sort((a, b) => a.displayName.localeCompare(b.displayName) || a.roleValue.localeCompare(b.roleValue))
      return rows
    } catch (error) {
      console.error('❌ Failed to build UserRolesVH', error)
      req.reject(500, 'Could not build UserRolesVH from SCIM API')
    }
  })

  // --- Search for a specific role action
  this.on('SearchRole', async (req) => {
    const { roleValue } = req.data
    console.log(`\n🔍 Searching for role: ${roleValue}`)
    
    try {
      const resources = await fetchUsersRaw()
      const found_users = []
      let exists = false

      for (const u of resources) {
        if (u.active === false) continue
        const roles = Array.isArray(u.roles) ? u.roles : []
        for (const r of roles) {
          const rValue = String(r.value || '').trim()
          if (rValue === roleValue) {
            exists = true
            found_users.push({
              userName: u.userName || '',
              displayName: u.displayName || '',
              email: u.emails?.[0]?.value || ''
            })
            console.log(`✅ Found role "${roleValue}" in user: ${u.userName || u.id}`)
          }
        }
      }

      const message = exists 
        ? `✅ Role "${roleValue}" found in ${found_users.length} user(s)`
        : `❌ Role "${roleValue}" not found in any active user in SCIM`

      console.log(message)
      return { "exists": exists, found_in_users: found_users, message }
    } catch (error) {
      console.error('❌ Failed to search role:', error)
      req.reject(500, `Could not search role: ${error.message}`)
    }
  })

  // --- ACTION handlers 
  this.on('SyncUsersVHToUsers', async (req) => {
    const tx = cds.transaction(req)
    const scim = await fetchUsers()
    if (!scim?.length) return 0

    const incoming = scim
      .filter(u => !!u.email && !!u.id)
      .map(u => ({
        id: u.id,
        firstName: u.firstName ?? null,
        lastName: u.lastName ?? null,
        displayName: u.displayName ?? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
        email: String(u.email).trim().toLowerCase(),
        userName: u.userName ?? null
      }))

    if (!incoming.length) return 0
    await tx.run(UPSERT.into(Users).entries(incoming))
    return incoming.length
  })

  this.on('SyncRolesFromSCIM', async (req) => {
    const tx = cds.transaction(req)
    const resources = await fetchUsersRaw()
    const rolesAgg = aggregateRoles(resources)
    if (!rolesAgg.length) return 0
    await tx.run(UPSERT.into(Roles).entries(rolesAgg))
    return rolesAgg.length
  })

  this.on('SyncUserRolesFromSCIM', async (req) => {
    const tx = cds.transaction(req)
    const resources = await fetchUsersRaw()

    // keep Roles fresh
    const rolesAgg = aggregateRoles(resources)
    if (rolesAgg.length) await tx.run(UPSERT.into(Roles).entries(rolesAgg))

    // build FK rows for association-only table
    const assignments = []
    for (const u of resources) {
      if (u.active === false) continue
      const userId = u.id
      if (!userId) continue
      const roles = Array.isArray(u.roles) ? u.roles : []
      for (const r of roles) {
        const roleValue = String(r.value || '').trim()
        if (!roleValue) continue
        assignments.push({ userId: userId, roleValue: roleValue })
      }
    }

    await tx.run(DELETE.from(UserRoles))
    if (assignments.length) await tx.run(INSERT.into(UserRoles).entries(assignments))
    return assignments.length
  })

  function aggregateRoles(resources) {
    console.log('\n🔍 aggregateRoles: Processing', resources.length, 'users')
    const map = new Map()
    let totalRolesFound = 0
    for (const u of resources) {
      if (u.active === false) {
        console.log(`⏭️  Skipping inactive user: ${u.userName || u.id}`)
        continue
      }
      const roles = Array.isArray(u.roles) ? u.roles : []
      if (roles.length > 0) {
        console.log(`👤 User: ${u.userName || u.id}, Roles: ${roles.map(r => r.value).join(', ')}`)
      }
      for (const r of roles) {
        const value = String(r.value || '').trim()
        if (!value) continue
        totalRolesFound++
        const display = String(r.display || value).trim()
        const e = map.get(value) || { roleValue: value, roleDisplay: display }
        map.set(value, e)
      }
    }
    const result = Array.from(map.values()).sort((a, b) => a.roleDisplay.localeCompare(b.roleDisplay))
    console.log(`✅ Aggregated ${result.length} unique roles from ${totalRolesFound} total role assignments`)
    console.log(`📋 Roles: ${result.map(r => r.roleValue).join(', ')}`)
    return result
  }
})


