import { supabaseServer } from '@/lib/db/client';

// Simple key/value app settings stored in Supabase (e.g. the live token mint).
// Read/written with the service-role client; resilient when DB isn't configured.

export async function getSetting(key: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseServer()
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) return null;
    return (data?.value as string | null) ?? null;
  } catch {
    return null;
  }
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  const { error } = await supabaseServer()
    .from('app_settings')
    .upsert({ key, value }, { onConflict: 'key' });
  if (error) throw error;
}
