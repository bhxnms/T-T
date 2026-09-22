/**
 * Help integration tests — /api/help served from the bundled `wiki/` directory.
 *
 * These run against the real repo wiki (no TREK_WIKI_DIR override) on purpose: the
 * point is to prove the shipped docs are reachable through the HTTP layer, which is
 * what a broken path or a wiki missing from the image would silently cost us.
 */
import { buildApp } from '../../src/bootstrap';
import { runMigrations } from '../../src/db/migrations';
import { createTables } from '../../src/db/schema';
import type { INestApplication } from '@nestjs/common';

import type { Application } from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const { testDb, dbMock } = vi.hoisted(() => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  return { testDb: db, dbMock: { db, closeDb: () => {}, reinitialize: () => {} } };
});

vi.mock('../../src/db/database', () => dbMock);
vi.mock('../../src/config', () => ({
  JWT_SECRET: 'test-jwt-secret-for-trek-testing-only',
  ENCRYPTION_KEY: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2',
  updateJwtSecret: () => {},
  SESSION_DURATION: '24h',
  SESSION_DURATION_MS: 86400000,
  SESSION_DURATION_SECONDS: 86400,
  DEFAULT_LANGUAGE: 'en',
}));
vi.mock('../../src/websocket', () => ({ broadcast: vi.fn(), broadcastToUser: vi.fn() }));

let nestApp: INestApplication;
let app: Application;
const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));

beforeAll(async () => {
  // Any outbound fetch here is a bug: help must be served from disk.
  vi.stubGlobal('fetch', fetchSpy);
  createTables(testDb);
  runMigrations(testDb);
  nestApp = await buildApp();
  app = nestApp.getHttpAdapter().getInstance();
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await nestApp?.close();
});

describe('GET /api/help', () => {
  it('returns the sidebar without authentication', async () => {
    const res = await request(app).get('/api/help/index').expect(200);

    expect(res.body.sections.length).toBeGreaterThan(0);
    expect(res.body.sections[0].pages[0]).toEqual({ title: expect.any(String), slug: expect.any(String) });
  });

  it('renders a real wiki page', async () => {
    const res = await request(app).get('/api/help/page/Home').expect(200);

    expect(res.body.slug).toBe('Home');
    expect(res.body.title.length).toBeGreaterThan(0);
    expect(res.body.markdown.length).toBeGreaterThan(0);
  });

  it('404s an unknown page', async () => {
    await request(app).get('/api/help/page/DefinitelyNotAPage').expect(404);
  });

  it('serves a wiki image from disk', async () => {
    const res = await request(app).get('/api/help/asset/assets/TripPlanner.png').expect(200);

    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['cache-control']).toContain('max-age=86400');
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('refuses to serve files outside the wiki directory', async () => {
    // Percent-encoded, because Express normalises a literal `../` away before the
    // controller sees it — this is the form that actually reaches the guard, since
    // the handler decodes the path itself off req.originalUrl.
    await request(app).get('/api/help/asset/assets/%2e%2e%2f%2e%2e%2fpackage.json').expect(404);
    await request(app).get('/api/help/asset/%2e%2e%2fserver%2f.env').expect(404);
  });

  it('never calls out to GitHub', () => {
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

/**
 * The wiki ships in more than one language. These run against the real trees, so
 * they prove the shipped Chinese docs are actually reachable — and, just as
 * importantly, that a page nobody has translated yet still serves the English
 * one instead of 404ing, which is what makes a partial translation safe to ship.
 */
describe('GET /api/help?lang', () => {
  const slugsOf = (body: any): string[] => body.sections.flatMap((s: any) => s.pages.map((p: any) => p.slug));

  it('serves the sidebar in the requested language, with slugs unchanged', async () => {
    const en = await request(app).get('/api/help/index').expect(200);
    const zh = await request(app).get('/api/help/index?lang=zh').expect(200);

    // Same shape and same page set — only the labels differ. The slug IS the
    // route, so it has to stay stable across languages.
    expect(zh.body.sections.length).toBe(en.body.sections.length);
    expect(slugsOf(zh.body)).toEqual(slugsOf(en.body));
    expect(zh.body.sections[0].title).not.toBe(en.body.sections[0].title);
    expect(zh.body.sections[0].pages[0].slug).toBe('Home');
  });

  it('serves a translated page when one exists', async () => {
    const zh = await request(app).get('/api/help/page/Translation-Glossary?lang=zh').expect(200);
    expect(zh.body.slug).toBe('Translation-Glossary');
    expect(zh.body.title).toMatch(/术语表/);
  });

  it('serves the translated page, not the English one, when both exist', async () => {
    const en = await request(app).get('/api/help/page/Home').expect(200);
    const zh = await request(app).get('/api/help/page/Home?lang=zh').expect(200);

    // Every shipped page is translated, so the interesting assertion is the
    // opposite of a fallback: zh must return the CHINESE page. A fallback that
    // fired too eagerly would hand an English body to a zh reader and still look
    // healthy from the status code alone.
    expect(zh.body.title).not.toBe(en.body.title);
    expect(zh.body.title).toMatch(/[\u4e00-\u9fff]/);
    expect(zh.body.markdown).not.toBe(en.body.markdown);
    // The rewritten links still carry the language, so navigation stays in zh.
    expect(zh.body.markdown).toMatch(/\?lang=zh/);
  });

  it('carries the language on the internal links it rewrites', async () => {
    const zh = await request(app).get('/api/help/page/Translation-Glossary?lang=zh').expect(200);
    const links = zh.body.markdown.match(/\]\(\/help\/[^)]+\)/g) ?? [];
    expect(links.length).toBeGreaterThan(0);
    // Every rewritten internal link has to carry ?lang=zh, or following one drops
    // the reader back into English.
    for (const link of links) expect(link, link).toContain('?lang=zh');
  });

  it('never adds the param for English, keeping the plain URL canonical', async () => {
    const en = await request(app).get('/api/help/page/Home').expect(200);
    expect(en.body.markdown).not.toMatch(/\]\(\/help\/[^)]*\?lang=/);
  });

  it('ignores an unknown language instead of failing', async () => {
    const res = await request(app).get('/api/help/index?lang=klingon').expect(200);
    const en = await request(app).get('/api/help/index').expect(200);
    expect(res.body.sections[0].title).toBe(en.body.sections[0].title);
  });

  it('serves a language-neutral asset to a translated page', async () => {
    // The Portainer screenshots are third-party UI we cannot re-shoot, so they
    // exist only in the English tree. A zh page referencing one must still work.
    const res = await request(app).get('/api/help/asset/assets/TripPlanner.png?lang=zh').expect(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('still never calls out to GitHub', () => {
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
