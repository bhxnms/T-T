import { Public } from '../auth/public.decorator';
import {
  getWikiIndex,
  getWikiPage,
  getWikiAsset,
  isLocalWiki,
  normalizeWikiLang,
  WikiNotFound,
  type WikiPage,
  type WikiNavSection,
} from './wiki';
import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';

import type { Request, Response } from 'express';

/**
 * /api/help — embedded wiki, served from the `wiki/` directory that ships with
 * the app (see wiki.ts for the GitHub fallback). Content is public docs, so these
 * endpoints are unauthenticated; that also lets <img> tags load the proxied
 * assets without sending credentials.
 *
 * Every endpoint takes an optional `?lang=`, defaulting to English. Untranslated
 * pages fall back to English inside wiki.ts, so the client can ask for a language
 * without having to know which pages exist in it.
 */
@Public('help assets are loaded by <img> and <a>, which cannot send credentials')
@Controller('api/help')
export class HelpController {
  @Get('index')
  index(@Query('lang') lang?: string): Promise<{ sections: WikiNavSection[] }> {
    return getWikiIndex(normalizeWikiLang(lang));
  }

  @Get('page/:slug')
  async page(
    @Param('slug') slug: string,
    @Query('lang') lang: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const page: WikiPage = await getWikiPage(slug, normalizeWikiLang(lang));
      res.json(page);
    } catch (err) {
      res.status(err instanceof WikiNotFound ? 404 : 502).json({ error: 'Help page unavailable' });
    }
  }

  @Get('asset/*')
  async asset(@Req() req: Request, @Res() res: Response): Promise<void> {
    // Take everything after `/asset/` straight from the URL — the Express
    // wildcard param isn't reliably populated through the Nest adapter.
    const after = (req.originalUrl || req.url).split('/asset/')[1] ?? '';
    const [rawPath, rawQuery] = after.split('?');
    const assetPath = decodeURIComponent(rawPath);
    const lang = normalizeWikiLang(new URLSearchParams(rawQuery ?? '').get('lang'));
    try {
      const { buf, type } = await getWikiAsset(assetPath, lang);
      res.setHeader('Content-Type', type);
      // Bundled assets are pinned to this build, so they can be cached hard; the
      // GitHub fallback refreshes hourly, so match that TTL instead.
      res.setHeader('Cache-Control', isLocalWiki(lang) ? 'public, max-age=86400' : 'public, max-age=3600');
      res.end(buf);
    } catch {
      res.status(404).end();
    }
  }
}
