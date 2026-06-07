import { supabaseServer } from '@/lib/db/client';

export async function isAdmin(wallet: string): Promise<boolean> {
  const { data, error } = await supabaseServer()
    .from('admins')
    .select('wallet')
    .eq('wallet', wallet)
    .limit(1);
  if (error) throw error;
  return !!data && data.length > 0;
}
