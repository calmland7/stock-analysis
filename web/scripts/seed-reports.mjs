/**
 * Sync local .md reports to Supabase.
 * - No args: upsert ALL reports
 * - With slug arg: upsert only that one report
 *
 * Usage:
 *   node scripts/seed-reports.mjs                        # sync all
 *   node scripts/seed-reports.mjs 20260531_PKC_001340   # sync one
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPORTS_DIR = join(__dirname, '..', '..', 'reports')

const SUPABASE_URL = 'https://thbhrtnamqyuuelkoswi.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoYmhydG5hbXF5dXVlbGtvc3dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxODMxMjUsImV4cCI6MjA5NTc1OTEyNX0._Cy5rEURrGaX-hSAYDPRFItaVPdLUPA5yvMRWoWG5Oo'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

if (!existsSync(REPORTS_DIR)) {
  console.log('No reports directory found.')
  process.exit(0)
}

// If a slug is passed as argument, sync only that file
const targetSlug = process.argv[2]

const files = targetSlug
  ? [`${targetSlug}.md`].filter(f => existsSync(join(REPORTS_DIR, f)))
  : readdirSync(REPORTS_DIR).filter(f => f.endsWith('.md'))

if (files.length === 0) {
  console.log(targetSlug ? `Report not found: ${targetSlug}.md` : 'No reports found.')
  process.exit(0)
}

console.log(`Syncing ${files.length} report(s) to Supabase...`)

for (const file of files) {
  const slug    = file.replace('.md', '')
  const content = readFileSync(join(REPORTS_DIR, file), 'utf-8')
  const { error } = await supabase
    .from('reports')
    .upsert({ slug, content }, { onConflict: 'slug' })
  if (error) {
    console.error(`  ✗ ${slug}: ${error.message}`)
  } else {
    console.log(`  ✓ ${slug}`)
  }
}

console.log('Done. Vercel will reflect changes on next page load.')
