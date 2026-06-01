export const runtime = 'nodejs'

interface OhlcBar {
  date: string   // YYYY-MM-DD
  open: number
  high: number
  low: number
  close: number
  volume: number
}

async function fetchYahoo(symbol: string, rangeMonths = 6): Promise<OhlcBar[] | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${rangeMonths}mo`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) return null

    const timestamps: number[] = result.timestamp ?? []
    const q = result.indicators?.quote?.[0]
    if (!q || timestamps.length === 0) return null

    return timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      open:   Math.round((q.open[i]   ?? 0) * 100) / 100,
      high:   Math.round((q.high[i]   ?? 0) * 100) / 100,
      low:    Math.round((q.low[i]    ?? 0) * 100) / 100,
      close:  Math.round((q.close[i]  ?? 0) * 100) / 100,
      volume: q.volume[i] ?? 0,
    })).filter(b => b.close > 0)
  } catch {
    return null
  }
}

// Try multiple ticker formats for Korean / international stocks
async function fetchBestTicker(ticker: string): Promise<{ bars: OhlcBar[]; symbol: string } | null> {
  const isKorean = /^\d{6}$/.test(ticker)

  const candidates = isKorean
    ? [`${ticker}.KS`, `${ticker}.KQ`]
    : [ticker, `${ticker}.V`, `${ticker}.TO`]

  for (const sym of candidates) {
    const bars = await fetchYahoo(sym)
    if (bars && bars.length > 5) return { bars, symbol: sym }
  }
  return null
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker')?.trim()
  const date   = searchParams.get('date')?.trim()   // YYYY-MM-DD

  if (!ticker) return Response.json({ error: 'ticker required' }, { status: 400 })

  const result = await fetchBestTicker(ticker)
  if (!result) return Response.json({ error: 'no data' }, { status: 404 })

  return Response.json({ symbol: result.symbol, date, bars: result.bars })
}
