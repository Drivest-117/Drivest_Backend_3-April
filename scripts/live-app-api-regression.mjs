#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && line.includes('='))
      .map((line) => {
        const i = line.indexOf('=');
        return [line.slice(0, i), line.slice(i + 1)];
      }),
  );
}

function itemsFrom(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function req(method, urlPath, body, headers = {}) {
  const res = await fetch(BASE + urlPath, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, text, json };
}

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
  console.log(`PASS ${message}`);
}

function readToken(response) {
  return (
    response?.json?.data?.accessToken ||
    response?.json?.accessToken ||
    ''
  );
}

async function main() {
  const envPath = path.resolve(process.cwd(), '.env');
  const env = loadEnv(envPath);
  const allowedTypes = 'traffic_light,zebra_crossing,stop_sign';

  const health = await req('GET', '/health');
  ensure(health.status === 200, 'health 200');

  const email = `qa-user-${Date.now()}@drivest.local`;
  const password = 'Test1234!';
  const displayName = 'QA User';

  const signUp = await req('POST', '/v1/auth/sign-up', {
    email,
    password,
    name: displayName,
    role: 'USER',
  });
  ensure(signUp.status === 200 || signUp.status === 201, 'sign-up accepted');
  const token = readToken(signUp);
  ensure(Boolean(token), 'sign-up returned token');

  const authHeaders = { Authorization: `Bearer ${token}` };

  const me = await req('GET', '/me', null, authHeaders);
  ensure(me.status === 200, 'me 200');
  const userId = me.json?.data?.id || me.json?.id;
  ensure(Boolean(userId), 'me returned user id');

  const centres = await req('GET', '/centres');
  ensure(centres.status === 200, 'centres 200');
  const centreItems = itemsFrom(centres.json);
  const colchester = centreItems.find(
    (c) =>
      String(c.slug || '').includes('colchester') ||
      String(c.name || '').toLowerCase().includes('colchester'),
  );
  ensure(Boolean(colchester), 'colchester centre exists');
  const centreKey = colchester.slug || colchester.id;

  const centreRoutes = await req(
    'GET',
    `/centres/${encodeURIComponent(centreKey)}/routes`,
  );
  ensure(centreRoutes.status === 200, 'centre routes 200');
  const routes = itemsFrom(centreRoutes.json);
  ensure(routes.length > 0, 'at least one centre route');
  const routeId = routes[0].id;

  const ent0 = await req('GET', '/entitlements/app', null, authHeaders);
  ensure(ent0.status === 200, 'entitlements app 200');

  let selectAfterPurchase = null;
  const selBefore = await req(
    'POST',
    '/entitlements/app/select-centre',
    { centreId: 'colchester' },
    authHeaders,
  );
  ensure(
    selBefore.status === 200 || selBefore.status === 201 || selBefore.status === 403,
    'select centre before purchase returned 200/201/403',
  );

  const webhookSecret = env.REVENUECAT_WEBHOOK_SECRET || '';
  if (webhookSecret) {
    const webhookPayload = {
      event_id: `evt_${Date.now()}`,
      type: 'INITIAL_PURCHASE',
      app_user_id: userId,
      product_id: 'centre_colchester_week_ios',
      transaction_id: `txn_${Date.now()}`,
      purchased_at: new Date().toISOString(),
    };
    const webhookBody = JSON.stringify(webhookPayload);
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(webhookBody)
      .digest('hex');

    const webhookRes = await fetch(BASE + '/webhooks/revenuecat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-revenuecat-signature': signature,
      },
      body: webhookBody,
    });
    const webhookText = await webhookRes.text();
    let webhookJson = null;
    try {
      webhookJson = webhookText ? JSON.parse(webhookText) : null;
    } catch {
      webhookJson = null;
    }

    ensure(
      webhookRes.status === 200 || webhookRes.status === 201,
      'webhook accepted',
    );

    const ent1 = await req('GET', '/entitlements/app', null, authHeaders);
    ensure(ent1.status === 200, 'entitlements app after webhook 200');

    selectAfterPurchase = await req(
      'POST',
      '/entitlements/app/select-centre',
      { centreId: 'colchester' },
      authHeaders,
    );
    ensure(
      selectAfterPurchase.status === 200 || selectAfterPurchase.status === 201,
      'select centre allowed after webhook',
    );

    console.log('PASS webhook response', JSON.stringify(webhookJson));
  } else {
    console.log('INFO webhook secret not set; skipping webhook entitlement step');
  }

  const route = await req('GET', `/routes/app/${routeId}`, null, authHeaders);
  ensure(route.status === 200, 'route by app endpoint 200');

  const start = await req('POST', `/routes/app/${routeId}/practice/start`, {}, authHeaders);
  ensure(start.status === 200 || start.status === 201, 'practice start ok');

  const finish = await req(
    'POST',
    `/routes/app/${routeId}/practice/finish`,
    { completed: true, distanceM: 900, durationS: 420 },
    authHeaders,
  );
  ensure(finish.status === 200 || finish.status === 201, 'practice finish ok');

  const dlRes = await fetch(BASE + `/routes/app/${routeId}/download`, { headers: authHeaders });
  const dlText = await dlRes.text();
  ensure(dlRes.status === 200, 'route download 200');
  ensure(
    dlText.includes('<gpx') || dlText.includes('<rte') || dlText.includes('<trk'),
    'download returns gpx-like xml',
  );

  const routeHaz = await req(
    'GET',
    `/routes/app/${routeId}/hazards?types=${encodeURIComponent(allowedTypes)}`,
    null,
    authHeaders,
  );
  ensure(routeHaz.status === 200, 'route hazards 200');

  const centreHaz = await req(
    'GET',
    `/centres/colchester/hazards?types=${encodeURIComponent(allowedTypes)}`,
  );
  ensure(centreHaz.status === 200, 'centre hazards 200');

  let lat = 51.889;
  let lng = 0.9373;
  const routeJson = route.json || {};
  const coordinates =
    routeJson.coordinates ||
    routeJson.route?.coordinates ||
    routeJson.geojson?.coordinates ||
    routeJson.route?.geojson?.coordinates;
  if (
    Array.isArray(coordinates) &&
    Array.isArray(coordinates[0]) &&
    coordinates[0].length >= 2
  ) {
    lng = Number(coordinates[0][0]);
    lat = Number(coordinates[0][1]);
  }

  const south = lat - 0.01;
  const north = lat + 0.01;
  const west = lng - 0.01;
  const east = lng + 0.01;
  const bboxHaz = await req(
    'GET',
    `/hazards/route?south=${south}&west=${west}&north=${north}&east=${east}&centreId=colchester&types=${encodeURIComponent(
      allowedTypes,
    )}`,
  );
  ensure(bboxHaz.status === 200, 'hazards route (bbox) 200');

  const nearby = await req(
    'POST',
    '/navigation/app/hazards/nearby',
    {
      center: { lat, lng },
      centreId: 'colchester',
      corridorWidthM: 45,
      lookaheadM: 450,
      limit: 10,
      routeId,
      types: [
        'TRAFFIC_SIGNAL',
        'ZEBRA_CROSSING',
        'ROUNDABOUT',
        'BUS_STOP',
        'TRAFFIC_CALMING',
      ],
    },
    authHeaders,
  );
  ensure(nearby.status === 200 || nearby.status === 201, 'nearby hazards 200');
  const nearbyItems = itemsFrom(nearby.json);
  ensure(Array.isArray(nearbyItems), 'nearby hazards has items array');

  console.log(
    'SUMMARY',
    JSON.stringify({
      userId,
      routeId,
      selectBefore: selBefore.status,
      selectAfter: selectAfterPurchase?.status ?? null,
      nearbyItems: nearbyItems.length,
      nearbySourceStatus:
        nearby.json?.meta?.source_status ?? nearby.json?.data?.source_status ?? null,
    }),
  );
}

main().catch((err) => {
  console.error('FAIL', err?.message || err);
  process.exit(1);
});
