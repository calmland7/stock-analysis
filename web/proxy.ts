import { NextRequest, NextResponse } from 'next/server'

export function proxy(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER
  const pass = process.env.BASIC_AUTH_PASS

  if (!user || !pass) return NextResponse.next()

  const auth = req.headers.get('authorization') ?? ''
  if (auth.startsWith('Basic ')) {
    try {
      const decoded   = atob(auth.slice(6))
      const colonIdx  = decoded.indexOf(':')
      const inputUser = decoded.slice(0, colonIdx)
      const inputPass = decoded.slice(colonIdx + 1)
      if (inputUser === user && inputPass === pass) return NextResponse.next()
    } catch {}
  }

  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Stock Analysis"' },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|api/search).*)'],
}
