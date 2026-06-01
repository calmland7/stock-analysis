'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

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
  log: string[]
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
    open: false, stage: '', message: '', agents: INIT_AGENTS, error: '', log: [],
  })
  const abortRef = useRef<AbortController | null>(null)

  // Process a single SSE event (shared by both streaming and queued modes)
  const handleEvent = (ev: Record<string, unknown>, gotDoneRef: { v: boolean }) => {
    if (ev.type === 'progress') {
      setModal(m => ({ ...m, stage: ev.stage as string, message: ev.message as string }))
    } else if (ev.type === 'agent') {
      setModal(m => ({
        ...m,
        agents: { ...m.agents, [ev.agent as string]: { status: ev.status as 'idle' | 'running' | 'done', label: ev.label as string } },
      }))
    } else if (ev.type === 'text') {
      setModal(m => ({ ...m, log: [...m.log.slice(-49), ev.text as string] }))
    } else if (ev.type === 'done') {
      gotDoneRef.v = true
      setModal(m => ({ ...m, stage: 'done', message: '분석 완료!' }))
      setTimeout(() => {
        setModal(m => ({ ...m, open: false }))
        setStock('')
        router.push(`/reports/${ev.slug}`)
        router.refresh()
      }, 1200)
    } else if (ev.type === 'error') {
      setModal(m => ({ ...m, error: ev.message as string }))
    }
  }

  const startAnalysis = async () => {
    if (!stock.trim()) return
    abortRef.current = new AbortController()

    setModal({ open: true, stage: 'start', message: '분석 준비 중...', agents: INIT_AGENTS, error: '', log: [] })

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

      // ── Queued mode (Vercel) ─────────────────────────────────────────
      const contentType = res.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const json = await res.json()
        if (json.mode === 'queued' && json.jobId) {
          await runQueuedMode(json.jobId)
          return
        }
        setModal(m => ({ ...m, error: json.error ?? '알 수 없는 오류' }))
        return
      }

      // ── Direct SSE mode (local) ──────────────────────────────────────
      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let lineBuf = ''
      const gotDoneRef = { v: false }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        lineBuf += dec.decode(value, { stream: true })
        const lines = lineBuf.split('\n')
        lineBuf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try { handleEvent(JSON.parse(line.slice(6)), gotDoneRef) } catch {}
        }
      }

      if (!gotDoneRef.v) {
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

  const runQueuedMode = async (jobId: string) => {
    setModal(m => ({ ...m, message: '로컬 워커에 분석 요청 전송됨...' }))
    let since = 0
    let gotDoneRef = { v: false }
    let idleSeconds = 0
    const WORKER_TIMEOUT = 30  // seconds before showing warning

    const poll = async () => {
      if (gotDoneRef.v || abortRef.current?.signal.aborted) return

      try {
        const r = await fetch(`/api/analyze/events?jobId=${jobId}&since=${since}`)
        if (!r.ok) { setModal(m => ({ ...m, error: '이벤트 조회 실패' })); return }

        const text = await r.text()
        const lines = text.split('\n').filter(l => l.startsWith('data: '))
        let hasRealEvent = false

        for (const line of lines) {
          try {
            const ev = JSON.parse(line.slice(6))
            if (ev.type === 'heartbeat') continue
            hasRealEvent = true
            if (ev._eid) since = Math.max(since, ev._eid)
            handleEvent(ev, gotDoneRef)
          } catch {}
        }

        if (hasRealEvent) {
          idleSeconds = 0
          // Show worker-connected message once
          setModal(m => m.message === '로컬 워커에 분석 요청 전송됨...'
            ? { ...m, message: '로컬에서 분석 중...' }
            : m)
        } else {
          idleSeconds += 2
          if (idleSeconds >= WORKER_TIMEOUT && !gotDoneRef.v) {
            setModal(m => ({
              ...m,
              message: '⚠️ 로컬 워커가 응답하지 않습니다.\n로컬 PC에서 npm run worker를 실행해주세요.',
            }))
          }
        }

        if (!gotDoneRef.v) setTimeout(poll, 2000)
      } catch (e: unknown) {
        if ((e as Error).name !== 'AbortError') setTimeout(poll, 3000)
      }
    }

    setTimeout(poll, 1000)
  }

  const cancel = () => {
    abortRef.current?.abort()
    setModal(m => ({ ...m, open: false }))
  }

  return { stock, setStock, modal, startAnalysis, cancel }
}

// ── Main component ──────────────────────────────────────────────────────

