// ============================================================
// /api/record.js   (Pages Router용)
// 적중률·평균수익 + 전체 기록을 반환
// ============================================================
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY   // 서버 전용 키
);

export default async function handler(req, res) {
  try {
    const { data, error } = await supabase
      .from('prediction_results')      // 계산 view를 읽음
      .select('*')
      .order('판정일', { ascending: false });

    if (error) throw error;

    // 검증 완료(실제가 입력됨)된 건만 집계
    const done = data.filter((d) => d.실제가 != null);
    const hits = done.filter((d) => d.적중 === true).length;

    const summary = {
      적중률: done.length ? Math.round((hits / done.length) * 100) : null,
      적중수: hits,
      검증건수: done.length,
      대기건수: data.length - done.length,
      평균수익:
        done.length
          ? Number(
              (done.reduce((s, d) => s + Number(d.수익률 || 0), 0) / done.length).toFixed(1)
            )
          : null,
    };

    // 캐시: 60초 (주가는 자주 안 바뀌므로)
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.status(200).json({ summary, records: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
