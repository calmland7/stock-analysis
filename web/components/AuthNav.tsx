import { auth, signIn, signOut } from '@/auth'

export default async function AuthNav() {
  const session = await auth()

  if (session?.user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {session.user.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt={session.user.name ?? ''}
            style={{ width: 28, height: 28, borderRadius: 14, objectFit: 'cover' }}
          />
        )}
        <form action={async () => {
          'use server'
          await signOut({ redirectTo: '/' })
        }}>
          <button type="submit" style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(235,235,245,0.4)', fontSize: 12, padding: 0,
          }}>
            로그아웃
          </button>
        </form>
      </div>
    )
  }

  return (
    <form action={async () => {
      'use server'
      await signIn('google')
    }}>
      <button type="submit" style={{
        padding: '6px 14px', borderRadius: 10, border: 'none',
        background: 'rgba(10,132,255,0.2)', color: '#0a84ff',
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
      }}>
        Google 로그인
      </button>
    </form>
  )
}
