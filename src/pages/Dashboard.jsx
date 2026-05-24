import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

function MetricCard({ label, value, delta, deltaType }) {
  return (
    <div style={{
      background: 'var(--bg-panel)',
      border: '0.5px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '16px',
    }}>
      <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: '600', lineHeight: 1, color: 'var(--text-primary)' }}>
        {value}
      </div>
      {delta && (
        <div style={{ fontSize: '11px', marginTop: '6px', color: deltaType === 'warn' ? 'var(--red)' : deltaType === 'amber' ? 'var(--amber)' : 'var(--accent)' }}>
          {delta}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ open: 0, overdue: 0, hot: 0, properties: 0 })
  const [recentLeads, setRecentLeads] = useState([])
  const [loading, setLoading] = useState(true)

  const agentName = {
    'rick@gruposoltura.com':    'Rick',
    'ingrid@gruposoltura.com':  'Ingrid',
    'lisette@gruposoltura.com': 'Lisette',
    'marco@gruposoltura.com':   'Marco',
  }[user?.email] ?? 'Agent'

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    async function load() {
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

      const [{ count: open }, { count: overdue }, { count: hot }, { count: properties }, { data: recent }] = await Promise.all([
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('followed_up', false),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('followed_up', false).lt('created_at', threeDaysAgo.toISOString()),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('followed_up', false).eq('lead_score', 'HOT'),
        supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('leads').select('id, created_at, lead_score, status, clients(first_name, last_name), properties(reference, location_city)').eq('followed_up', false).order('created_at', { ascending: false }).limit(5),
      ])

      setStats({ open: open ?? 0, overdue: overdue ?? 0, hot: hot ?? 0, properties: properties ?? 0 })
      setRecentLeads(recent ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const scoreColor = s => s === 'HOT' ? 'var(--red)' : s === 'WARM' ? 'var(--amber)' : 'var(--accent)'

  return (
    <div className="fade-in" style={{ padding: '24px', maxWidth: '900px' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: '600', color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {greeting}, {agentName}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Rojales, Alicante
        </p>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '24px' }}>
        <MetricCard label="Open leads" value={loading ? '—' : stats.open} delta={stats.overdue > 0 ? `${stats.overdue} overdue` : 'All on track'} deltaType={stats.overdue > 0 ? 'warn' : 'ok'} />
        <MetricCard label="Hot leads" value={loading ? '—' : stats.hot} delta="Need contact within 1hr" deltaType="warn" />
        <MetricCard label="Overdue" value={loading ? '—' : stats.overdue} delta="> 3 days no contact" deltaType={stats.overdue > 0 ? 'warn' : 'ok'} />
        <MetricCard label="Active listings" value={loading ? '—' : stats.properties} delta="on gruposoltura.com" deltaType="ok" />
      </div>

      {/* Recent leads */}
      <div style={{ background: 'var(--bg-panel)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '0.5px solid var(--border)' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Recent open leads
          </span>
          <button onClick={() => navigate('/leads')} style={{ fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            View all <i className="ti ti-arrow-right" style={{ fontSize: '14px' }} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>Loading...</div>
        ) : recentLeads.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>No open leads — all followed up!</div>
        ) : recentLeads.map((lead, i) => (
          <div key={lead.id} style={{
            display: 'grid',
            gridTemplateColumns: '1fr 80px 60px',
            alignItems: 'center',
            padding: '12px 18px',
            borderBottom: i < recentLeads.length - 1 ? '0.5px solid var(--border-subtle)' : 'none',
            gap: '12px',
            cursor: 'pointer',
            transition: 'background 0.1s',
          }}
            onClick={() => navigate('/leads')}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                {lead.clients ? `${lead.clients.first_name} ${lead.clients.last_name}` : 'Unknown client'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {lead.properties ? `${lead.properties.reference} · ${lead.properties.location_city}` : 'No property linked'}
              </div>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {new Date(lead.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: '600', color: scoreColor(lead.lead_score), textAlign: 'right' }}>
              {lead.lead_score ?? '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
