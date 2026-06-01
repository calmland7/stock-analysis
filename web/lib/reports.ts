import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const USE_SUPABASE = !!(supabaseUrl && supabaseKey)

function getSupabase() {
  return createClient(supabaseUrl!, supabaseKey!)
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface ReportMeta {
  slug: string
  stockName: string
  ticker: string
  date: string
  verdictFull: string
  verdictLabel: string
  verdictColor: string
  financialGrade: string
  newsSentiment: string
  sectorOutlook: string
}

export interface Report extends ReportMeta {
  content: string
}

// ── Pure parsing helpers ───────────────────────────────────────────────────

function verdictStyle(raw: string): { label: string; color: string } {
  const n = raw.replace(/\s/g, '')
  if (n.includes('적극매수')) return { label: '적극매수', color: 'green' }
  if (n.includes('분할매수')) return { label: '분할매수', color: 'orange' }
  if (n.includes('관망'))    return { label: '관망',    color: 'gray' }
  if (n.includes('비중축소')) return { label: '비중축소', color: 'yellow' }
  if (n.includes('매도'))    return { label: '매도',    color: 'red' }
  return { label: raw, color: 'gray' }
}

function parseFilename(filename: string): { date: string; rawName: string } {
  const m = filename.match(/^(\d{4})(\d{2})(\d{2})_(.+)\.md$/)
  if (!m) return { date: '', rawName: filename.replace('.md', '') }
  return { date: `${m[1]}-${m[2]}-${m[3]}`, rawName: m[4].replace(/_/g, ' ') }
}

function parseContent(content: string) {
  const fmtA = content.match(/# 🎯 최종 투자 판단: (.+)/)
  const fmtB = content.match(/\*\*기업명\*\*[:：]\s*(.+)/)
  const h1   = content.match(/^# (.+)/m)

  const stockFull = fmtA ? fmtA[1].trim()
    : fmtB ? fmtB[1].trim()
    : h1   ? h1[1].replace(/투자\s*분석.*/i, '').replace(/리포트.*/i, '').trim()
    : ''

  const tickerMatch = stockFull.match(/[:(]\s*(?:TSX[^:]*:\s*|KRX:\s*)?([A-Z]{2,6})\b/)
                   ?? content.match(/\((?:TSX[^:]*:|KRX:|OTC:)\s*([A-Z0-9]{2,8})\b/)
  const ticker    = tickerMatch ? tickerMatch[1] : ''
  const stockName = stockFull.split(/[(\[]/)[0].trim() || stockFull

  const verdictRaw =
    content.match(/\*\*판정[:：]\s*(.+?)\*\*/)        ?.[1] ??
    content.match(/최종\s*판정[:：]\s*\*\*(.+?)\*\*/)  ?.[1] ??
    content.match(/최종\s*판정[:：]\s*(.+)/)           ?.[1] ??
    content.match(/판정[:：]\s*(.+)/)                   ?.[1] ??
    ''
  const verdictFull = verdictRaw.trim()
  const { label: verdictLabel, color: verdictColor } = verdictStyle(verdictFull)

  const financialGrade = (() => {
    const m = content.match(/등급[:\s]+([A-F][+\-]?)\s*[\(（]/)
           ?? content.match(/재무\s*건전성\s*등급[:\s]+([A-F][+\-]?)/)
           ?? content.match(/\*\*등급\*\*[:\s]+([A-F][+\-]?)/)
    return m ? m[1] : '–'
  })()

  const newsMatch = content.match(/뉴스\s*감성\s*분석가\s*의견\s*[—–-]+\s*(.+)/)
                 ?? content.match(/뉴스\s*심리[:\s]+(.+)/)
                 ?? content.match(/\*\*뉴스\s*감성\*\*[:\s]+(.+)/)
  const newsSentiment = newsMatch ? newsMatch[1].trim()
    : content.includes('긍정') ? '긍정 📈'
    : content.includes('부정') ? '부정 📉' : '–'

  const sectorMatch = content.match(/업종\s*리서처\s*의견\s*[—–-]+\s*(.+)/)
                   ?? content.match(/업종\s*전망[:\s]+(.+)/)
                   ?? content.match(/\*\*업종\*\*[:\s]+(.+)/)
  const sectorSentiment = sectorMatch ? sectorMatch[1].trim()
    : content.includes('중립') ? '중립 ⚖️'
    : content.includes('긍정') ? '긍정 📈'
    : content.includes('부정') ? '부정 📉' : '–'

  return { stockName, ticker, verdictFull, verdictLabel, verdictColor, financialGrade, newsSentiment, sectorOutlook: sectorSentiment }
}

function metaFromRow(row: { slug: string; content: string; created_at: string }): ReportMeta {
  const { date } = parseFilename(`${row.slug}.md`)
  const dateStr  = date || row.created_at.slice(0, 10)
  return { slug: row.slug, date: dateStr, ...parseContent(row.content) }
}

// ── Public API (async) ─────────────────────────────────────────────────────

export async function getAllReports(): Promise<ReportMeta[]> {
  if (USE_SUPABASE) {
    const { data, error } = await getSupabase()
      .from('reports')
      .select('slug, content, created_at')
      .order('created_at', { ascending: false })
    if (error || !data) return []
    return data.map(metaFromRow)
  }
  return getReportsFromFS()
}

export async function getReport(slug: string): Promise<Report | null> {
  if (USE_SUPABASE) {
    const { data, error } = await getSupabase()
      .from('reports')
      .select('slug, content, created_at')
      .eq('slug', slug)
      .single()
    if (error || !data) return null
    const meta    = metaFromRow(data)
    const firstSep = data.content.indexOf('\n---')
    const content  = firstSep !== -1 ? data.content.slice(firstSep + 5).trimStart() : data.content
    return { ...meta, content }
  }
  return getReportFromFS(slug)
}

export async function saveReport(slug: string, content: string): Promise<void> {
  if (USE_SUPABASE) {
    await getSupabase()
      .from('reports')
      .upsert({ slug, content }, { onConflict: 'slug' })
  }
}

// ── Filesystem fallback (local dev without Supabase) ──────────────────────

function getReportsFromFS(): ReportMeta[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs   = require('fs') as typeof import('fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path')
    const dir  = path.join(process.cwd(), '..', 'reports')
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir)
      .filter((f: string) => f.endsWith('.md'))
      .map((filename: string) => {
        const content = fs.readFileSync(path.join(dir, filename), 'utf-8')
        const { date } = parseFilename(filename)
        return { slug: filename.replace('.md', ''), date, ...parseContent(content) }
      })
      .sort((a: ReportMeta, b: ReportMeta) => b.date.localeCompare(a.date))
  } catch { return [] }
}

function getReportFromFS(slug: string): Report | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs   = require('fs') as typeof import('fs')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path')
    const filepath = path.join(process.cwd(), '..', 'reports', `${slug}.md`)
    if (!fs.existsSync(filepath)) return null
    const raw      = fs.readFileSync(filepath, 'utf-8')
    const { date } = parseFilename(`${slug}.md`)
    const firstSep = raw.indexOf('\n---')
    const content  = firstSep !== -1 ? raw.slice(firstSep + 5).trimStart() : raw
    return { slug, date, content, ...parseContent(raw) }
  } catch { return null }
}
