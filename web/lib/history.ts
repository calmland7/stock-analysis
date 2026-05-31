import fs from 'fs'
import path from 'path'

const HISTORY_FILE = path.join(process.cwd(), '..', 'data', 'user-history.json')

type UserHistory = Record<string, string[]>

function read(): UserHistory {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return {}
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

export function getUserSlugs(email: string): Set<string> {
  return new Set(read()[email] ?? [])
}

export function addSlugToHistory(email: string, slug: string): void {
  const h = read()
  const slugs = h[email] ?? []
  if (!slugs.includes(slug)) {
    h[email] = [slug, ...slugs]
    fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true })
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(h, null, 2), 'utf-8')
  }
}
