'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef } from 'react'

interface AgentState {
  status: 'idle' | 'running' | 'done'
  label: string
}

interface ModalState {
  open: boolean
  stage: string
  message: string
  agents: { financial: AgentState; news: AgentState; sector: AgentState }
  error: string
}

const INIT_AGENTS = {
  financial: { status: 'idle' as const, label: '재무 분석' },
  news:      { status: 'idle' as const, label: '뉴스 감성 분석' },
  sector:    { status: 'idle' as const, label: '업종 리서치' },
}

export function useAnalyze() {
  const router = useRouter()
  const [stock, setStock] = useState('')
  const [modal, setModal] = useState<ModalState>({
    open: false, stage: '', message: '', agents: INIT_AGENTS, error: '',
  })
  const abortRef = useRef<AbortController | null>(null)

  const startAnalysis = async () => {
    if (!stock.trim()) return
    abortRef.current = new AbortController()

    setModal({ open: true, stage: 'start', message: '분석 준비 중...', agents: INIT_AGENTS, error: '' })

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: stock.trim() }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const err = await res.json()
        setModal(m => ({ ...m, error: err.error ?? '오류가 발생했습니다.' }))
        return
      }

      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let lineBuf = ''
      let gotDone = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // stream:true preserves multi-byte UTF-8 sequences across chunk boundaries
        lineBuf += dec.decode(value, { stream: true })
        const lines = lineBuf.split('\n')
        lineBuf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const ev = JSON.parse(line.slice(6))

            if (ev.type === 'progress') {
              setModal(m => ({ ...m, stage: ev.stage, message: ev.message }))
            } else if (ev.type === 'agent') {
              setModal(m => ({
                ...m,
                agents: {
                  ...m.agents,
                  [ev.agent]: { status: ev.status, label: ev.label },
                },
              }))
            } else if (ev.type === 'done') {
              gotDone = true
              setModal(m => ({ ...m, stage: 'done', message: '분석 완료!' }))
              setTimeout(() => {
                setModal(m => ({ ...m, open: false }))
                setStock('')
                router.push(`/reports/${ev.slug}`)
                router.refresh()
              }, 800)
            } else if (ev.type === 'error') {
              setModal(m => ({ ...m, error: ev.message }))
            }
          } catch {}
        }
      }

      // Stream closed without a done event (SSE timeout or connection drop).
      // The analysis is still running in the background — redirect home so the
      // user can see the report once it appears in the list.
      if (!gotDone) {
        setModal(m => ({
          ...m,
          stage: 'background',
          message: '분석이 백그라운드에서 진행 중입니다.\n잠시 후 홈에서 결과를 확인하세요.',
        }))
        setTimeout(() => {
          setModal(m => ({ ...m, open: false }))
          router.refresh()
          router.push('/')
        }, 3000)
      }
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        setModal(m => ({ ...m, error: String(e) }))
      }
    }
  }

  const cancel = () => {
    abortRef.current?.abort()
    setModal(m => ({ ...m, open: false }))
  }

  return { stock, setStock, modal, startAnalysis, cancel }
}

export default function AnalyzeModal({
  modal,
  cancel,
}: {
  modal: ReturnType<typeof useAnalyze>['modal']
  cancel: () => void
}) {
  if (!modal.open) return null

  const agents = [
    { key: 'financial', icon: '📊', label: modal.agents.financial.label },
    { key: 'news',      icon: '📰', label: modal.agents.news.label },
    { key: 'sector',    icon: '🔭', label: modal.agents.sector.label },
  ] as const

  const allDone = agents.every(a => modal.agents[a.key].status === 'done')

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: 430,
        background: '#1c1c1e',
        borderRadius: '24px 24px 0 0',
        padding: '8px 0 40px',
        animation: 'slideUp 0.3s ease',
      }}>
        {/* Handle bar */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#3a3a3c', margin: '12px auto 24px' }} />

        <div style={{ padding: '0 24px' }}>
          {/* Title */}
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
            {modal.stage === 'done' ? '✅ 분석 완료!' : modal.stage === 'background' ? '⏳ 백그라운드 분석 중' : '🔍 종목 분석 중'}
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(235,235,245,0.5)', marginBottom: 24, whiteSpace: 'pre-line' }}>
            {modal.message}
          </p>

          {/* Agent status cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {agents.map(a => {
              const st = modal.agents[a.key].status
              const label = modal.agents[a.key].label
              return (
                <div key={a.key} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px', borderRadius: 14,
                  background: '#2c2c2e',
                  border: `1px solid ${st === 'running' ? 'rgba(10,132,255,0.5)' : st === 'done' ? 'rgba(48,209,88,0.3)' : 'transparent'}`,
                  transition: 'border-color 0.3s',
                }}>
                  <span style={{ fontSize: 20 }}>{a.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                      {label}
                    </p>
                  </div>
                  <StatusDot status={st} />
                </div>
              )
            })}
          </div>

          {/* Synthesis row */}
          {(modal.stage === 'synthesis' || modal.stage === 'done') && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 14,
              background: '#2c2c2e', marginBottom: 24,
              border: `1px solid ${modal.stage === 'done' ? 'rgba(48,209,88,0.3)' : 'rgba(191,90,242,0.4)'}`,
            }}>
              <span style={{ fontSize: 20 }}>⚡</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600 }}>최종 투자 판단 종합</p>
              </div>
              <StatusDot status={modal.stage === 'done' ? 'done' : 'running'} />
            </div>
          )}

          {/* Error */}
          {modal.error && (
            <div style={{
              padding: '12px 16px', borderRadius: 12, marginBottom: 16,
              background: 'rgba(255,69,58,0.15)', border: '1px solid rgba(255,69,58,0.3)',
              fontSize: 13, color: '#ff453a',
            }}>
              {modal.error}
            </div>
          )}

          {/* Cancel button */}
          {modal.stage !== 'done' && (
            <button onClick={cancel} style={{
              width: '100%', padding: '14px', borderRadius: 14,
              background: '#2c2c2e', border: 'none', color: 'rgba(235,235,245,0.5)',
              fontSize: 16, fontWeight: 600, cursor: 'pointer',
            }}>
              취소
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function StatusDot({ status }: { status: 'idle' | 'running' | 'done' }) {
  if (status === 'done') return <span style={{ color: '#30d158', fontSize: 18 }}>✓</span>
  if (status === 'running') return (
    <div style={{
      width: 18, height: 18, borderRadius: 9,
      border: '2px solid rgba(10,132,255,0.3)',
      borderTopColor: '#0a84ff',
      animation: 'spin 0.8s linear infinite',
    }} />
  )
  return <div style={{ width: 8, height: 8, borderRadius: 4, background: '#3a3a3c' }} />
}
