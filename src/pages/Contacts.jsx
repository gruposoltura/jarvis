import { useState } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORY_COLOR = {
  buyer: 'var(--accent)',
  seller: 'var(--amber)',
  agent: 'var(--text-muted)',
  suspect: 'var(--text-dim)',
  prospect: '#b464cc',
}

export default function Contacts() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selected, setSelected] = useState(null)
  const [propLoading, setPropLoading] = useState(false)
  const [clientProps, setClientProps] = useState([])

  async function search() {
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    setSelected(null)
    setClientProps([])

    const { data } = await supabase
      .from('clients')
      .select('id, wp_post_id, first_name, last_name, email, phone, language, category, sales_status, budget, mailing_optin, interested_listings')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`)
      .limit(20)

    setResults(data ?? [])
    setLoading(false)
  }

  async function selectClient(client) {
    setSelected(client)
    setClientProps([])
    if (!client.interested_listings?.length) return

    setPropLoading(true)
    const { data } = await supabase
      .from('properties')
      .select('id, reference, internal_ref, status, location_city, location_suburb, price, bedrooms, property_type')
      .in('wp_post_id', client.interested_listings.slice(0, 10))

    setClientProps(data ?? [])
    setPropLoading(false)
  }

  const initials = c => `${c.first_name?.[0] ?? ''}${c.last_name?.[0] ?? ''}`.toUpperCase()
  const fullName = c => `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()

  const catColor = cat => CATEGORY_COLOR[cat?.toLowerCase()] ?? 'var(--text-dim)'

  return (
    <div className="fade-in" style={{ padding: '24px', maxWidth: '900px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '600', color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Contact Search
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '3px' }}>
          Search by name, email, or phone
        </p>
      </div>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: '10px',
          background: 'var(--bg-panel)',
          border: '0.5px solid var(--accent-border)',
          borderRadius: 'var(--radius)',
          padding: '0 14px',
        }}>
          <i className="ti ti-search" style={{ color: 'var(--text-dim)', fontSize: '16px' }} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Jan Bakker, jan@example.com, +31..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: '14px', padding: '12px 0',
            }}
          />
          {query && <button onClick={() => { setQuery(''); setResults([]); setSearched(false); setSelected(null) }} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '16px', display: 'flex' }}><i className="ti ti-x" /></button>}
        </div>
        <button onClick={search} style={{
          padding: '0 20px',
          background: 'var(--accent)',
          border: 'none',
          borderRadius: 'var(--radius)',
          color: '#0a0e14',
          fontFamily: 'var(--font-display)',
          fontSize: '13px', fontWeight: '600', letterSpacing: '0.08em',
          cursor: 'pointer', textTransform: 'uppercase',
        }}>
          Search
        </button>
      </div>

      {loading && <div style={{ color: 'var(--text-dim)', fontSize: '13px' }}>Searching...</div>}

      {!loading && searched && results.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '24px 0' }}>No contacts found for "{query}"</div>
      )}

      {!loading && results.length > 0 && (
        <div style={{ display: 'flex', gap: '12px' }}>

          {/* List */}
          <div style={{ width: '260px', flexShrink: 0 }}>
            {results.map(c => (
              <div key={c.id} onClick={() => selectClient(c)} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px',
                background: selected?.id === c.id ? 'var(--accent-dim)' : 'var(--bg-panel)',
                border: `0.5px solid ${selected?.id === c.id ? 'var(--accent-border-strong)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
                marginBottom: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                  background: `${catColor(c.category)}22`,
                  border: `1px solid ${catColor(c.category)}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: '500', color: catColor(c.category),
                }}>
                  {initials(c)}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {fullName(c)}
                  </div>
                  <div style={{ fontSize: '11px', color: catColor(c.category), textTransform: 'capitalize', marginTop: '1px' }}>
                    {c.category ?? 'Unknown'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Detail card */}
          {selected && (
            <div style={{ flex: 1, background: 'var(--bg-panel)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>

              {/* Avatar + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: `${catColor(selected.category)}22`,
                  border: `1.5px solid ${catColor(selected.category)}55`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', fontWeight: '500', color: catColor(selected.category),
                  flexShrink: 0,
                }}>
                  {initials(selected)}
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-primary)' }}>{fullName(selected)}</div>
                  <div style={{ fontSize: '12px', color: catColor(selected.category), textTransform: 'capitalize', marginTop: '2px' }}>
                    {selected.category}{selected.sales_status ? ` · ${selected.sales_status}` : ''}
                  </div>
                </div>
              </div>

              {/* Contact details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
                {selected.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <i className="ti ti-mail" style={{ color: 'var(--text-dim)', fontSize: '15px', width: '16px' }} />
                    <a href={`mailto:${selected.email}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{selected.email}</a>
                  </div>
                )}
                {selected.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <i className="ti ti-phone" style={{ color: 'var(--text-dim)', fontSize: '15px', width: '16px' }} />
                    <a href={`tel:${selected.phone}`} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>{selected.phone}</a>
                  </div>
                )}
                {selected.language && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <i className="ti ti-language" style={{ color: 'var(--text-dim)', fontSize: '15px', width: '16px' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{selected.language}</span>
                  </div>
                )}
                {selected.budget && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <i className="ti ti-currency-euro" style={{ color: 'var(--text-dim)', fontSize: '15px', width: '16px' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>Budget: {selected.budget}</span>
                  </div>
                )}
              </div>

              {/* Interested properties */}
              {(selected.interested_listings?.length > 0) && (
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                    Interested in {selected.interested_listings.length} {selected.interested_listings.length === 1 ? 'property' : 'properties'}
                  </div>
                  {propLoading ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Loading...</div>
                  ) : clientProps.map(p => (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'var(--bg-input)',
                      borderRadius: 'var(--radius)',
                      marginBottom: '6px',
                      fontSize: '12px',
                    }}>
                      <div>
                        <span style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', marginRight: '8px' }}>{p.reference ?? p.internal_ref}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{p.property_type} · {p.location_suburb ?? p.location_city}</span>
                      </div>
                      <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>€{p.price?.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
