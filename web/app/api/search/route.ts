export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 1) return Response.json([])

  try {
    // Always query Naver (it returns Korean stocks for Latin queries too, e.g. "LG"),
    // and filter to genuine KOSPI/KOSDAQ listings so Yahoo owns foreign tickers.
    const [naverResults, yahooResults] = await Promise.all([
      searchNaver(q),
      searchYahoo(q),
    ])

    // Naver results first (Korean), then Yahoo (international), dedup by symbol
    const seen = new Set<string>()
    const merged = [...naverResults, ...yahooResults].filter(r => {
      if (seen.has(r.symbol)) return false
      seen.add(r.symbol)
      return true
    })

    return Response.json(merged.slice(0, 10))
  } catch {
    return Response.json([])
  }
}

// ── Naver stock autocomplete (Korean stocks) ────────────────────────────
async function searchNaver(q: string): Promise<StockResult[]> {
  const url = `https://ac.stock.naver.com/ac?q=${encodeURIComponent(q)}&target=index,stock,marketindex`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://finance.naver.com/' },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return []
    const data = await res.json()
    // { query, items: [{ code, name, typeCode:'KOSPI'|'KOSDAQ', ... }] }
    const items: NaverAcItem[] = data?.items ?? []
    return items
      // Keep only Korean exchange listings — Naver also returns NASDAQ/TOKYO/HONG_KONG
      // hits (e.g. 애플/AAPL) that must not get a .KS/.KQ suffix; Yahoo handles those.
      .filter(it => (it.typeCode === 'KOSPI' || it.typeCode === 'KOSDAQ') && (it.category === 'stock' || !it.category))
      .slice(0, 8)
      .map(it => {
        const isKq = it.typeCode === 'KOSDAQ'
        return {
          symbol:   `${it.code}${isKq ? '.KQ' : '.KS'}`,
          name:     it.name,
          exchange: isKq ? 'KOSDAQ' : 'KOSPI',
          region:   'KR' as const,
        }
      })
  } catch {
    return []
  }
}

// ── Yahoo Finance search (all markets) ─────────────────────────────────
async function searchYahoo(q: string): Promise<StockResult[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&lang=en-US&region=US&quotesCount=8&newsCount=0&enableFuzzyQuery=false`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return []

    const data = await res.json()
    const quotes: YahooQuote[] = data?.quotes ?? []

    return quotes
      .filter((q: YahooQuote) => q.quoteType === 'EQUITY')
      .slice(0, 8)
      .map((q: YahooQuote) => ({
        symbol:   q.symbol,
        name:     q.longname || q.shortname || q.symbol,
        exchange: resolveExchange(q.symbol, q.exchDisp ?? ''),
        region:   resolveRegion(q.symbol),
      }))
  } catch {
    return []
  }
}

interface StockResult {
  symbol: string
  name: string
  exchange: string
  region: 'KR' | 'US' | 'JP' | 'HK' | 'CA' | 'GB' | 'OTHER'
}

interface NaverAcItem {
  code: string
  name: string
  typeCode?: string
  category?: string
}

interface YahooQuote {
  symbol: string
  shortname?: string
  longname?: string
  exchDisp?: string
  typeDisp?: string
  quoteType?: string
}

function resolveExchange(symbol: string, exchDisp: string): string {
  if (symbol.endsWith('.KS')) return 'KOSPI'
  if (symbol.endsWith('.KQ')) return 'KOSDAQ'
  if (symbol.endsWith('.T'))  return 'TSE'
  if (symbol.endsWith('.L'))  return 'LSE'
  if (symbol.endsWith('.HK')) return 'HKEX'
  if (symbol.endsWith('.V') || symbol.endsWith('.TO')) return 'TSX'
  if (exchDisp) return exchDisp
  return 'NASDAQ/NYSE'
}

function resolveRegion(symbol: string): StockResult['region'] {
  if (symbol.endsWith('.KS') || symbol.endsWith('.KQ')) return 'KR'
  if (symbol.endsWith('.T'))  return 'JP'
  if (symbol.endsWith('.HK')) return 'HK'
  if (symbol.endsWith('.L'))  return 'GB'
  if (symbol.endsWith('.TO') || symbol.endsWith('.V')) return 'CA'
  if (!symbol.includes('.'))  return 'US'
  return 'OTHER'
}
