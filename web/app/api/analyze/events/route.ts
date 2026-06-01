import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId')
  const since = parseInt(searchParams.get('since') ?? '0', 10)

  if (!jobId) {
    return new Response(JSON.stringify({ error: 'jobId required' }), { status: 400 })
  }

  const sb  = getSupabase()
  const enc = new TextEncoder()

  // Fetch new events since last known id
  const { data: events } = await sb
    .from('job_events')
    .select('id, payload')
    .eq('job_id', jobId)
    .gt('id', since)
    .order('id', { ascending: true })

  // Fetch current job status
  const { data: job } = await sb
    .from('analysis_jobs')
    .select('status, slug')
    .eq('id', jobId)
    .single()

  const rows = events ?? []

  // Build SSE response
  const body = new ReadableStream({
    start(ctrl) {
      for (const row of rows) {
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ ...row.payload, _eid: row.id })}\n\n`))
      }

      // If no events yet and job still pending, send a heartbeat with last id
      if (rows.length === 0) {
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'heartbeat', since })}\n\n`))
      }

      // If job is done/error and we have no more events, inject terminal event
      if (job && (job.status === 'done' || job.status === 'error') && rows.length === 0) {
        if (job.status === 'done' && job.slug) {
          ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'done', slug: job.slug })}\n\n`))
        } else if (job.status === 'error') {
          ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'error', message: '분석 중 오류가 발생했습니다.' })}\n\n`))
        }
      }

      ctrl.close()
    },
  })

  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
