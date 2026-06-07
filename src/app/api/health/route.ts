import { NextResponse } from 'next/server';
import { supabaseAnon, isSupabaseConfigured } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

// Diagnostic endpoint: reports which env vars are present (booleans only, never
// the secret values) and the result of a test Supabase query. Safe to expose:
// the project URL is public, keys are never returned.
export async function GET() {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    has_NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    has_SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    has_NEXT_PUBLIC_TOKEN_MINT: !!process.env.NEXT_PUBLIC_TOKEN_MINT,
  };

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, stage: 'config', env });
  }

  try {
    const { data, error } = await supabaseAnon()
      .from('bounties')
      .select('id')
      .limit(1);
    if (error) {
      return NextResponse.json({
        ok: false,
        stage: 'query',
        env,
        error: error.message,
        code: (error as { code?: string }).code ?? null,
      });
    }
    return NextResponse.json({ ok: true, env, rows: data?.length ?? 0 });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      stage: 'exception',
      env,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
