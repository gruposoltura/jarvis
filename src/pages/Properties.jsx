import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Properties() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selected, setSelected] = useState(null)

  async function search() {
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    setSelected(null)

    const { data } = await supabase
      .from('properties')
      .select('id, reference, internal_ref, status, property_type, price, bedrooms, bathrooms, area_m2, land_area_m2, location_city, location_suburb, street, postal_code, key_number, images, features, owner_wp_post_id, sold_date, sold_price')
      .or(`reference.ilike.%${query}%,internal_ref.ilike.%${query}%,street.ilike.%${query}%,location_city.ilike.%${query}%,location_suburb.ilike.%${query}%,key_number.ilike.%${query}%`)
      .limit(20)

    setResults(data ?? [])
    setLoading(false)
  }

  const statusColor = s => {
    if (!s) return 'var(--text-dim)'
    if (s === 'publish' || s === 'published') return 'var(--accent)'
    if (s === 'reserved') return 'var(--amber)'
    if (s === 'sold') return 'var(--red)'
    return 'var(--text-muted)'
  }

  const statusLabel = s => {
    if (s === 'publish' || s === 'published') return 'Active'
    if (s === 'sold') return 'Sold'
    if (s === 'reserved') return 'Reserved'
    return s ?? 'Unknown'
  }

  return (
    <div className="fade-in" style={{ padding: '24px', maxWidth: '900px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '600', color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Property Search
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '3px' }}>
          Search by reference, address, suburb, or key number
        </p>
      </div>

      {/* Search input */}
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
            placeholder="GS-0441, Benijófar, Calle Mar, key 42..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: '14px', padding: '12px 0',
            }}
          />
          {query && <button onClick={() => { setQuery(''); setResults([]); setSearched(false) }} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '16px', display: 'flex' }}><i className="ti ti-x" /></button>}
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
          transition: 'opacity 0.15s',
        }}>
          Search
        </button>
      </div>

      {/* Results */}
      {loading && <div style={{ color: 'var(--text-dim)', fontSize: '13px' }}>Searching...</div>}

      {!loading && searched && results.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '24px 0' }}>No properties found for "{query}"</div>
      )}

      {!loading && results.length > 0 && (
        <div style={{ display: 'flex', gap: '12px' }}>

          {/* List */}
          <div style={{ width: '280px', flexShrink: 0 }}>
            {results.map(p => (
              <div key={p.id} onClick={() => setSelected(p)} style={{
                padding: '12px 14px',
                background: selected?.id === p.id ? 'var(--accent-dim)' : 'var(--bg-panel)',
                border: `0.5px solid ${selected?.id === p.id ? 'var(--accent-border-strong)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
                marginBottom: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor(p.status), flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: statusColor(p.status), letterSpacing: '0.06em' }}>
                    {p.reference ?? p.internal_ref}
                  </span>
                </div>
                <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)' }}>
                  {p.street ?? p.location_city}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {p.location_suburb && `${p.location_suburb} · `}{p.property_type} · €{p.price?.toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          {/* Detail card */}
          {selected && (
            <div style={{ flex: 1, background: 'var(--bg-panel)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: statusColor(selected.status), letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
                    {statusLabel(selected.status)} · {selected.reference ?? selected.internal_ref}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-primary)' }}>
                    {selected.street ?? 'No address'}{selected.location_suburb ? `, ${selected.location_suburb}` : ''}{selected.location_city ? `, ${selected.location_city}` : ''}
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  €{selected.price?.toLocaleString()}
                </div>
              </div>

              {/* Specs grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
                {[
                  ['Type', selected.property_type],
                  ['Bedrooms', selected.bedrooms],
                  ['Bathrooms', selected.bathrooms],
                  ['Built area', selected.area_m2 ? `${selected.area_m2} m²` : '—'],
                  ['Plot', selected.land_area_m2 ? `${selected.land_area_m2} m²` : '—'],
                  ['Key number', selected.key_number ?? '—'],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius)', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>{value ?? '—'}</div>
                  </div>
                ))}
              </div>

              {selected.sold_date && (
                <div style={{ background: 'var(--red-dim)', border: '0.5px solid var(--red-border)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: '12px', color: 'var(--red)' }}>
                  Sold {new Date(selected.sold_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {selected.sold_price && ` · €${selected.sold_price.toLocaleString()}`}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
