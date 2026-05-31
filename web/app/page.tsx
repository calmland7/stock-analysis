import { auth } from '@/auth'
import { getAllReports } from '@/lib/reports'
import { getUserSlugs } from '@/lib/history'
import ReportCard from '@/components/ReportCard'
import HomeClient from '@/components/HomeClient'
import AuthNav from '@/components/AuthNav'

export default async function Home() {
  const session = await auth()
  const userEmail = session?.user?.email ?? null

  const allReports = getAllReports()
  const userSlugs = userEmail ? getUserSlugs(userEmail) : new Set<string>()
  const reports = userEmail
    ? allReports.filter(r => userSlugs.has(r.slug))
    : []

  const counts = {
    total: reports.length,
    buy:   reports.filter(r => r.verdictLabel === '적극매수').length,
    accum: reports.filter(r => r.verdictLabel === '분할매수').length,
    watch: reports.filter(r => ['관망', '비중축소', '매도'].includes(r.verdictLabel)).length,
  }

  return (
    <>
      {/* Nav bar */}
      <div className="ios-navbar">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 13, color: 'rgba(235,235,245,0.4)', marginBottom: 2 }}>멀티에이전트 분석</p>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.8 }}>주식 분석</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AuthNav />
            <div style={{
              width: 36, height: 36, borderRadius: 18,
              background: 'linear-gradient(135deg, #0a84ff 0%, #bf5af2 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              flexShrink: 0,
            }}>📊</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 16px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Search bar (client) — only for logged-in users */}
        {userEmail ? (
          <HomeClient />
        ) : (
          <div className="ios-card" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>로그인이 필요합니다</p>
            <p style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.6 }}>
              Google 계정으로 로그인하면<br />나만의 종목 분석 히스토리를 저장할 수 있습니다
            </p>
          </div>
        )}

        {userEmail && (
          <>
            {/* Stats row */}
            <div style={{ display: 'flex', gap: 10 }}>
              <StatChip label="총 종목" value={counts.total} color="#ffffff" />
              <StatChip label="적극매수" value={counts.buy} color="var(--green)" />
              <StatChip label="분할매수" value={counts.accum} color="var(--orange)" />
              <StatChip label="관망/매도" value={counts.watch} color="rgba(235,235,245,0.4)" />
            </div>

            {/* Section header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 4px 0' }}>
              <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>내 리포트</span>
              <span style={{ fontSize: 13, color: 'var(--blue)' }}>{counts.total}건</span>
            </div>

            {/* Report list */}
            {reports.length === 0 ? (
              <div className="ios-card" style={{ padding: 48, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
                <p style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>아직 분석된 종목이 없습니다</p>
                <p style={{ fontSize: 14, color: 'var(--txt2)', lineHeight: 1.6 }}>
                  위 검색창에 종목명을 입력하고<br />분석 버튼을 눌러보세요
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {reports.map(r => <ReportCard key={r.slug} report={r} />)}
              </div>
            )}
          </>
        )}

        <p style={{ fontSize: 12, color: 'var(--txt3)', textAlign: 'center', lineHeight: 1.6, padding: '4px 8px 0' }}>
          본 리포트는 투자 참고용이며, 최종 투자 결정과<br />책임은 투자자 본인에게 있습니다.
        </p>
      </div>
    </>
  )
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="stat-chip">
      <span style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: -0.5 }}>{value}</span>
      <span style={{ fontSize: 11, color: 'var(--txt2)', textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
    </div>
  )
}
