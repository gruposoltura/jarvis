import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const SCORE_COLOR = { HOT: 'var(--red)', WARM: 'var(--amber)', COLD: 'var(--accent)' }
const SCORE_BG    = { HOT: 'var(--red-dim)', WARM: 'var(--amber-dim)', COLD: 'var(--accent-dim)' }

export default function Leads() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open') // open | all | mine
  const [saving, setSaving] = useState(null)

  useEffect(() => { fetchLeads() }, [filter])

  async function fetchLeads() {
    setLoading(true)
    let query = supabase
      .from('leads')
      .select('id, created_at, lead_score, status, followed_up, client_wp_post_id, property_wp_post_id, clients(first_name, last_name, email, phone, language), properties(reference, internal_ref, location_city, location_suburb, price, bedrooms, bathrooms)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (filter === 'open') query = query.eq('followed_up', false)

    const { data, error } = await query
    if (!error) setLeads(data ?? [])
    setLoading(false)
  }

  async function toggleFollowedUp(lead) {
    setSaving(lead.id)
    const newVal = !lead.followed_up
    const { error } = await supabase.from('leads').update({ followed_up: newVal }).eq('id', lead.id)
    if (!error) {
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, followed_up: newVal } : l))
    }
    setSaving(null)
  }

  const isOverdue = (lead) => {
    if (lead.followed_up) return false
    const created = new Date(lead.created_at)
    const diff = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24)
    return diff > 3
  }

  return (
    <div className="fade-in" style={{ padding: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '600', color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Lead Follow-up
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '3px' }}>
            {leads.filter(l => !l.followed_up).length} open · {leads.filter(isOverdue).length} overdue
          </p>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[['open','Open'],['all','All'],].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)} style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius)',
              border: `0.5px solid ${filter === val ? 'var(--accent-border-strong)' : 'var(--border)'}`,
              background: filter === val ? 'var(--accent-dim)' : 'transparent',
              color: filter === val ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: '500',
              letterSpacing: '0.06em', cursor: 'pointer', textTransform: 'uppercase',
              transition: 'all 0.15s',
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-panel)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>

        {/* Col headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 90px 80px 52px', padding: '10px 18px', gap: '12px', borderBottom: '0.5px solid var(--border)' }}>
          {['Client / Property', 'Contact', 'Score', 'Received', 'Done'].map((h, i) => (
            <div key={h} style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', textAlign: i >= 2 ? 'center' : 'left' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>Loading leads...</div>
        ) : leads.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
            {filter === 'open' ? '✓ All leads followed up' : 'No leads found'}
          </div>
        ) : leads.map((lead, i) => {
          const overdue = isOverdue(lead)
          const client = lead.clients
          const prop = lead.properties

          return (
            <div key={lead.id} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 160px 90px 80px 52px',
              alignItems: 'center',
              padding: '12px 18px',
              gap: '12px',
              borderBottom: i < leads.length - 1 ? '0.5px solid var(--border-subtle)' : 'none',
              borderLeft: overdue ? '2px solid var(--red)' : lead.lead_score === 'HOT' ? '2px solid var(--amber)' : '2px solid transparent',
              background: overdue ? 'rgba(220,50,50,0.025)' : 'transparent',
              transition: 'background 0.1s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = overdue ? 'rgba(220,50,50,0.04)' : 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = overdue ? 'rgba(220,50,50,0.025)' : 'transparent'}
            >
              {/* Client + property */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                    {client ? `${client.first_name} ${client.last_name}` : '—'}
                  </span>
                  {overdue && (
                    <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '10px', background: 'var(--red-dim)', color: 'var(--red)', border: '0.5px solid var(--red-border)' }}>
                      Overdue
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {prop ? `${prop.reference ?? prop.internal_ref} · ${prop.location_city}${prop.location_suburb ? `, ${prop.location_suburb}` : ''} · €${prop.price?.toLocaleString()}` : 'No property linked'}
                </div>
              </div>

              {/* Contact info */}
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden' }}>
                {client?.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><i className="ti ti-phone" style={{ fontSize: '12px', color: 'var(--text-dim)' }} />{client.phone}</div>}
                {client?.language && <div style={{ marginTop: '2px', color: 'var(--text-dim)' }}>{client.language}</div>}
              </div>

              {/* Score */}
              <div style={{ textAlign: 'center' }}>
                {lead.lead_score ? (
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: '600',
                    padding: '3px 10px', borderRadius: '10px',
                    background: SCORE_BG[lead.lead_score],
                    color: SCORE_COLOR[lead.lead_score],
                  }}>
                    {lead.lead_score}
                  </span>
                ) : <span style={{ color: 'var(--text-dim)' }}>—</span>}
              </div>

              {/* Date */}
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                {new Date(lead.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </div>

              {/* Tick */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={() => toggleFollowedUp(lead)}
                  disabled={saving === lead.id}
                  title={lead.followed_up ? 'Mark as open' : 'Mark as followed up'}
                  style={{
                    width: '22px', height: '22px',
                    borderRadius: '5px',
                    border: `1.5px solid ${lead.followed_up ? 'var(--accent)' : 'rgba(0,200,180,0.25)'}`,
                    background: lead.followed_up ? 'var(--accent-dim)' : 'transparent',
                    color: 'var(--accent)',
                    fontSize: '13px',
                    cursor: saving === lead.id ? 'wait' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  {lead.followed_up && <i className="ti ti-check" aria-hidden="true" />}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
