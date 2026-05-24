import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { to: '/',           icon: 'ti-layout-dashboard', label: 'Dashboard' },
  { to: '/leads',      icon: 'ti-target',            label: 'Leads' },
  { to: '/properties', icon: 'ti-building',          label: 'Properties' },
  { to: '/contacts',   icon: 'ti-users',             label: 'Contacts' },
]

function AgentInitials(email) {
  const map = {
    'rick@gruposoltura.com':    { initials: 'RV', color: '#00c8b4' },
    'ingrid@gruposoltura.com':  { initials: 'IV', color: '#4a9fd4' },
    'lisette@gruposoltura.com': { initials: 'LD', color: '#b464cc' },
    'marco@gruposoltura.com':   { initials: 'MV', color: '#e89b30' },
  }
  return map[email] ?? { initials: email?.charAt(0).toUpperCase() ?? '?', color: '#4a6070' }
}

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const agent = AgentInitials(user?.email)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* Sidebar */}
      <nav style={{
        width: 'var(--sidebar-width)',
        background: 'var(--bg-input)',
        borderRight: '0.5px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 0',
        gap: '4px',
        flexShrink: 0,
        zIndex: 10,
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '10px',
          fontWeight: '600',
          color: 'var(--accent)',
          letterSpacing: '0.12em',
          marginBottom: '16px',
          writingMode: 'vertical-rl',
          userSelect: 'none',
        }}>
          J·A·R·V·I·S
        </div>

        {navItems.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={label}
            style={({ isActive }) => ({
              width: '36px', height: '36px',
              borderRadius: 'var(--radius)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px',
              color: isActive ? 'var(--accent)' : 'var(--text-dim)',
              background: isActive ? 'var(--accent-dim)' : 'transparent',
              border: isActive ? '0.5px solid var(--accent-border)' : '0.5px solid transparent',
              textDecoration: 'none',
              transition: 'all 0.15s',
            })}
          >
            <i className={`ti ${icon}`} aria-hidden="true" />
          </NavLink>
        ))}

        <div style={{ flex: 1 }} />

        {/* Agent avatar */}
        <div
          title={user?.email}
          style={{
            width: '32px', height: '32px',
            borderRadius: '50%',
            background: `${agent.color}22`,
            border: `1px solid ${agent.color}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: '500',
            color: agent.color,
            cursor: 'pointer',
            marginBottom: '4px',
          }}
        >
          {agent.initials}
        </div>

        <button
          onClick={handleSignOut}
          title="Sign out"
          style={{
            width: '36px', height: '36px',
            borderRadius: 'var(--radius)',
            background: 'transparent',
            border: '0.5px solid transparent',
            color: 'var(--text-dim)',
            fontSize: '18px',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'var(--red-dim)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'transparent' }}
        >
          <i className="ti ti-logout" aria-hidden="true" />
        </button>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg-base)' }}>
        <Outlet />
      </main>
    </div>
  )
}
