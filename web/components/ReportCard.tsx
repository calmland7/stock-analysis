import Link from 'next/link'
import type { ReportMeta } from '@/lib/reports'

const verdictConfig: Record<string, { color: string; bg: string; dot: string }> = {
  적극매수: { color: '#30d158', bg: 'rgba(48,209,88,0.15)',  dot: '#30d158' },
  분할매수: { color: '#ff9f0a', bg: 'rgba(255,159,10,0.15)', dot: '#ff9f0a' },
  관망:     { color: '#636366', bg: 'rgba(99,99,102,0.2)',   dot: '#636366' },
  비중축소: { color: '#ffd60a', bg: 'rgba(255,214,10,0.15)', dot: '#ffd60a' },
  매도:     { color: '#ff453a', bg: 'rgba(255,69,58,0.15)',  dot: '#ff453a' },
}

export default function ReportCard({ report }: { report: ReportMeta }) {
  const cfg = verdictConfig[report.verdictLabel] ?? verdictConfig['관망']

  return (
    <Link href={`/reports/${report.slug}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div className="ios-card" style={{ padding: '18px 20px' }}>

        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Ticker pill */}
            {report.ticker && (
              <span style={{
                fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
                color: '#0a84ff', background: 'rgba(10,132,255,0.15)',
                padding: '3px 8px', borderRadius: 6, letterSpacing: 0.5,
              }}>{report.ticker}</span>
            )}
            <span style={{ fontSize: 12, color: 'rgba(235,235,245,0.35)' }}>{report.date}</span>
          </div>

          {/* Verdict badge */}
          <span className="ios-badge" style={{ color: cfg.color, background: cfg.bg }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: cfg.dot, flexShrink: 0 }} />
            {report.verdictLabel}
          </span>
        </div>

        {/* Stock name */}
        <p style={{ fontSize: 17, fontWeight: 600, letterSpacing: -0.3, marginBottom: 14, color: '#fff' }}>
          {report.stockName}
        </p>

        {/* Separator */}
        <div style={{ height: '0.5px', background: 'rgba(84,84,88,0.4)', marginBottom: 14 }} />

        {/* Metrics */}
        <div style={{ display: 'flex', gap: 20 }}>
          <MetricItem label="재무" value={report.financialGrade} />
          <MetricItem label="뉴스" value={report.newsSentiment} />
          <MetricItem label="업종" value={report.sectorOutlook} />
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
            <ChevronRight />
          </div>
        </div>
      </div>
    </Link>
  )
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: 'rgba(235,235,245,0.4)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 500, color: 'rgba(235,235,245,0.85)' }}>{value || '–'}</p>
    </div>
  )
}

function ChevronRight() {
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
      <path d="M1 1l6 6-6 6" stroke="rgba(235,235,245,0.28)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
