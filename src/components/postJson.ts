export interface PostResult {
  ok: boolean;
  error?: string;
  data?: unknown;
}

// POSTs JSON and safely parses the response, tolerating empty / non-JSON bodies
// (e.g. an unexpected 500) so the UI never crashes on res.json().
export async function postJson(url: string, body: unknown): Promise<PostResult> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: { ok?: boolean; error?: string; data?: unknown } | null = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (parsed && typeof parsed.ok === 'boolean') {
    return { ok: parsed.ok, error: parsed.error, data: parsed.data };
  }
  return { ok: false, error: `Request failed (${res.status})` };
}
