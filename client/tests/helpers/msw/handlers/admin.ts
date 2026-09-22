import { http, HttpResponse } from 'msw';
import { buildUser, buildAdmin } from '../../factories';

export const adminHandlers = [
  http.get('/api/admin/users', () => {
    const user1 = buildUser({ username: 'alice', email: 'alice@example.com' });
    const admin1 = buildAdmin({ username: 'admin', email: 'admin@example.com' });
    return HttpResponse.json({ users: [admin1, user1] });
  }),

  http.post('/api/admin/users', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const user = buildUser({ ...body });
    return HttpResponse.json({ user });
  }),

  http.put('/api/admin/users/:id', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const user = buildUser({ id: Number(params.id), ...body });
    return HttpResponse.json({ user });
  }),

  http.delete('/api/admin/users/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  http.get('/api/admin/stats', () => {
    return HttpResponse.json({
      totalUsers: 2,
      totalTrips: 5,
      totalPlaces: 42,
      totalFiles: 8,
    });
  }),

  http.get('/api/admin/invites', () => {
    return HttpResponse.json({ invites: [] });
  }),

  http.post('/api/admin/invites', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ invite: { id: 1, token: 'test-invite-token', ...body } });
  }),

  http.delete('/api/admin/invites/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  http.get('/api/admin/oidc', () => {
    return HttpResponse.json({
      issuer: '',
      client_id: '',
      client_secret: '',
      client_secret_set: false,
      display_name: '',
      oidc_only: false,
      discovery_url: '',
    });
  }),

  http.put('/api/admin/oidc', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ ...body });
  }),

  http.get('/api/admin/version-check', () => {
    return HttpResponse.json({ update_available: false, latest: '1.0.0', current: '1.0.0' });
  }),

  http.get('/api/admin/bag-tracking', () => {
    return HttpResponse.json({ enabled: false });
  }),

  http.put('/api/admin/bag-tracking', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ enabled: body.enabled });
  }),

  http.get('/api/admin/addons', () => {
    return HttpResponse.json({ addons: [] });
  }),

  http.get('/api/admin/packing-templates', () => {
    return HttpResponse.json({ templates: [] });
  }),

  http.get('/api/admin/audit-log', () => {
    return HttpResponse.json({ logs: [], total: 0 });
  }),

  http.get('/api/admin/mcp-tokens', () => {
    return HttpResponse.json({ tokens: [] });
  }),

  http.get('/api/admin/oauth-sessions', () => {
    return HttpResponse.json({ sessions: [] });
  }),

  http.delete('/api/admin/oauth-sessions/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  http.delete('/api/admin/mcp-tokens/:id', () => {
    return HttpResponse.json({ success: true });
  }),

  // The endpoint answers an ARRAY of action descriptors (the server maps
  // PERMISSION_ACTIONS through a projection carrying key/level/defaultLevel/
  // allowedLevels). It used to answer `{}` here, and because PermissionsPanel
  // mounts on the admin page and does `entries.map(...)`, every AdminPage test
  // crashed on "entries.map is not a function" — surfacing as a blank page and a
  // 5s waitFor timeout, which read like a slow machine rather than a bad stub.
  http.get('/api/admin/permissions', () => {
    return HttpResponse.json({
      permissions: [
        { key: 'trip_create', level: 'everybody', defaultLevel: 'everybody', allowedLevels: ['admin', 'everybody'] },
        { key: 'trip_edit', level: 'trip_owner', defaultLevel: 'trip_owner', allowedLevels: ['trip_owner', 'trip_member'] },
        { key: 'file_upload', level: 'trip_member', defaultLevel: 'trip_member', allowedLevels: ['admin', 'trip_owner', 'trip_member'] },
      ],
    });
  }),

  // The admin page's feature toggles. Each one is a separate GET fired on mount,
  // and without a handler MSW lets the request fall through to the network, where
  // it hangs until axios' 8s timeout. A full parallel run has ~660 files competing
  // for CPU, so those pending requests starved the stats render past the 5s
  // `waitFor` ceiling and the stats assertion failed — intermittently, and only
  // under load, which is what made it read as flakiness rather than a missing stub.
  //
  // One handler per path rather than a shared wildcard: the shapes differ, and a
  // wildcard would silently answer endpoints that should 404 in a test.
  ...['photos', 'autocomplete', 'details', 'enrich'].map((feature) =>
    http.get(`/api/admin/places-${feature}`, () => HttpResponse.json({ enabled: true })),
  ),
  http.get('/api/admin/amap-search', () => HttpResponse.json({ enabled: false })),
  http.get('/api/admin/bag-tracking', () => HttpResponse.json({ enabled: false })),
  http.get('/api/admin/collab-features', () =>
    HttpResponse.json({ chat: true, notes: true, polls: true, whatsnext: true }),
  ),

  http.get('/api/admin/notification-preferences', () => {
    return HttpResponse.json({
      event_types: [],
      available_channels: {},
      implemented_combos: {},
      preferences: {},
    });
  }),

  // Auth settings endpoints used by AdminPage
  http.get('/api/auth/app-settings', () => {
    return HttpResponse.json({});
  }),

  http.put('/api/auth/app-settings', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ ...body });
  }),

  http.get('/api/auth/me/settings', () => {
    return HttpResponse.json({ settings: { maps_api_key: '', openweather_api_key: '' } });
  }),

  http.get('/api/auth/validate-keys', () => {
    return HttpResponse.json({ maps: true, weather: true });
  }),
];
