import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    const { data, error } = await supabase
      .from('prediction_results')
      .select('*')
      .order('판정일', { ascending: false })

    if (error) throw error

    const records = data ?? []
    const done = records.filter((d) => d.실제가 != null)
    const hits = done.filter((d) => d.적중 === true).length

    const summary = {
      적중률: done.length ? Math.round((hits / done.length) * 100) : null,
      적중수: hits,
      검증건수: done.length,
      대기건수: records.length - done.length,
      평균수익: done.length
        ? Number((done.reduce((s, d) => s + Number(d.수익률 || 0), 0) / done.length).toFixed(1))
        : null,
    }

    return Response.json(
      { summary, records },
      { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate' } }
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return Response.json({ error: message }, { status: 500 })
  }
}
