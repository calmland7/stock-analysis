import { getReport, getAllReports } from '@/lib/reports'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import StockChart from '@/components/StockChart'

export const dynamic = 'force-dynamic'

export async function generateStaticParams() {
  return []
}

const verdictConfig: Record<string, { color: string; bg: string; glow: string }> = {
  적극매수: { color: '#30d158', bg: 'rgba(48,209,88,0.15)',  glow: 'rgba(48,209,88,0.25)' },
  분할매수: { color: '#ff9f0a', bg: 'rgba(255,159,10,0.15)', glow: 'rgba(255,159,10,0.2)' },
  관망:     { color: '#636366', bg: 'rgba(99,99,102,0.15)',  glow: 'transparent' },
  비중축소: { color: '#ffd60a', bg: 'rgba(255,214,10,0.15)', glow: 'rgba(255,214,10,0.2)' },
  매도:     { color: '#ff453a', bg: 'rgba(255,69,58,0.15)',  glow: 'rgba(255,69,58,0.2)' },
}

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const report = await getReport(slug)
  if (!report) notFound()

  const cfg = verdictConfig[report.verdictLabel] ?? verdictConfig['관망']

  // Extract ticker from report or slug (handles numeric Korean codes like 001340)
  const ticker = report.ticker || (() => {
    const parts = slug.split('_')
    for (let i = parts.length - 1; i >= 0; i--) {
      if (/^\d{5,6}$/.test(parts[i])) return parts[i]   // Korean code
      if (/^[A-Z]{2,6}$/.test(parts[i])) return parts[i] // US/intl ticker
    }
    return ''
  })()

  return (
    <>
      {/* Nav bar */}
      <div className="ios-navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link href="/" style={{
            display: 'flex', alignItems: 'center', gap: 4,
            color: '#0a84ff', textDecoration: 'none', fontSize: 17,
          }}>
            <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
              <path d="M8 1L1 8l7 7" stroke="#0a84ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            목록
          </Link>
        </div>
      </div>

      {/* Hero section */}
      <div style={{
        padding: '24px 20px 20px',
        background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${cfg.glow} 0%, transparent 70%)`,
      }}>
        {/* Ticker + date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {report.ticker && (
            <span style={{
              fontSize: 13, fontWeight: 700, fontFamily: 'monospace',
              color: '#0a84ff', background: 'rgba(10,132,255,0.15)',
              padding: '4px 10px', borderRadius: 8, letterSpacing: 0.5,
            }}>{report.ticker}</span>
          )}
          <span style={{ fontSize: 13, color: 'rgba(235,235,245,0.4)' }}>{report.date}</span>
        </div>

        {/* Stock name */}
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.6, marginBottom: 16 }}>
          {report.stockName}
        </h1>

        {/* Verdict big badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: cfg.bg,
          border: `1px solid ${cfg.color}40`,
          borderRadius: 14, padding: '10px 18px',
          marginBottom: 20,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: cfg.color }} />
          <span style={{ fontSize: 17, fontWeight: 700, color: cfg.color, letterSpacing: -0.3 }}>
            {report.verdictFull || report.verdictLabel}
          </span>
        </div>

        {/* Metrics card */}
        <div className="ios-card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
            {[
              { label: '재무 등급', value: report.financialGrade },
              { label: '뉴스 심리', value: report.newsSentiment },
              { label: '업종 전망', value: report.sectorOutlook },
            ].map((m, i) => (
              <div key={m.label} style={{
                padding: '0 12px',
                borderRight: i < 2 ? '0.5px solid rgba(84,84,88,0.5)' : 'none',
                textAlign: 'center',
              }}>
                <p style={{ fontSize: 11, color: 'rgba(235,235,245,0.4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {m.label}
                </p>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{m.value || '–'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      {ticker && (
        <div style={{ padding: '0 16px 4px' }}>
          <StockChart
            ticker={ticker}
            analysisDate={report.date}
            verdictColor={cfg.color}
          />
        </div>
      )}

      {/* Report content */}
      <div style={{ padding: '8px 16px 60px' }}>
        <div className="ios-card" style={{ padding: '20px 20px' }}>
          <MarkdownRenderer content={report.content} />
        </div>
      </div>
    </>
  )
}
