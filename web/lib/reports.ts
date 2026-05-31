import fs from 'fs'
import path from 'path'

const REPORTS_DIR = path.join(process.cwd(), '..', 'reports')

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

function verdictStyle(raw: string): { label: string; color: string } {
  const n = raw.replace(/\s/g, '')
  if (n.includes('적극매수')) return { label: '적극매수', color: 'green' }
  if (n.includes('분할매수')) return { label: '분할매수', color: 'orange' }
  if (n.includes('관망')) return { label: '관망', color: 'gray' }
  if (n.includes('비중축소')) return { label: '비중축소', color: 'yellow' }
  if (n.includes('매도')) return { label: '매도', color: 'red' }
  return { label: raw, color: 'gray' }
}

function parseFilename(filename: string): { date: string; rawName: string } {
  const m = filename.match(/^(\d{4})(\d{2})(\d{2})_(.+)\.md$/)
  if (!m) return { date: '', rawName: filename.replace('.md', '') }
  return { date: `${m[1]}-${m[2]}-${m[3]}`, rawName: m[4].replace(/_/g, ' ') }
}

function parseContent(content: string) {
  // ── Stock name ─────────────────────────────────────────────────────────
  // Format A (SCZ-style):  # 🎯 최종 투자 판단: Santacruz Silver Mining Ltd (TSX-V: SCZ)
  // Format B (Samsung):    # 삼성전자(005930) 투자 분석 종합 리포트
  //                        **기업명**: 삼성전자 (KRX: 005930)
  const fmtA = content.match(/# 🎯 최종 투자 판단: (.+)/)
  const fmtB = content.match(/\*\*기업명\*\*[:：]\s*(.+)/)
  const h1   = content.match(/^# (.+)/m)

  const stockFull = fmtA ? fmtA[1].trim()
    : fmtB ? fmtB[1].trim()
    : h1   ? h1[1].replace(/투자\s*분석.*/i, '').replace(/리포트.*/i, '').trim()
    : ''

  // Ticker — uppercase 2-6 letters after ":" or inside "()"
  const tickerMatch = stockFull.match(/[:(]\s*(?:TSX[^:]*:\s*|KRX:\s*)?([A-Z]{2,6})\b/)
                   ?? content.match(/\((?:TSX[^:]*:|KRX:|OTC:)\s*([A-Z0-9]{2,8})\b/)
  const ticker    = tickerMatch ? tickerMatch[1] : ''
  const stockName = stockFull.split(/[(\[]/)[0].trim() || stockFull

  // ── Verdict ────────────────────────────────────────────────────────────
  // Format A: **판정: 🟠 분할 매수 (Accumulate)**
  // Format B: ### 🎯 최종 판정: **🟠 분할 매수 (Accumulate)**
  // Format C: **최종 판정**: 🟠 분할 매수
  const verdictRaw =
    content.match(/\*\*판정[:：]\s*(.+?)\*\*/)        ?.[1] ??
    content.match(/최종\s*판정[:：]\s*\*\*(.+?)\*\*/)  ?.[1] ??
    content.match(/최종\s*판정[:：]\s*(.+)/)           ?.[1] ??
    content.match(/판정[:：]\s*(.+)/)                   ?.[1] ??
    ''
  const verdictFull = verdictRaw.trim()
  const { label: verdictLabel, color: verdictColor } = verdictStyle(verdictFull)

  // ── Financial grade ────────────────────────────────────────────────────
  const financialGrade = (() => {
    const m = content.match(/등급[:\s]+([A-F][+\-]?)\s*[\(（]/)
           ?? content.match(/재무\s*건전성\s*등급[:\s]+([A-F][+\-]?)/)
           ?? content.match(/\*\*등급\*\*[:\s]+([A-F][+\-]?)/)
    return m ? m[1] : '–'
  })()

  // ── News sentiment ─────────────────────────────────────────────────────
  const newsMatch = content.match(/뉴스\s*감성\s*분석가\s*의견\s*[—–-]+\s*(.+)/)
                 ?? content.match(/뉴스\s*심리[:\s]+(.+)/)
                 ?? content.match(/\*\*뉴스\s*감성\*\*[:\s]+(.+)/)
  const newsSentiment = newsMatch ? newsMatch[1].trim()
    : content.includes('긍정') ? '긍정 📈'
    : content.includes('부정') ? '부정 📉' : '–'

  // ── Sector outlook ─────────────────────────────────────────────────────
  const sectorMatch = content.match(/업종\s*리서처\s*의견\s*[—–-]+\s*(.+)/)
                   ?? content.match(/업종\s*전망[:\s]+(.+)/)
                   ?? content.match(/\*\*업종\*\*[:\s]+(.+)/)
  const sectorSentiment = sectorMatch ? sectorMatch[1].trim()
    : content.includes('중립') ? '중립 ⚖️'
    : content.includes('긍정') ? '긍정 📈'
    : content.includes('부정') ? '부정 📉' : '–'

  return { stockName, ticker, verdictFull, verdictLabel, verdictColor, financialGrade, newsSentiment, sectorOutlook: sectorSentiment }
}

export function getAllReports(): ReportMeta[] {
  if (!fs.existsSync(REPORTS_DIR)) return []

  return fs.readdirSync(REPORTS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(filename => {
      const content = fs.readFileSync(path.join(REPORTS_DIR, filename), 'utf-8')
      const { date } = parseFilename(filename)
      const parsed = parseContent(content)
      return {
        slug: filename.replace('.md', ''),
        date,
        ...parsed,
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function getReport(slug: string): Report | null {
  const filepath = path.join(REPORTS_DIR, `${slug}.md`)
  if (!fs.existsSync(filepath)) return null

  const raw = fs.readFileSync(filepath, 'utf-8')
  const { date } = parseFilename(`${slug}.md`)
  const parsed = parseContent(raw)

  // Strip opening block (title + 분석일 + 판정 + first ---) already shown in the page header
  const firstSepIdx = raw.indexOf('\n---')
  const content = firstSepIdx !== -1 ? raw.slice(firstSepIdx + 5).trimStart() : raw

  return { slug, date, content, ...parsed }
}
