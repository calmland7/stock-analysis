import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { auth } from '@/auth'
import { addSlugToHistory } from '@/lib/history'

const CLAUDE_BIN  = 'C:\\Users\\20110079\\.local\\bin\\claude.exe'
const STOCK_DIR   = path.resolve(process.cwd(), '..')
const REPORTS_DIR = path.join(STOCK_DIR, 'reports')

function makeSlug(stock: string): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const safe  = stock.trim().replace(/[^a-zA-Z0-9가-힣]+/g, '_').replace(/^_|_$/g, '')
  return `${today}_${safe}`
}

export async function POST(req: Request) {
  const { stock } = (await req.json()) as { stock: string }
  if (!stock?.trim()) {
    return new Response(JSON.stringify({ error: 'stock is required' }), { status: 400 })
  }

  const session = await auth()
  const userEmail = session?.user?.email ?? null

  const enc = new TextEncoder()

  const stream = new ReadableStream({
    start(ctrl) {
      const send = (data: object) =>
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`))

      fs.mkdirSync(REPORTS_DIR, { recursive: true })
      const before = new Set(fs.readdirSync(REPORTS_DIR))

      send({ type: 'progress', stage: 'start', message: `"${stock}" 분석 시작` })

      const proc = spawn(
        CLAUDE_BIN,
        ['--print', '--output-format', 'stream-json', '--verbose',
         '--dangerously-skip-permissions',
         `${stock} 종목을 분석해주세요`],
        { cwd: STOCK_DIR, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
      )

      const idToAgent = new Map<string, 'financial' | 'news' | 'sector'>()
      let synthesisSent = false
      let finalResult   = ''   // ← capture the `result` event text

      let buf = ''
      proc.stdout.on('data', (chunk: Buffer) => {
        buf += chunk.toString()
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          let ev: Record<string, unknown>
          try { ev = JSON.parse(line) } catch { continue }

          // ── Capture final result text ─────────────────────────────────────
          if (ev.type === 'result') {
            finalResult = String(ev.result ?? '')
          }

          // ── Detect agent launch ───────────────────────────────────────────
          if (ev.type === 'tool_use') {
            const inp  = ev.tool_input as Record<string, unknown>
            const hint = `${inp?.description ?? ''} ${inp?.prompt ?? ''}`
            const id   = String(ev.tool_use_id ?? '')

            if (/재무|financial/i.test(hint)) {
              idToAgent.set(id, 'financial')
              send({ type: 'agent', agent: 'financial', status: 'running', label: '재무 분석 중...' })
            } else if (/뉴스|news|감성/i.test(hint)) {
              idToAgent.set(id, 'news')
              send({ type: 'agent', agent: 'news', status: 'running', label: '뉴스 감성 분석 중...' })
            } else if (/업종|sector|리서치/i.test(hint)) {
              idToAgent.set(id, 'sector')
              send({ type: 'agent', agent: 'sector', status: 'running', label: '업종 리서치 중...' })
            } else if (!synthesisSent && /전략|strategist|종합|invest/i.test(hint)) {
              synthesisSent = true
              send({ type: 'progress', stage: 'synthesis', message: '최종 투자 판단 종합 중...' })
            }
          }

          // ── Agent completion ──────────────────────────────────────────────
          if (ev.type === 'tool_result') {
            const agent = idToAgent.get(String(ev.tool_use_id ?? ''))
            if (agent) {
              const labels = { financial: '재무 분석 완료', news: '뉴스 분석 완료', sector: '업종 리서치 완료' }
              send({ type: 'agent', agent, status: 'done', label: labels[agent] })
            }
          }

          // ── Detect synthesis from assistant text ──────────────────────────
          if (ev.type === 'assistant' && !synthesisSent) {
            const texts = (ev.message as { content?: { type: string; text: string }[] })
              ?.content?.filter(b => b.type === 'text').map(b => b.text).join('') ?? ''
            if (/최종.*판단|종합.*리포트|전략가|strategist/i.test(texts)) {
              synthesisSent = true
              send({ type: 'progress', stage: 'synthesis', message: '최종 투자 판단 종합 중...' })
            }
          }
        }
      })

      proc.stderr.on('data', () => {})

      proc.on('close', () => {
        // 1) Check if orchestrator wrote the file itself
        const after   = fs.readdirSync(REPORTS_DIR).filter(f => f.endsWith('.md'))
        const newFile = after.find(f => !before.has(f))

        if (newFile) {
          const slug = newFile.replace('.md', '')
          for (const [, agent] of idToAgent) {
            const labels = { financial: '재무 분석 완료', news: '뉴스 분석 완료', sector: '업종 리서치 완료' }
            send({ type: 'agent', agent, status: 'done', label: labels[agent] })
          }
          if (userEmail) addSlugToHistory(userEmail, slug)
          send({ type: 'done', slug })
          ctrl.close()
          return
        }

        // 2) Fallback: save the `result` text ourselves
        if (finalResult.trim()) {
          const slug     = makeSlug(stock)
          const filepath = path.join(REPORTS_DIR, `${slug}.md`)
          fs.writeFileSync(filepath, finalResult, 'utf-8')

          for (const [, agent] of idToAgent) {
            const labels = { financial: '재무 분석 완료', news: '뉴스 분석 완료', sector: '업종 리서치 완료' }
            send({ type: 'agent', agent, status: 'done', label: labels[agent] })
          }
          if (userEmail) addSlugToHistory(userEmail, slug)
          send({ type: 'done', slug })
          ctrl.close()
          return
        }

        send({ type: 'error', message: '리포트 생성 실패. Claude Code 인증 상태를 확인하세요.' })
        ctrl.close()
      })

      proc.on('error', err => {
        send({ type: 'error', message: `실행 오류: ${err.message}` })
        ctrl.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
