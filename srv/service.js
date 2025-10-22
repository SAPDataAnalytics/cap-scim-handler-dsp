const cds = require('@sap/cds')
const { fetchUsersRaw,  fetchUsers } = require('./scim_dsp')
const { uuid } = cds.utils

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

      // Only count active users (change if you want to include inactive)
      const rolesMap = new Map()

      for (const u of resources) {
        if (u.active === false) continue
        const roles = Array.isArray(u.roles) ? u.roles : []
        for (const r of roles) {
          // Normalize fields
          const roleValue = String(r.value || '').trim()
          const roleDisplay = String(r.display || roleValue).trim()
          if (!roleValue) continue

          const entry = rolesMap.get(roleValue) || { roleValue, roleDisplay, usersCount: 0 }
          entry.usersCount += 1
          rolesMap.set(roleValue, entry)
        }
      }

      return Array.from(rolesMap.values()).sort((a, b) =>
        a.roleDisplay.localeCompare(b.roleDisplay)
      )
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

  // --- ACTION handlers 
  this.on('SyncUsersVHToUsers', async (req) => {
    const tx = cds.transaction(req)
    const scim = await fetchUsers()
  // ...existing code...
    if (!scim?.length) return 0

    const incoming = scim.map(u => {
      if (!u.email) return null;
      let idVal = (typeof u.id === 'string' && u.id.trim()) ? u.id.trim() : null;
      const entry = {
        id: idVal || uuid(),
        familyName: u.lastName ?? null,
        givenName: u.firstName ?? null,
        displayName: u.displayName ?? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
        email: String(u.email).trim().toLowerCase(),
        userName: u.userName ?? null
      };
      return entry;
    }).filter(Boolean);

  // ...existing code...
    if (!incoming.length) return 0
    await tx.run(UPSERT.into(Users).entries(incoming))
    return incoming.length
  })

  this.on('SyncRolesFromSCIM', async (req) => {
    const tx = cds.transaction(req)
    const resources = await fetchUsersRaw()
    const rolesAgg = aggregateRoles(resources) // [{ value, display, userCount }]
    if (!rolesAgg.length) return 0
    const rolesWithId = rolesAgg.map(r => ({
      ID: r.value || uuid(),
      roleValue: r.value,
      roleDisplay: r.display,
      userCount: r.userCount
    }))
    await tx.run(UPSERT.into(Roles).entries(rolesWithId))
    return rolesWithId.length
  })

  this.on('SyncUserRolesFromSCIM', async (req) => {
    const tx = cds.transaction(req)
    const resources = await fetchUsersRaw()

    // keep Roles fresh (and userCount)
    const rolesAgg = aggregateRoles(resources)
    if (rolesAgg.length) {
      const rolesWithId = rolesAgg.map(r => ({
        ID: r.value || uuid(),
        roleValue: r.value,
        roleDisplay: r.display,
        userCount: r.userCount
      }))
      await tx.run(UPSERT.into(Roles).entries(rolesWithId))
    }

    // build FK rows for association-only table
    const assignments = []
    for (const u of resources) {
      if (u.active === false) continue
      const userId = u.id || uuid()
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
    const map = new Map()
    for (const u of resources) {
      if (u.active === false) continue
      const roles = Array.isArray(u.roles) ? u.roles : []
      for (const r of roles) {
        const value = String(r.value || '').trim()
        if (!value) continue
        const display = String(r.display || value).trim()
        const e = map.get(value) || { value, display, userCount: 0 }
        e.userCount += 1
        map.set(value, e)
      }
    }
    return Array.from(map.values()).sort((a, b) => a.display.localeCompare(b.display))
  }
})


