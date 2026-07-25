// Cloudflare Pages Function: /api/state
// Backed by a KV namespace bound as PA_CALENDAR_KV in the Pages project settings.
// Stores exactly one JSON blob (this is a single-user app) under a fixed key.
//
// Setup (one time, in the Cloudflare dashboard):
//   1. Workers & Pages → KV → Create namespace (e.g. "pa-calendar-kv")
//   2. This Pages project → Settings → Functions → KV namespace bindings
//        → Variable name: PA_CALENDAR_KV → select the namespace you just made
//   3. This Pages project → Settings → Environment variables
//        → Add APP_SECRET, value = the same random string you put in CONFIG.APP_SECRET
//   4. Redeploy (or it picks up on next push)

const KEY = 'pa-calendar-state';

function checkAuth(context) {
  const { env, request } = context;
  if (!env.APP_SECRET) return true; // no secret configured yet — allow (dev convenience)
  return request.headers.get('X-App-Secret') === env.APP_SECRET;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestGet(context) {
  if (!checkAuth(context)) return json({ error: 'unauthorized' }, 401);
  try {
    const value = await context.env.PA_CALENDAR_KV.get(KEY);
    // Return the raw stored JSON string as-is (or empty body if nothing saved yet)
    return new Response(value || '', {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function onRequestPost(context) {
  if (!checkAuth(context)) return json({ error: 'unauthorized' }, 401);
  try {
    const body = await context.request.text();
    if (body.length > 2_000_000) return json({ error: 'payload too large' }, 400);
    JSON.parse(body); // validate it's actually JSON before storing
    await context.env.PA_CALENDAR_KV.put(KEY, body);
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 400);
  }
}

export async function onRequestDelete(context) {
  if (!checkAuth(context)) return json({ error: 'unauthorized' }, 401);
  try {
    await context.env.PA_CALENDAR_KV.delete(KEY);
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
