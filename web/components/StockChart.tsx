'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'

interface Bar { date: string; open: number; high: number; low: number; close: number; volume: number }

interface Props {
  ticker: string
  analysisDate: string  // YYYY-MM-DD
  verdictColor: string
}

function formatPrice(v: number, currency: string) {
  if (currency === 'KRW') return v.toLocaleString('ko-KR') + '원'
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function StockChart({ ticker, analysisDate, verdictColor }: Props) {
  const [bars, setBars]       = useState<Bar[]>([])
  const [symbol, setSymbol]   = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    if (!ticker) { setLoading(false); return }
    fetch(`/api/chart?ticker=${encodeURIComponent(ticker)}&date=${analysisDate}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setBars(d.bars ?? []); setSymbol(d.symbol ?? ticker) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [ticker, analysisDate])

  if (loading) return (
    <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 20, height: 20, borderRadius: 10, border: '2px solid rgba(10,132,255,0.3)', borderTopColor: '#0a84ff', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (error || bars.length === 0) return null

  const isKRW = symbol.endsWith('.KS') || symbol.endsWith('.KQ')
  const minClose = Math.min(...bars.map(b => b.low))
  const maxClose = Math.max(...bars.map(b => b.high))
  const pad = (maxClose - minClose) * 0.08
  const yMin = Math.floor(minClose - pad)
  const yMax = Math.ceil(maxClose + pad)

  // Label every ~30 bars (≈ 1 month)
  const labelEvery = Math.max(1, Math.floor(bars.length / 5))

  const changeBar = bars.findLast(b => b.date <= analysisDate) ?? bars[bars.length - 1]
  const firstBar  = bars[0]
  const pctChange = firstBar ? ((changeBar.close - firstBar.close) / firstBar.close * 100).toFixed(1) : null
  const positive  = pctChange !== null && parseFloat(pctChange) >= 0

  return (
    <div className="ios-card" style={{ padding: '16px 8px 8px', marginBottom: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 12px', marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#0a84ff' }}>{symbol}</span>
          <span style={{ fontSize: 11, color: 'rgba(235,235,245,0.4)', marginLeft: 8 }}>6개월 차트</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
            {formatPrice(changeBar.close, isKRW ? 'KRW' : 'USD')}
          </span>
          {pctChange && (
            <span style={{ fontSize: 12, marginLeft: 6, color: positive ? '#30d158' : '#ff453a' }}>
              {positive ? '+' : ''}{pctChange}%
            </span>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={bars} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={verdictColor} stopOpacity={0.35} />
              <stop offset="95%" stopColor={verdictColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(84,84,88,0.3)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            interval={labelEvery}
            tick={{ fill: 'rgba(235,235,245,0.4)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={v => isKRW ? (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : String(v)) : String(v)}
            tick={{ fill: 'rgba(235,235,245,0.4)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{ background: '#1c1c1e', border: '0.5px solid rgba(84,84,88,0.6)', borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: 'rgba(235,235,245,0.5)', marginBottom: 4 }}
            itemStyle={{ color: '#fff' }}
            formatter={(v) => [formatPrice(Number(v), isKRW ? 'KRW' : 'USD'), '종가']}
            labelFormatter={(l) => l}
          />
          {/* Analysis date marker */}
          <ReferenceLine
            x={analysisDate}
            stroke={verdictColor}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            label={{ value: '분석일', position: 'top', fill: verdictColor, fontSize: 9 }}
          />
          <Area
            type="monotone"
            dataKey="close"
            stroke={verdictColor}
            strokeWidth={1.5}
            fill="url(#chartGrad)"
            dot={false}
            activeDot={{ r: 3, fill: verdictColor }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
