'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import AnalyzeModal, { useAnalyze } from './AnalyzeModal'

interface StockResult {
  symbol: string
  name: string
  exchange: string
  region: 'KR' | 'US' | 'JP' | 'HK' | 'CA' | 'GB' | 'OTHER'
}

const FLAG: Record<StockResult['region'], string> = {
  KR: '🇰🇷', US: '🇺🇸', JP: '🇯🇵', HK: '🇭🇰', CA: '🇨🇦', GB: '🇬🇧', OTHER: '🌐',
}

export default function HomeClient() {
  const { stock, setStock, modal, startAnalysis, cancel } = useAnalyze()
  const [focused, setFocused] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StockResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showDrop, setShowDrop] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Search with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); setShowDrop(false); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data: StockResult[] = await res.json()
        setResults(data)
        setShowDrop(data.length > 0)
        setActiveIdx(-1)
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }, 300)
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowDrop(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectStock = (r: StockResult) => {
    const label = `${r.name} (${r.symbol})`
    setQuery(label)
    setStock(label)
    setShowDrop(false)
    setActiveIdx(-1)
  }

  const handleChange = (val: string) => {
    setQuery(val)
    setStock(val)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (showDrop && results.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx(i => Math.min(i + 1, results.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx(i => Math.max(i - 1, -1))
        return
      }
      if (e.key === 'Enter' && activeIdx >= 0) {
        e.preventDefault()
        selectStock(results[activeIdx])
        return
      }
      if (e.key === 'Escape') { setShowDrop(false); return }
    }
    if (e.key === 'Enter' && !showDrop) startAnalysis()
  }

  return (
    <>
      <div ref={wrapRef} style={{ position: 'relative' }}>
        {/* Search bar */}
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center',
          padding: '12px 16px', borderRadius: showDrop ? '18px 18px 0 0' : 18,
          background: '#1c1c1e',
          border: `1.5px solid ${focused ? 'rgba(10,132,255,0.6)' : 'transparent'}`,
          transition: 'border-color 0.2s',
        }}>
          <span style={{ fontSize: 18, opacity: loading ? 1 : 0.5 }}>
            {loading ? '⏳' : '🔍'}
          </span>
          <input
            type="text"
            value={query}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={handleKey}
            onFocus={() => { setFocused(true); if (results.length > 0) setShowDrop(true) }}
            onBlur={() => setFocused(false)}
            placeholder="종목명 또는 티커 입력 (예: 삼성전자, AAPL)"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#fff', fontSize: 16,
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setStock(''); setResults([]); setShowDrop(false) }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(235,235,245,0.3)', fontSize: 18, padding: '0 4px',
                lineHeight: 1,
              }}
            >×</button>
          )}
          {stock && (
            <button
              onClick={startAnalysis}
              style={{
                padding: '7px 16px', borderRadius: 12, border: 'none',
                background: '#0a84ff', color: '#fff',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              분석
            </button>
          )}
        </div>

        {/* Dropdown */}
        {showDrop && (
          <div style={{
            position: 'absolute', left: 0, right: 0, zIndex: 100,
            background: '#1c1c1e',
            border: '1.5px solid rgba(10,132,255,0.6)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '0 0 18px 18px',
            overflow: 'hidden',
          }}>
            {results.map((r, i) => (
              <button
                key={r.symbol}
                onMouseDown={() => selectStock(r)}
                onMouseEnter={() => setActiveIdx(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  width: '100%', padding: '11px 16px',
                  background: i === activeIdx ? 'rgba(10,132,255,0.15)' : 'transparent',
                  border: 'none', borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.12s',
                }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>{FLAG[r.region]}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 600, color: '#fff',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(235,235,245,0.45)', marginTop: 2 }}>
                    {r.symbol} · {r.exchange}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <AnalyzeModal modal={modal} cancel={cancel} />
    </>
  )
}