export default function AnalyzeModal({
  modal,
  cancel,
}: {
  modal: ReturnType<typeof useAnalyze>['modal']
  cancel: () => void
}) {
  const logRef = useRef<HTMLDivElement>(null)

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [modal.log])

  if (!modal.open) return null

  const agents: { key: 'financial' | 'news' | 'sector'; icon: string; title: string }[] = [
    { key: 'financial', icon: '📊', title: '재무 분석가' },
    { key: 'news',      icon: '📰', title: '뉴스 감성 분석가' },
    { key: 'sector',    icon: '🔭', title: '업종 리서처' },
  ]

  const isDone       = modal.stage === 'done'
  const isSynthesis  = modal.stage === 'synthesis' || isDone
  const isBackground = modal.stage === 'background'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#000',
      display: 'flex', flexDirection: 'column',
      maxWidth: 430, margin: '0 auto',
    }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{
        padding: '56px 24px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <p style={{ fontSize: 12, color: 'rgba(235,235,245,0.4)', marginBottom: 4, letterSpacing: 1 }}>
          멀티에이전트 분석
        </p>
        <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>
          {isDone ? '✅ 분석 완료' : isBackground ? '⏳ 분석 진행 중' : '🔍 분석 실행 중'}
        </h2>
        {modal.message && (
          <p style={{ fontSize: 13, color: 'rgba(235,235,245,0.5)', marginTop: 4, whiteSpace: 'pre-line' }}>
            {modal.message}
          </p>
        )}
      </div>

      {/* ── Scrollable body ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

        {/* Agent pipeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 20 }}>
          {agents.map((a, i) => {
            const st = modal.agents[a.key].status
            const label = modal.agents[a.key].label
            return (
              <div key={a.key}>
                <AgentRow icon={a.icon} title={a.title} label={label} status={st} />
                {i < agents.length - 1 && (
                  <div style={{
                    width: 2, height: 12, marginLeft: 29,
                    background: 'rgba(255,255,255,0.08)',
                  }} />
                )}
              </div>
            )
          })}

          {/* Connector to synthesis */}
          <div style={{ width: 2, height: 12, marginLeft: 29, background: 'rgba(255,255,255,0.08)' }} />

          {/* Synthesis row */}
          <AgentRow
            icon="⚡"
            title="공격적 투자 전략가"
            label={isDone ? '최종 판단 완료' : isSynthesis ? '최종 투자 판단 종합 중...' : '대기 중'}
            status={isDone ? 'done' : isSynthesis ? 'running' : 'idle'}
            accent
          />
        </div>

        {/* Live log */}
        {modal.log.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{
              fontSize: 11, fontWeight: 600, letterSpacing: 1,
              color: 'rgba(235,235,245,0.3)', marginBottom: 8,
              textTransform: 'uppercase',
            }}>실시간 로그</p>
            <div
              ref={logRef}
              style={{
                background: '#0a0a0a',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14, padding: '12px 14px',
                maxHeight: 200, overflow: 'auto',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}
            >
              {modal.log.map((entry, i) => (
                <p key={i} style={{
                  fontSize: 12, color: i === modal.log.length - 1
                    ? 'rgba(235,235,245,0.85)'
                    : 'rgba(235,235,245,0.35)',
                  lineHeight: 1.5, margin: 0,
                  fontFamily: 'monospace',
                  animation: i === modal.log.length - 1 ? 'fadeIn 0.3s ease' : undefined,
                }}>
                  <span style={{ color: 'rgba(10,132,255,0.6)', marginRight: 6 }}>›</span>
                  {entry}
                </p>
              ))}
            </div>
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
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      {!isDone && (
        <div style={{ padding: '16px 24px 40px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={cancel} style={{
            width: '100%', padding: '14px', borderRadius: 14,
            background: '#1c1c1e', border: 'none',
            color: 'rgba(235,235,245,0.5)',
            fontSize: 16, fontWeight: 600, cursor: 'pointer',
          }}>
            취소
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  )
}

// ── Agent row ───────────────────────────────────────────────────────────

function AgentRow({
  icon, title, label, status, accent = false,
}: {
  icon: string
  title: string
  label: string
  status: 'idle' | 'running' | 'done'
  accent?: boolean
}) {
  const isRunning = status === 'running'
  const isDone    = status === 'done'
  const isIdle    = status === 'idle'

  const borderColor = isDone
    ? 'rgba(48,209,88,0.35)'
    : isRunning
      ? accent ? 'rgba(191,90,242,0.5)' : 'rgba(10,132,255,0.5)'
      : 'rgba(255,255,255,0.06)'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '13px 16px', borderRadius: 16,
      background: isRunning ? 'rgba(10,132,255,0.05)' : isDone ? 'rgba(48,209,88,0.03)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${borderColor}`,
      transition: 'all 0.3s ease',
    }}>
      {/* Icon bubble */}
      <div style={{
        width: 38, height: 38, borderRadius: 12, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18,
        background: isDone
          ? 'rgba(48,209,88,0.15)'
          : isRunning
            ? accent ? 'rgba(191,90,242,0.15)' : 'rgba(10,132,255,0.15)'
            : 'rgba(255,255,255,0.05)',
        animation: isRunning ? 'pulse 1.8s ease-in-out infinite' : undefined,
      }}>
        {icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 14, fontWeight: 600, color: isIdle ? 'rgba(235,235,245,0.4)' : '#fff',
          marginBottom: 2,
        }}>{title}</p>
        <p style={{
          fontSize: 12, color: isDone ? '#30d158' : isRunning ? (accent ? '#bf5af2' : '#0a84ff') : 'rgba(235,235,245,0.3)',
          animation: isRunning ? 'pulse 1.8s ease-in-out infinite' : undefined,
        }}>{label}</p>
      </div>

      {/* Status indicator */}
      <StatusIcon status={status} accent={accent} />
    </div>
  )
}

function StatusIcon({ status, accent }: { status: 'idle' | 'running' | 'done'; accent?: boolean }) {
  if (status === 'done') {
    return (
      <div style={{
        width: 24, height: 24, borderRadius: 12,
        background: 'rgba(48,209,88,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, color: '#30d158',
      }}>✓</div>
    )
  }
  if (status === 'running') {
    const color = accent ? '#bf5af2' : '#0a84ff'
    return (
      <div style={{
        width: 20, height: 20, borderRadius: 10, flexShrink: 0,
        border: `2.5px solid rgba(255,255,255,0.1)`,
        borderTopColor: color,
        animation: 'spin 0.8s linear infinite',
      }} />
    )
  }
  return <div style={{ width: 8, height: 8, borderRadius: 4, background: '#3a3a3c', flexShrink: 0 }} />
}
