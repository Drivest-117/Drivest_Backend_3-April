#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL =
  process.env.BASE_URL ||
  'http://ec2-16-170-253-80.eu-north-1.compute.amazonaws.com:3000';
const MAX_RESPONSE_CHARS = Number(process.env.MAX_RESPONSE_CHARS || 20000);
const STARTED_AT = new Date().toISOString();
const TS = STARTED_AT.replace(/[:.]/g, '-');
const OUT_FILE = process.env.OUT_FILE || `api-audit-full-${TS}.md`;

const DEFAULT_UUID = '11111111-1111-1111-1111-111111111111';
const DEFAULT_MONTH = new Date().toISOString().slice(0, 7);

function stripTrailingSlash(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function maskToken(token) {
  if (!token || typeof token !== 'string') return '';
  if (token.length <= 12) return token;
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}

function normalizeItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function normalizeObject(payload) {
  if (payload?.data && typeof payload.data === 'object') return payload.data;
  if (payload && typeof payload === 'object') return payload;
  return null;
}

function safeStringify(value) {
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function nowPlus(hours) {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}

function monthStartISO() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

function valueFromType(schema = {}) {
  const type = schema.type;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];
  if (type === 'boolean') return false;
  if (type === 'integer' || type === 'number') return 1;
  if (type === 'string') {
    if (schema.format === 'email') return `audit.${Date.now()}@example.com`;
    if (schema.format === 'uuid') return DEFAULT_UUID;
    if (schema.format === 'date-time') return new Date().toISOString();
    if (schema.format === 'date') return new Date().toISOString().slice(0, 10);
    return 'string';
  }
  if (type === 'array') return [];
  if (type === 'object') return {};
  return 'value';
}

class FullSwaggerAuditor {
  constructor(baseUrl) {
    this.baseUrl = stripTrailingSlash(baseUrl);
    this.spec = null;
    this.ctx = {
      learner: null,
      instructor: null,
      admin: null,
      publicInstructorId: null,
      centreId: 'colchester',
      centreSlugOrId: 'colchester',
      routeId: DEFAULT_UUID,
      lessonId: DEFAULT_UUID,
      reviewId: DEFAULT_UUID,
      disputeId: DEFAULT_UUID,
      notificationId: DEFAULT_UUID,
      availabilityId: DEFAULT_UUID,
      linkingRequestId: DEFAULT_UUID,
      parkingSpotId: null,
      councilId: 'camden',
      bbox: {
        south: 51.5,
        west: -0.2,
        north: 51.6,
        east: -0.1,
      },
      geo: { lat: 51.5074, lng: -0.1278 },
      statuses: [],
    };
    this.generatedIdentityCounter = 0;
    this.results = [];
  }

  async fetchSpec() {
    const res = await fetch(`${this.baseUrl}/docs-json`);
    const text = await res.text();
    const json = safeJsonParse(text);
    if (!res.ok || !json || !json.paths) {
      throw new Error(`Unable to load OpenAPI spec from ${this.baseUrl}/docs-json`);
    }
    this.spec = json;
  }

  makeIdentity(prefix) {
    this.generatedIdentityCounter += 1;
    const stamp = `${Date.now()}-${this.generatedIdentityCounter}`;
    return {
      email: `${prefix}.audit.${stamp}@example.com`,
      password: 'StrongPass1',
      name: `Audit ${prefix} ${this.generatedIdentityCounter}`,
    };
  }

  async request({
    method,
    pathName,
    query,
    headers,
    body,
    contentType = 'application/json',
  }) {
    const url = new URL(this.baseUrl + pathName);
    if (query && typeof query === 'object') {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null || v === '') continue;
        if (Array.isArray(v)) {
          for (const item of v) url.searchParams.append(k, String(item));
          continue;
        }
        url.searchParams.set(k, String(v));
      }
    }

    const requestHeaders = {
      Accept: 'application/json, text/plain, */*',
      ...(headers || {}),
    };

    let payload;
    if (body !== undefined) {
      if (
        contentType === 'application/x-www-form-urlencoded' &&
        body &&
        typeof body === 'object'
      ) {
        payload = new URLSearchParams(
          Object.entries(body).map(([k, v]) => [k, String(v)]),
        ).toString();
      } else if (typeof body === 'string') {
        payload = body;
      } else {
        payload = JSON.stringify(body);
      }
      if (!requestHeaders['content-type']) {
        requestHeaders['content-type'] = contentType;
      }
    }

    const res = await fetch(url, {
      method,
      headers: requestHeaders,
      body: payload,
    });
    const text = await res.text();
    const json = safeJsonParse(text);
    const responseHeaders = {
      'content-type': res.headers.get('content-type') || '',
      'x-request-id': res.headers.get('x-request-id') || '',
      location: res.headers.get('location') || '',
    };
    return {
      status: res.status,
      ok: res.ok,
      text,
      json,
      headers: responseHeaders,
      url: url.toString(),
      requestBody: payload,
      requestHeaders,
    };
  }

  readToken(response) {
    return (
      response?.json?.data?.accessToken ||
      response?.json?.accessToken ||
      response?.json?.token ||
      ''
    );
  }

  readId(response) {
    return response?.json?.data?.id || response?.json?.id || null;
  }

  async bootstrapIdentitiesAndContext() {
    const learnerIdentity = this.makeIdentity('learner');
    const instructorIdentity = this.makeIdentity('instructor');
    const adminIdentity = this.makeIdentity('admin');

    const learnerSignup = await this.request({
      method: 'POST',
      pathName: '/v1/auth/sign-up',
      body: { ...learnerIdentity, role: 'USER' },
    });
    const learnerSignin = await this.request({
      method: 'POST',
      pathName: '/v1/auth/sign-in',
      body: { email: learnerIdentity.email, password: learnerIdentity.password },
    });
    const learnerToken = this.readToken(learnerSignin) || this.readToken(learnerSignup);
    const learnerId = this.readId(learnerSignin) || this.readId(learnerSignup);
    this.ctx.learner = {
      ...learnerIdentity,
      token: learnerToken,
      id: learnerId,
      role: 'USER',
    };

    const instructorSignup = await this.request({
      method: 'POST',
      pathName: '/v1/auth/sign-up',
      body: { ...instructorIdentity, role: 'INSTRUCTOR' },
    });
    const instructorSignin = await this.request({
      method: 'POST',
      pathName: '/v1/auth/sign-in',
      body: { email: instructorIdentity.email, password: instructorIdentity.password },
    });
    const instructorToken =
      this.readToken(instructorSignin) || this.readToken(instructorSignup);
    const instructorId = this.readId(instructorSignin) || this.readId(instructorSignup);
    this.ctx.instructor = {
      ...instructorIdentity,
      token: instructorToken,
      id: instructorId,
      role: 'INSTRUCTOR',
    };

    const adminSignup = await this.request({
      method: 'POST',
      pathName: '/v1/auth/sign-up',
      body: { ...adminIdentity, role: 'ADMIN' },
    });
    const adminSignin = await this.request({
      method: 'POST',
      pathName: '/v1/auth/sign-in',
      body: { email: adminIdentity.email, password: adminIdentity.password },
    });
    const adminToken = this.readToken(adminSignin) || this.readToken(adminSignup);
    const adminId = this.readId(adminSignin) || this.readId(adminSignup);
    this.ctx.admin = {
      ...adminIdentity,
      token: adminToken,
      id: adminId,
      role: 'ADMIN',
    };

    if (this.ctx.instructor?.token) {
      await this.request({
        method: 'POST',
        pathName: '/v1/instructors/profile',
        headers: { Authorization: `Bearer ${this.ctx.instructor.token}` },
        body: {
          fullName: this.ctx.instructor.name,
          bio: 'Created by full API audit script',
          transmissionType: 'MANUAL',
          hourlyRate: 35,
          location: {
            city: 'London',
            postcode: 'EC1A 1BB',
            lat: this.ctx.geo.lat,
            lng: this.ctx.geo.lng,
          },
          languages: ['English'],
        },
      });
    }

    const centres = await this.request({ method: 'GET', pathName: '/centres', query: { limit: 10 } });
    const centreItems = normalizeItems(centres.json);
    if (centreItems.length > 0) {
      const centre = centreItems[0];
      this.ctx.centreId = centre.id || centre.slug || this.ctx.centreId;
      this.ctx.centreSlugOrId = centre.slug || centre.id || this.ctx.centreSlugOrId;
      if (centre.lat && centre.lng) {
        this.ctx.geo = { lat: Number(centre.lat), lng: Number(centre.lng) };
        this.ctx.bbox = {
          south: this.ctx.geo.lat - 0.05,
          west: this.ctx.geo.lng - 0.05,
          north: this.ctx.geo.lat + 0.05,
          east: this.ctx.geo.lng + 0.05,
        };
      }
    }

    const routes = await this.request({
      method: 'GET',
      pathName: `/centres/${encodeURIComponent(this.ctx.centreSlugOrId)}/routes`,
    });
    const routeItems = normalizeItems(routes.json);
    if (routeItems.length > 0) {
      this.ctx.routeId = routeItems[0].id || this.ctx.routeId;
    }

    const pub = await this.request({
      method: 'GET',
      pathName: '/v1/instructors/public',
    });
    const pubItems = normalizeItems(pub.json);
    if (pubItems.length > 0) {
      this.ctx.publicInstructorId =
        pubItems[0].id ||
        pubItems[0].instructorId ||
        this.ctx.instructor?.id ||
        this.ctx.publicInstructorId;
    } else if (this.ctx.instructor?.id) {
      this.ctx.publicInstructorId = this.ctx.instructor.id;
    }
  }

  listOperations() {
    const operations = [];
    for (const [pathName, methods] of Object.entries(this.spec.paths || {})) {
      for (const [m, op] of Object.entries(methods || {})) {
        operations.push({
          method: m.toUpperCase(),
          pathName,
          op: op || {},
          tag: (op?.tags && op.tags[0]) || 'untagged',
          operationId: op?.operationId || '',
        });
      }
    }
    return operations;
  }

  resolveRefSchema(schema) {
    if (!schema || typeof schema !== 'object') return null;
    if (!schema.$ref) return schema;
    const match = /^#\/components\/schemas\/(.+)$/.exec(schema.$ref);
    if (!match) return schema;
    return this.spec.components?.schemas?.[match[1]] || schema;
  }

  resolveRefParameter(param) {
    if (!param || typeof param !== 'object') return null;
    if (!param.$ref) return param;
    const match = /^#\/components\/parameters\/(.+)$/.exec(param.$ref);
    if (!match) return param;
    return this.spec.components?.parameters?.[match[1]] || param;
  }

  pickTokenForOperation(method, pathName) {
    const adminPath = pathName.startsWith('/v1/admin') || pathName.startsWith('/admin');
    if (adminPath) return this.ctx.admin?.token || this.ctx.learner?.token || '';

    if (
      pathName.includes('/v1/instructors/profile') ||
      pathName.includes('/v1/instructors/availability') ||
      pathName.includes('/v1/instructors/linking/share-code') ||
      pathName.includes('/v1/instructors/linking/requests/pending') ||
      pathName.includes('/v1/instructors/linking/requests/{id}/approve') ||
      pathName.includes('/v1/instructors/linking/instructor/learners') ||
      pathName.includes('/v1/analytics/instructor')
    ) {
      return this.ctx.instructor?.token || this.ctx.learner?.token || '';
    }

    if (pathName.startsWith('/v1/lessons')) {
      if (method === 'PATCH' && pathName.includes('/status')) {
        return this.ctx.instructor?.token || this.ctx.learner?.token || '';
      }
      return this.ctx.learner?.token || this.ctx.instructor?.token || '';
    }

    if (pathName.startsWith('/v1/reviews/') && method === 'POST') {
      return this.ctx.learner?.token || '';
    }

    if (pathName.startsWith('/v1/instructors/') && pathName.includes('/reviews')) {
      return this.ctx.learner?.token || '';
    }

    if (pathName.startsWith('/v1/disputes') && method === 'PATCH') {
      return this.ctx.instructor?.token || this.ctx.learner?.token || '';
    }

    if (
      pathName.startsWith('/health') ||
      pathName.startsWith('/centres') ||
      pathName.startsWith('/hazards/route') ||
      pathName.startsWith('/v1/instructors/public') ||
      pathName.startsWith('/v1/legal/acceptance') ||
      pathName.startsWith('/v1/instructors/legal/acceptance') ||
      pathName.startsWith('/v1/legal/app/bootstrap') ||
      pathName.startsWith('/webhooks/revenuecat') ||
      pathName.startsWith('/parking') ||
      pathName.startsWith('/v1/parking') ||
      pathName.startsWith('/content-packs/manifest') ||
      pathName.startsWith('/auth/') ||
      pathName.startsWith('/v1/auth/')
    ) {
      return '';
    }

    return this.ctx.learner?.token || this.ctx.instructor?.token || '';
  }

  pathParamValue(pathName, paramName) {
    if (paramName === 'surface') {
      if (pathName.includes('/instructors/legal/acceptance/')) return 'instructor_hub';
      return 'find_instructor';
    }

    if (paramName !== 'id') return paramName;

    if (pathName.startsWith('/centres/{id}')) return this.ctx.centreSlugOrId || this.ctx.centreId;
    if (pathName.startsWith('/routes/')) return this.ctx.routeId || DEFAULT_UUID;
    if (pathName.startsWith('/v1/instructors/public/{id}')) return this.ctx.publicInstructorId || DEFAULT_UUID;
    if (pathName.startsWith('/v1/instructors/{id}/reviews')) return this.ctx.publicInstructorId || DEFAULT_UUID;
    if (pathName.startsWith('/v1/admin/instructors/{id}')) return this.ctx.publicInstructorId || DEFAULT_UUID;
    if (pathName.startsWith('/v1/lessons/{id}')) return this.ctx.lessonId || DEFAULT_UUID;
    if (pathName.startsWith('/v1/disputes/{id}')) return this.ctx.disputeId || DEFAULT_UUID;
    if (pathName.startsWith('/v1/reviews/{id}')) return this.ctx.reviewId || DEFAULT_UUID;
    if (pathName.startsWith('/v1/admin/reviews/{id}')) return this.ctx.reviewId || DEFAULT_UUID;
    if (pathName.startsWith('/v1/notifications/{id}')) return this.ctx.notificationId || DEFAULT_UUID;
    if (pathName.startsWith('/v1/instructors/availability/{id}')) return this.ctx.availabilityId || DEFAULT_UUID;
    if (pathName.startsWith('/v1/instructors/linking/requests/{id}')) {
      return this.ctx.linkingRequestId || DEFAULT_UUID;
    }
    if (pathName.startsWith('/v1/parking/spot/{id}') || pathName.startsWith('/parking/spot/{id}')) {
      return this.ctx.parkingSpotId || 'camden:default-spot';
    }
    if (pathName.startsWith('/v1/parking/ingest/council/{id}') || pathName.startsWith('/parking/ingest/council/{id}')) {
      return this.ctx.councilId || 'camden';
    }
    return DEFAULT_UUID;
  }

  queryParamValue(param) {
    const name = param.name;
    const schema = this.resolveRefSchema(param.schema || {});
    if (Array.isArray(schema?.enum) && schema.enum.length > 0) return schema.enum[0];

    switch (name) {
      case 'surface':
        return 'find_instructor';
      case 'query':
        return 'colchester';
      case 'near':
        return `${this.ctx.geo.lat},${this.ctx.geo.lng}`;
      case 'radiusKm':
        return 25;
      case 'page':
        return 1;
      case 'limit':
        return 5;
      case 'refresh':
        return false;
      case 'corridorWidthM':
        return 45;
      case 'types':
        return 'traffic_light,zebra_crossing,stop_sign';
      case 'south':
        return this.ctx.bbox.south;
      case 'west':
        return this.ctx.bbox.west;
      case 'north':
        return this.ctx.bbox.north;
      case 'east':
        return this.ctx.bbox.east;
      case 'centreId':
        return this.ctx.centreSlugOrId || this.ctx.centreId;
      case 'month':
        return DEFAULT_MONTH;
      case 'lat':
        return this.ctx.geo.lat;
      case 'lng':
        return this.ctx.geo.lng;
      case 'radiusMeters':
        return 10000;
      case 'postcode':
        return 'EC1A 1BB';
      case 'city':
        return 'London';
      case 'location':
        return 'London';
      case 'transmissionType':
        return 'MANUAL';
      case 'language':
        return 'English';
      case 'minRating':
        return 1;
      case 'q':
        return 'lon';
      case 'scope':
        return 'all';
      case 'status':
        return 'OPEN';
      case 'reportedOnly':
        return false;
      case 'from':
        return monthStartISO();
      case 'to':
        return new Date().toISOString();
      case 'instructorId':
        return this.ctx.publicInstructorId || this.ctx.instructor?.id || DEFAULT_UUID;
      case 'lessonStatus':
        return 'COMPLETED';
      case 'commissionStatus':
        return 'PENDING';
      case 'payoutStatus':
        return 'PENDING';
      case 'min_lat':
        return this.ctx.bbox.south;
      case 'min_lon':
        return this.ctx.bbox.west;
      case 'max_lat':
        return this.ctx.bbox.north;
      case 'max_lon':
        return this.ctx.bbox.east;
      case 'at':
        return new Date().toISOString();
      case 'fee':
        return false;
      case 'accessible':
        return false;
      case 'center_lat':
        return this.ctx.geo.lat;
      case 'center_lon':
        return this.ctx.geo.lng;
      case 'radius_m':
        return 1200;
      case 'max_results':
        return 20;
      case 'unreadOnly':
        return false;
      case 'after':
        return '';
      case 'overdueOnly':
        return false;
      case 'platform':
        return 'ios';
      case 'module':
        return 'core';
      case 'kind':
        return 'general';
      case 'appVersion':
        return '1.0.0';
      default:
        return valueFromType(schema);
    }
  }

  buildFromSchema(schema, depth = 0) {
    if (!schema || depth > 4) return null;
    const resolved = this.resolveRefSchema(schema);
    if (!resolved) return null;

    if (resolved.example !== undefined) return resolved.example;
    if (resolved.default !== undefined) return resolved.default;
    if (Array.isArray(resolved.enum) && resolved.enum.length > 0) return resolved.enum[0];

    if (resolved.oneOf?.length) return this.buildFromSchema(resolved.oneOf[0], depth + 1);
    if (resolved.anyOf?.length) return this.buildFromSchema(resolved.anyOf[0], depth + 1);
    if (resolved.allOf?.length) {
      const merged = {};
      for (const item of resolved.allOf) {
        const built = this.buildFromSchema(item, depth + 1);
        if (built && typeof built === 'object' && !Array.isArray(built)) {
          Object.assign(merged, built);
        }
      }
      return merged;
    }

    switch (resolved.type) {
      case 'object': {
        const out = {};
        const props = resolved.properties || {};
        const required = new Set(resolved.required || []);
        for (const [k, v] of Object.entries(props)) {
          if (!required.has(k) && depth > 0) continue;
          out[k] = this.buildFromSchema(v, depth + 1);
        }
        return out;
      }
      case 'array':
        return [this.buildFromSchema(resolved.items || {}, depth + 1)];
      case 'string':
      case 'integer':
      case 'number':
      case 'boolean':
        return valueFromType(resolved);
      default:
        if (resolved.properties) return this.buildFromSchema({ ...resolved, type: 'object' }, depth + 1);
        return null;
    }
  }

  bodyOverride(method, pathName) {
    const key = `${method} ${pathName}`;

    if (key === 'POST /v1/auth/sign-up' || key === 'POST /auth/sign-up') {
      const id = this.makeIdentity('signup');
      return { email: id.email, password: id.password, name: id.name, role: 'USER' };
    }
    if (key === 'POST /auth/register') {
      const id = this.makeIdentity('register');
      return { email: id.email, password: id.password, name: id.name, role: 'USER' };
    }
    if (
      key === 'POST /v1/auth/sign-in' ||
      key === 'POST /auth/sign-in' ||
      key === 'POST /auth/login'
    ) {
      return {
        email: this.ctx.learner?.email || this.makeIdentity('fallback').email,
        password: this.ctx.learner?.password || 'StrongPass1',
      };
    }
    if (key === 'POST /v1/auth/forgot-password' || key === 'POST /auth/forgot-password') {
      return { email: this.ctx.learner?.email || this.makeIdentity('forgot').email };
    }
    if (key === 'POST /v1/auth/reset-password' || key === 'POST /auth/reset-password') {
      return { token: 'dummy-reset-token', password: 'StrongPass1', confirmPassword: 'StrongPass1' };
    }
    if (key === 'PATCH /me' || key === 'PATCH /v1/me') {
      return { name: 'Audit Learner Updated' };
    }
    if (key === 'PATCH /me/consents' || key === 'PATCH /v1/me/consents') {
      return { termsAccepted: true, privacyAccepted: true, marketingAccepted: false };
    }
    if (key === 'PATCH /me/push-token' || key === 'PATCH /v1/me/push-token') {
      return { pushToken: `audit-push-${Date.now()}`, platform: 'ios' };
    }
    if (key === 'POST /v1/legal/acceptance') {
      return { surface: 'find_instructor' };
    }
    if (key === 'POST /v1/legal/app/acceptance') {
      return { surface: 'find_instructor', version: '2026.04' };
    }
    if (key === 'POST /v1/legal/app/consents') {
      return { analytics: true, marketing: false, push: true };
    }
    if (
      key === 'POST /routes/{id}/practice/finish' ||
      key === 'POST /routes/app/{id}/practice/finish'
    ) {
      return { completed: true, distanceM: 1300, durationS: 540 };
    }
    if (
      key === 'POST /navigation/hazards/nearby' ||
      key === 'POST /navigation/app/hazards/nearby'
    ) {
      return {
        center: { lat: this.ctx.geo.lat, lng: this.ctx.geo.lng },
        centreId: this.ctx.centreSlugOrId,
        corridorWidthM: 45,
        lookaheadM: 500,
        limit: 10,
        routeId: this.ctx.routeId,
        types: ['TRAFFIC_SIGNAL', 'ZEBRA_CROSSING', 'STOP_SIGN'],
      };
    }
    if (
      key === 'POST /entitlements/app/select-centre' ||
      key === 'POST /v1/entitlements/app/select-centre'
    ) {
      return { centreId: this.ctx.centreSlugOrId };
    }
    if (key === 'POST /entitlements/app/subscribe' || key === 'POST /v1/entitlements/app/subscribe') {
      return { productId: 'centre_colchester_week_ios' };
    }
    if (
      key === 'POST /entitlements/app/subscribe/navigation-bundle' ||
      key === 'POST /v1/entitlements/app/subscribe/navigation-bundle'
    ) {
      return { productIds: ['navigation_monthly_ios'] };
    }
    if (
      key === 'POST /entitlements/app/apple/activate' ||
      key === 'POST /v1/entitlements/app/apple/activate'
    ) {
      return {
        productId: 'centre_colchester_week_ios',
        transactionId: `txn-${Date.now()}`,
        originalTransactionId: `otxn-${Date.now()}`,
        expiresAt: nowPlus(24 * 7),
      };
    }
    if (key === 'POST /cashback/submit') {
      return { amount: 5, evidence: 'audit' };
    }
    if (key === 'POST /webhooks/revenuecat') {
      return {
        event_id: `evt_${Date.now()}`,
        type: 'INITIAL_PURCHASE',
        app_user_id: this.ctx.learner?.id || DEFAULT_UUID,
        product_id: 'centre_colchester_week_ios',
        transaction_id: `txn_${Date.now()}`,
        purchased_at: new Date().toISOString(),
      };
    }
    if (key === 'POST /v1/admin/notifications/broadcast') {
      return { title: 'Audit Broadcast', message: 'API audit test message', target: 'all' };
    }
    if (key === 'POST /v1/instructors/profile') {
      return {
        fullName: this.ctx.instructor?.name || 'Audit Instructor',
        bio: 'Profile from full audit',
        transmissionType: 'MANUAL',
        hourlyRate: 35,
        location: {
          city: 'London',
          postcode: 'EC1A 1BB',
          lat: this.ctx.geo.lat,
          lng: this.ctx.geo.lng,
        },
        languages: ['English'],
      };
    }
    if (key === 'PATCH /v1/instructors/profile') {
      return { bio: 'Updated by full audit', hourlyRate: 40 };
    }
    if (key === 'POST /v1/instructors/availability') {
      return {
        startAt: nowPlus(24),
        endAt: nowPlus(25),
        timezone: 'UTC',
      };
    }
    if (key === 'POST /v1/instructors/linking/requests') {
      return { shareCode: 'ABCDEF' };
    }
    if (key === 'POST /v1/instructors/{id}/reviews') {
      return {
        rating: 5,
        comment: 'Audit review',
        lessonId: this.ctx.lessonId || DEFAULT_UUID,
      };
    }
    if (key === 'POST /v1/reviews/{id}/report') {
      return { reason: 'audit_report' };
    }
    if (key === 'POST /v1/lessons') {
      return {
        instructorId: this.ctx.publicInstructorId || this.ctx.instructor?.id || DEFAULT_UUID,
        startAt: nowPlus(48),
        endAt: nowPlus(49),
        pickupLocation: 'Audit Pickup Point',
        notes: 'Created during full API audit',
      };
    }
    if (key === 'PATCH /v1/lessons/{id}/status') {
      return { status: 'accepted' };
    }
    if (key === 'PATCH /v1/lessons/{id}/cancel') {
      return { reason: 'audit cancel check' };
    }
    if (key === 'PATCH /v1/lessons/{id}/reschedule') {
      return { startAt: nowPlus(72), endAt: nowPlus(73) };
    }
    if (key === 'POST /v1/lessons/{id}/payment/stripe/confirm') {
      return { sessionId: `cs_test_${Date.now()}` };
    }
    if (key === 'POST /v1/lessons/{id}/payment/apple/activate') {
      return { transactionId: `apple_txn_${Date.now()}` };
    }
    if (
      key === 'POST /v1/admin/reviews/{id}/flag' ||
      key === 'POST /v1/admin/reviews/{id}/hide' ||
      key === 'POST /v1/admin/reviews/{id}/remove' ||
      key === 'POST /v1/admin/reviews/{id}/restore'
    ) {
      return { reason: 'audit moderation action' };
    }
    if (key === 'POST /v1/admin/finance/repair') {
      return { dryRun: true };
    }
    if (
      key === 'POST /v1/parking/atlas/import/council' ||
      key === 'POST /parking/atlas/import/council'
    ) {
      return { councilId: this.ctx.councilId, source: 'audit', items: [] };
    }
    if (key === 'POST /v1/analytics/me/sync') {
      return {
        events: [
          {
            eventType: 'APP_OPEN',
            occurredAt: new Date().toISOString(),
            metadata: { source: 'full_api_audit' },
          },
        ],
      };
    }
    if (key === 'POST /v1/admin/content-packs/upsert') {
      return {
        platform: 'ios',
        module: 'core',
        kind: 'general',
        language: 'en',
        appVersion: '1.0.0',
        checksum: 'audit-checksum',
        url: 'https://example.com/content-pack.json',
      };
    }
    if (key === 'POST /v1/disputes') {
      return {
        lessonId: this.ctx.lessonId || DEFAULT_UUID,
        reason: 'AUDIT_TEST',
        description: 'Dispute created by full API audit',
      };
    }
    if (key === 'POST /v1/disputes/{id}/evidence') {
      return { type: 'text', value: 'Audit evidence payload' };
    }
    if (key === 'PATCH /v1/disputes/{id}/status') {
      return { status: 'RESOLVED', resolutionNote: 'Closed by full API audit' };
    }

    return null;
  }

  chooseBodyFromOpenApi(op) {
    const reqBody = op.requestBody;
    if (!reqBody) return { body: undefined, contentType: 'application/json' };
    const resolvedBody = reqBody.$ref
      ? this.spec.components?.requestBodies?.[reqBody.$ref.replace('#/components/requestBodies/', '')]
      : reqBody;
    const content = resolvedBody?.content || {};
    const contentType =
      (content['application/json'] && 'application/json') ||
      (content['application/x-www-form-urlencoded'] &&
        'application/x-www-form-urlencoded') ||
      Object.keys(content)[0] ||
      'application/json';
    const schema = content?.[contentType]?.schema;
    const autoBody = schema ? this.buildFromSchema(schema) : {};
    return { body: autoBody, contentType };
  }

  buildRequestForOperation(operation) {
    const { method, pathName, op } = operation;
    const params = (op.parameters || [])
      .map((p) => this.resolveRefParameter(p))
      .filter(Boolean);

    let resolvedPath = pathName.replace(/\{([^}]+)\}/g, (_, paramName) =>
      encodeURIComponent(String(this.pathParamValue(pathName, paramName))),
    );

    const query = {};
    const headers = {};

    for (const p of params) {
      if (p.in === 'query') {
        const val = this.queryParamValue(p);
        if (p.required || val !== undefined) query[p.name] = val;
      } else if (p.in === 'header') {
        if (p.name.toLowerCase() === 'x-revenuecat-signature') {
          headers[p.name] = 'audit-signature';
        } else {
          headers[p.name] = this.queryParamValue(p);
        }
      }
    }

    const token = this.pickTokenForOperation(method, pathName);
    if (token) headers.Authorization = `Bearer ${token}`;

    const overrideBody = this.bodyOverride(method, pathName);
    const { body: autoBody, contentType } = this.chooseBodyFromOpenApi(op);
    let body = overrideBody !== null ? overrideBody : autoBody;

    if (method === 'GET' || method === 'DELETE' || method === 'HEAD') {
      body = undefined;
    }

    if (pathName === '/webhooks/revenuecat' && body && typeof body === 'object') {
      const secret = process.env.REVENUECAT_WEBHOOK_SECRET || '';
      const bodyStr = JSON.stringify(body);
      if (secret) {
        headers['x-revenuecat-signature'] = crypto
          .createHmac('sha256', secret)
          .update(bodyStr)
          .digest('hex');
      } else {
        headers['x-revenuecat-signature'] = headers['x-revenuecat-signature'] || 'audit-signature';
      }
    }

    return { method, pathName: resolvedPath, query, headers, body, contentType };
  }

  updateContextFromResponse(result) {
    const { method, originalPath, response } = result;
    const items = normalizeItems(response.json);
    const obj = normalizeObject(response.json);

    if ((method === 'GET' && originalPath === '/centres') || originalPath === '/centres') {
      if (items.length > 0) {
        const c = items[0];
        this.ctx.centreId = c.id || c.slug || this.ctx.centreId;
        this.ctx.centreSlugOrId = c.slug || c.id || this.ctx.centreSlugOrId;
      }
    }

    if (
      method === 'GET' &&
      (originalPath === '/centres/{id}/routes' || originalPath === '/centres/{id}/routes')
    ) {
      if (items.length > 0 && items[0]?.id) this.ctx.routeId = items[0].id;
    }

    if (method === 'GET' && originalPath === '/v1/instructors/public') {
      if (items.length > 0) {
        const i = items[0];
        this.ctx.publicInstructorId = i.id || i.instructorId || this.ctx.publicInstructorId;
      }
    }

    if (method === 'POST' && originalPath === '/v1/instructors/availability') {
      if (obj?.id) this.ctx.availabilityId = obj.id;
      if (obj?.slot?.id) this.ctx.availabilityId = obj.slot.id;
    }

    if (method === 'POST' && originalPath === '/v1/instructors/linking/requests') {
      if (obj?.id) this.ctx.linkingRequestId = obj.id;
      if (obj?.requestId) this.ctx.linkingRequestId = obj.requestId;
    }

    if (method === 'POST' && originalPath === '/v1/lessons') {
      if (obj?.id) this.ctx.lessonId = obj.id;
      if (obj?.lesson?.id) this.ctx.lessonId = obj.lesson.id;
    }

    if (method === 'POST' && originalPath === '/v1/instructors/{id}/reviews') {
      if (obj?.id) this.ctx.reviewId = obj.id;
      if (obj?.review?.id) this.ctx.reviewId = obj.review.id;
    }

    if (method === 'GET' && originalPath === '/v1/notifications/my') {
      if (items.length > 0) this.ctx.notificationId = items[0].id || this.ctx.notificationId;
    }

    if (method === 'POST' && originalPath === '/v1/disputes') {
      if (obj?.id) this.ctx.disputeId = obj.id;
      if (obj?.dispute?.id) this.ctx.disputeId = obj.dispute.id;
    }

    if (
      method === 'GET' &&
      (originalPath === '/v1/parking/councils' || originalPath === '/parking/councils')
    ) {
      if (items.length > 0) {
        this.ctx.councilId =
          items[0].id || items[0].slug || items[0].councilId || this.ctx.councilId;
      }
    }

    if (method === 'GET' && (originalPath === '/v1/parking/search' || originalPath === '/parking/search')) {
      if (items.length > 0) this.ctx.parkingSpotId = items[0].id || this.ctx.parkingSpotId;
    }
  }

  async run() {
    await this.fetchSpec();
    await this.bootstrapIdentitiesAndContext();

    const operations = this.listOperations();
    for (let i = 0; i < operations.length; i += 1) {
      const op = operations[i];
      const reqSpec = this.buildRequestForOperation(op);
      let response;
      let requestError = null;
      try {
        response = await this.request(reqSpec);
      } catch (err) {
        requestError = err?.message || String(err);
        response = {
          status: 0,
          ok: false,
          text: '',
          json: null,
          headers: {},
          url: this.baseUrl + reqSpec.pathName,
          requestBody: reqSpec.body ? safeStringify(reqSpec.body) : '',
          requestHeaders: reqSpec.headers || {},
        };
      }

      const clippedText =
        response.text && response.text.length > MAX_RESPONSE_CHARS
          ? `${response.text.slice(0, MAX_RESPONSE_CHARS)}\n...<truncated>`
          : response.text;

      const rec = {
        index: i + 1,
        total: operations.length,
        method: op.method,
        originalPath: op.pathName,
        resolvedPath: reqSpec.pathName,
        tag: op.tag,
        operationId: op.operationId,
        request: {
          query: reqSpec.query,
          headers: {
            ...pick(response.requestHeaders || {}, ['content-type', 'accept']),
            authorization: maskToken(
              (response.requestHeaders || {}).Authorization ||
                (response.requestHeaders || {}).authorization ||
                '',
            ),
            'x-revenuecat-signature': (response.requestHeaders || {})['x-revenuecat-signature']
              ? 'present'
              : '',
          },
          body: reqSpec.body,
        },
        response: {
          status: response.status,
          ok: response.ok,
          headers: response.headers,
          bodyJson: response.json,
          bodyText: clippedText,
        },
        error: requestError,
      };

      this.results.push(rec);
      this.updateContextFromResponse(rec);
      console.log(
        `[${String(i + 1).padStart(3, '0')}/${operations.length}] ${op.method} ${op.pathName} -> ${response.status}`,
      );
    }
  }

  summary() {
    const byStatus = {};
    for (const r of this.results) {
      const key = String(r.response.status);
      byStatus[key] = (byStatus[key] || 0) + 1;
    }
    return byStatus;
  }

  buildReportMarkdown() {
    const byStatus = this.summary();
    const lines = [];
    lines.push('# Full API Audit (Single Consolidated Report)');
    lines.push(`- Generated At: ${new Date().toISOString()}`);
    lines.push(`- Base URL: ${this.baseUrl}`);
    lines.push(`- Total Documented Operations: ${this.results.length}`);
    lines.push(`- Learner: ${this.ctx.learner?.email || 'n/a'}`);
    lines.push(`- Instructor: ${this.ctx.instructor?.email || 'n/a'}`);
    lines.push(`- Admin: ${this.ctx.admin?.email || 'n/a'}`);
    lines.push('');
    lines.push('## Status Summary');
    for (const [status, count] of Object.entries(byStatus).sort((a, b) => Number(a[0]) - Number(b[0]))) {
      lines.push(`- ${status}: ${count}`);
    }
    lines.push('');
    lines.push('## Endpoint Matrix');
    lines.push('| # | Method | Path | Status | Tag |');
    lines.push('|---:|---|---|---:|---|');
    for (const r of this.results) {
      lines.push(
        `| ${r.index} | ${r.method} | \`${r.originalPath}\` | ${r.response.status} | ${r.tag} |`,
      );
    }
    lines.push('');
    lines.push('## Detailed Request/Response');

    for (const r of this.results) {
      lines.push('');
      lines.push(`### ${String(r.index).padStart(3, '0')}. ${r.method} ${r.originalPath}`);
      lines.push(`- Resolved path: \`${r.resolvedPath}\``);
      lines.push(`- Tag: \`${r.tag}\``);
      lines.push(`- OperationId: \`${r.operationId || 'n/a'}\``);
      lines.push(`- Status: \`${r.response.status}\``);
      if (r.error) lines.push(`- Request Error: \`${r.error}\``);

      lines.push('- Request headers:');
      lines.push('```json');
      lines.push(safeStringify(r.request.headers));
      lines.push('```');

      lines.push('- Request query:');
      lines.push('```json');
      lines.push(safeStringify(r.request.query || {}));
      lines.push('```');

      lines.push('- Request body:');
      lines.push('```json');
      lines.push(safeStringify(r.request.body));
      lines.push('```');

      lines.push('- Response headers:');
      lines.push('```json');
      lines.push(safeStringify(r.response.headers || {}));
      lines.push('```');

      if (r.response.bodyJson !== null) {
        lines.push('- Response body (json):');
        lines.push('```json');
        lines.push(safeStringify(r.response.bodyJson));
        lines.push('```');
      } else {
        lines.push('- Response body (text):');
        lines.push('```text');
        lines.push(r.response.bodyText || '');
        lines.push('```');
      }
    }

    return lines.join('\n');
  }
}

async function main() {
  const auditor = new FullSwaggerAuditor(BASE_URL);
  await auditor.run();
  const report = auditor.buildReportMarkdown();
  const outPath = path.resolve(process.cwd(), OUT_FILE);
  fs.writeFileSync(outPath, report, 'utf8');
  const summary = auditor.summary();
  console.log('\nDONE');
  console.log(`Report: ${outPath}`);
  console.log(`Total: ${auditor.results.length}`);
  console.log('Status counts:', JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error('FAILED', err?.stack || err?.message || String(err));
  process.exit(1);
});
