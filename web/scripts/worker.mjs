/**
 * Local analysis worker — listens for analysis_jobs in Supabase and processes them
 * with claude.exe locally.
 *
 * Usage: npm run worker
 */
import { createClient } from '@supabase/supabase-js'
import { spawn, execSync } from 'child_process'
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const STOCK_DIR   = join(__dirname, '..', '..')
const REPORTS_DIR = join(STOCK_DIR, 'reports')

/**
 * Resolve the real claude executable. The npm shims (claude.cmd/.ps1) can't be
 * spawned without shell:true, so we need the actual binary. Resolution order:
 *   1) CLAUDE_BIN env override
 *   2) <npm global root>/@anthropic-ai/claude-code/bin/claude.exe
 *   3) known install locations
 *   4) derive the bin dir from `where claude` (the shim sits next to node_modules)
 */
function resolveClaudeBin() {
  const binName = process.platform === 'win32' ? 'claude.exe' : 'claude'
  const candidates = []

  if (process.env.CLAUDE_BIN) candidates.push(process.env.CLAUDE_BIN)

  try {
    const npmRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim()
    if (npmRoot) candidates.push(join(npmRoot, '@anthropic-ai', 'claude-code', 'bin', binName))
  } catch { /* npm not on PATH */ }

  if (process.env.APPDATA) {
    candidates.push(join(process.env.APPDATA, 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', binName))
  }
  if (process.env.USERPROFILE) {
    candidates.push(join(process.env.USERPROFILE, '.local', 'bin', binName))
  }

  try {
    const cmd = process.platform === 'win32' ? 'where claude' : 'command -v claude'
    const shimDir = dirname(execSync(cmd, { encoding: 'utf-8' }).split(/\r?\n/)[0].trim())
    if (shimDir) candidates.push(join(shimDir, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', binName))
  } catch { /* claude not on PATH */ }

  const found = candidates.find(p => p && existsSync(p))
  if (!found) {
    throw new Error(
      `claude 실행 파일을 찾을 수 없습니다. 시도한 경로:\n  ${candidates.join('\n  ')}\n` +
      `해결: CLAUDE_BIN 환경 변수에 claude.exe 전체 경로를 지정하세요.`,
    )
  }
  return found
}

const CLAUDE_BIN = resolveClaudeBin()

const SUPABASE_URL = 'https://thbhrtnamqyuuelkoswi.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoYmhydG5hbXF5dXVlbGtvc3dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxODMxMjUsImV4cCI6MjA5NTc1OTEyNX0._Cy5rEURrGaX-hSAYDPRFItaVPdLUPA5yvMRWoWG5Oo'

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

function makeSlug(stock) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const safe  = stock.trim().replace(/[^a-zA-Z0-9가-힣]+/g, '_').replace(/^_|_$/g, '')
  return `${today}_${safe}`
}

async function sendEvent(jobId, payload) {
  await sb.from('job_events').insert({ job_id: jobId, payload })
}

async function saveReportToSupabase(slug, content) {
  await sb.from('reports').upsert({ slug, content }, { onConflict: 'slug' })
}

async function processJob(job) {
  const { id: jobId, stock } = job
  console.log(`\n[Worker] Processing job ${jobId}: "${stock}"`)

  // Mark running
  await sb.from('analysis_jobs')
    .update({ status: 'running', updated_at: new Date().toISOString() })
    .eq('id', jobId)

  await sendEvent(jobId, { type: 'progress', stage: 'start', message: `"${stock}" 분석 시작` })

  mkdirSync(REPORTS_DIR, { recursive: true })
  const before = new Set(readdirSync(REPORTS_DIR))

  return new Promise((resolve) => {
    const proc = spawn(
      CLAUDE_BIN,
      ['--print', '--output-format', 'stream-json', '--verbose',
       '--dangerously-skip-permissions',
       `${stock} 종목을 분석해주세요`],
      { cwd: STOCK_DIR, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    )

    const idToAgent = new Map()
    let synthesisSent = false
    let finalResult = ''
    let buf = ''

    proc.stdout.on('data', async (chunk) => {
      buf += chunk.toString()
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        let ev
        try { ev = JSON.parse(line) } catch { continue }

        if (ev.type === 'result') {
          finalResult = String(ev.result ?? '')
        }

        if (ev.type === 'tool_use') {
          const inp  = ev.tool_input ?? {}
          const hint = `${inp.description ?? ''} ${inp.prompt ?? ''}`
          const id   = String(ev.tool_use_id ?? '')

          if (/재무|financial/i.test(hint)) {
            idToAgent.set(id, 'financial')
            await sendEvent(jobId, { type: 'agent', agent: 'financial', status: 'running', label: '재무 분석 중...' })
          } else if (/뉴스|news|감성/i.test(hint)) {
            idToAgent.set(id, 'news')
            await sendEvent(jobId, { type: 'agent', agent: 'news', status: 'running', label: '뉴스 감성 분석 중...' })
          } else if (/업종|sector|리서치/i.test(hint)) {
            idToAgent.set(id, 'sector')
            await sendEvent(jobId, { type: 'agent', agent: 'sector', status: 'running', label: '업종 리서치 중...' })
          } else if (!synthesisSent && /전략|strategist|종합|invest/i.test(hint)) {
            synthesisSent = true
            await sendEvent(jobId, { type: 'progress', stage: 'synthesis', message: '최종 투자 판단 종합 중...' })
          }
        }

        if (ev.type === 'tool_result') {
          const agent = idToAgent.get(String(ev.tool_use_id ?? ''))
          if (agent) {
            const labels = { financial: '재무 분석 완료', news: '뉴스 분석 완료', sector: '업종 리서치 완료' }
            await sendEvent(jobId, { type: 'agent', agent, status: 'done', label: labels[agent] })
          }
        }

        if (ev.type === 'assistant') {
          const texts = ev.message?.content?.filter(b => b.type === 'text').map(b => b.text).join('') ?? ''
          const trimmed = texts.trim()
          if (trimmed.length > 10) {
            const snippet = trimmed.split('\n').find(l => l.trim().length > 5)?.trim().slice(0, 120) ?? ''
            if (snippet) await sendEvent(jobId, { type: 'text', text: snippet })
          }
          if (!synthesisSent && /최종.*판단|종합.*리포트|전략가|strategist/i.test(trimmed)) {
            synthesisSent = true
            await sendEvent(jobId, { type: 'progress', stage: 'synthesis', message: '최종 투자 판단 종합 중...' })
          }
        }
      }
    })

    proc.stderr.on('data', () => {})

    proc.on('close', async () => {
      const doneLabels = { financial: '재무 분석 완료', news: '뉴스 분석 완료', sector: '업종 리서치 완료' }

      // 1) Check if orchestrator wrote the file itself
      const after   = readdirSync(REPORTS_DIR).filter(f => f.endsWith('.md'))
      const newFile = after.find(f => !before.has(f))

      if (newFile) {
        const slug    = newFile.replace('.md', '')
        const content = readFileSync(join(REPORTS_DIR, newFile), 'utf-8')
        for (const [, agent] of idToAgent) {
          await sendEvent(jobId, { type: 'agent', agent, status: 'done', label: doneLabels[agent] })
        }
        await saveReportToSupabase(slug, content)
        await sendEvent(jobId, { type: 'done', slug })
        await sb.from('analysis_jobs')
          .update({ status: 'done', slug, updated_at: new Date().toISOString() })
          .eq('id', jobId)
        console.log(`[Worker] Done: ${slug}`)
        resolve()
        return
      }

      // 2) Fallback: save the result text ourselves
      if (finalResult.trim()) {
        const slug     = makeSlug(stock)
        const filepath = join(REPORTS_DIR, `${slug}.md`)
        writeFileSync(filepath, finalResult, 'utf-8')
        for (const [, agent] of idToAgent) {
          await sendEvent(jobId, { type: 'agent', agent, status: 'done', label: doneLabels[agent] })
        }
        await saveReportToSupabase(slug, finalResult)
        await sendEvent(jobId, { type: 'done', slug })
        await sb.from('analysis_jobs')
          .update({ status: 'done', slug, updated_at: new Date().toISOString() })
          .eq('id', jobId)
        console.log(`[Worker] Done (fallback): ${slug}`)
        resolve()
        return
      }

      // Error
      await sendEvent(jobId, { type: 'error', message: '리포트 생성 실패. Claude Code 인증 상태를 확인하세요.' })
      await sb.from('analysis_jobs')
        .update({ status: 'error', updated_at: new Date().toISOString() })
        .eq('id', jobId)
      console.error(`[Worker] Error: no report generated for job ${jobId}`)
      resolve()
    })

    proc.on('error', async (err) => {
      await sendEvent(jobId, { type: 'error', message: `실행 오류: ${err.message}` })
      await sb.from('analysis_jobs')
        .update({ status: 'error', updated_at: new Date().toISOString() })
        .eq('id', jobId)
      console.error(`[Worker] Spawn error:`, err.message)
      resolve()
    })
  })
}

async function recoverStaleJobs() {
  // Reset jobs stuck in 'running' for more than 15 minutes
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  await sb.from('analysis_jobs')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('status', 'running')
    .lt('updated_at', cutoff)
}

let busy = false

async function tick() {
  if (busy) return
  try {
    await recoverStaleJobs()
    const { data: jobs } = await sb
      .from('analysis_jobs')
      .select('id, stock')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)

    if (jobs && jobs.length > 0) {
      busy = true
      await processJob(jobs[0])
      busy = false
    }
  } catch (e) {
    busy = false
    console.error('[Worker] Tick error:', e.message)
  }
}

console.log('🚀 Worker started. Listening for analysis jobs...')
console.log('   Supabase:', SUPABASE_URL)
console.log('   Claude:  ', CLAUDE_BIN)
console.log('   Press Ctrl+C to stop.\n')

// Poll every 2 seconds
setInterval(tick, 2000)
tick() // immediate first check
