// ============================================================
// /app/api/record/route.js   (App Router용 — 위 Pages 버전과 둘 중 하나만 사용)
// ============================================================
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('prediction_results')
      .select('*')
      .order('판정일', { ascending: false });

    if (error) throw error;

    const done = data.filter((d) => d.실제가 != null);
    const hits = done.filter((d) => d.적중 === true).length;

    const summary = {
      적중률: done.length ? Math.round((hits / done.length) * 100) : null,
      적중수: hits,
      검증건수: done.length,
      대기건수: data.length - done.length,
      평균수익: done.length
        ? Number((done.reduce((s, d) => s + Number(d.수익률 || 0), 0) / done.length).toFixed(1))
        : null,
    };

    return NextResponse.json(
      { summary, records: data },
      { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate' } }
    );
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
