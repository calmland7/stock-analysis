'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import AnalyzeModal, { useAnalyze } from './AnalyzeModal'

export default function HomeClient() {
  const { stock, setStock, modal, startAnalysis, cancel } = useAnalyze()
  const [focused, setFocused] = useState(false)

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') startAnalysis()
  }

  return (
    <>
      {/* Search bar */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center',
        padding: '12px 16px', borderRadius: 18,
        background: '#1c1c1e',
        border: `1.5px solid ${focused ? 'rgba(10,132,255,0.6)' : 'transparent'}`,
        transition: 'border-color 0.2s',
      }}>
        <span style={{ fontSize: 18, opacity: 0.5 }}>🔍</span>
        <input
          type="text"
          value={stock}
          onChange={e => setStock(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="종목명 또는 티커 입력 (예: 삼성전자, AAPL)"
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: '#fff', fontSize: 16,
          }}
        />
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

      <AnalyzeModal modal={modal} cancel={cancel} />
    </>
  )
}
