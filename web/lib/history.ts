import { supabase } from './supabase'

export async function getUserSlugs(email: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('user_history')
    .select('slug')
    .eq('user_email', email)

  if (error) {
    console.error('[history] getUserSlugs:', error.message)
    return new Set()
  }
  return new Set(data.map((r: { slug: string }) => r.slug))
}

export async function addSlugToHistory(email: string, slug: string): Promise<void> {
  const { error } = await supabase
    .from('user_history')
    .upsert({ user_email: email, slug }, { onConflict: 'user_email,slug' })

  if (error) {
    console.error('[history] addSlugToHistory:', error.message)
  }
}
