// Educational Wasal example. Default mode is offline and uses synthetic data.
const demo = {
  data: [
    { id: 1, account_id: 'demo-account', provider_id: 'demo-incoming', direction: 'incoming', amount_minor: '125000', exponent: 0, currency: 'SYP', note: 'DEMO-104', status: 'confirmed' },
    { id: 2, account_id: 'demo-account', provider_id: 'demo-outgoing', direction: 'outgoing', amount_minor: '25000', exponent: 0, currency: 'SYP', note: null, status: 'confirmed' },
  ],
  next_cursor: null,
  sync: { status: 'connected', last_sync_at: 1789257660, stale: false, error: null },
};

async function main() {
  const args = process.argv.slice(2);
  if (args.some((value) => value !== '--live') || args.length > 1) {
    throw new Error('Usage: node read-payments.mjs [--live]');
  }
  const live = args.includes('--live');
  let body = demo;
  if (live) {
    const key = process.env.WASAL_API_KEY?.trim();
    if (!key) throw new Error('Set WASAL_API_KEY privately before using --live.');
    let response;
    try {
      response = await fetch('https://wasalnow.com/api/v1/payments?limit=25', {
        method: 'GET',
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error('Read failed or timed out. No payment status was inferred.');
    }
    if (!response.ok) throw new Error(`Wasal returned HTTP ${response.status}. No payment status was inferred.`);
    try { body = await response.json(); }
    catch { throw new Error('Expected a JSON response. No payment status was inferred.'); }
  }
  if (!body || !Array.isArray(body.data) || !body.sync || typeof body.sync.stale !== 'boolean') {
    throw new Error('Unexpected response shape. Check the current API documentation.');
  }
  if (body.data.some((payment) => !payment || typeof payment !== 'object' || Array.isArray(payment))) {
    throw new Error('Unexpected payment entry. Check the current API documentation.');
  }
  const usableSync = body.sync.status === 'connected' && body.sync.stale === false && !body.sync.error;
  console.log(JSON.stringify({
    mode: live ? 'live-first-page' : 'offline-synthetic-demo',
    count: body.data.length,
    incoming: body.data.filter((payment) => payment.direction === 'incoming').length,
    outgoing: body.data.filter((payment) => payment.direction === 'outgoing').length,
    unknownDirection: body.data.filter((payment) => !['incoming', 'outgoing'].includes(payment.direction)).length,
    hasNextPage: body.next_cursor != null,
    usableSync,
    sync: {
      status: body.sync.status,
      last_sync_at: body.sync.last_sync_at,
      stale: body.sync.stale,
      hasError: Boolean(body.sync.error),
    },
  }, null, 2));
  if (!usableSync) {
    console.error('Sync is not current and connected. Do not infer absence of new payments.');
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
