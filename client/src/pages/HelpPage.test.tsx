import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '../../tests/helpers/render';
import type { HelpNavSection, HelpPageData } from '../api/client';
import HelpPage from './HelpPage';

// FE-PAGE-HELPUI-001 to FE-PAGE-HELPUI-018
//
// HelpPage is a wiring container over useHelp (covered in help/useHelp.test.ts):
// the hook is mocked here so every render branch — loading, error, markdown,
// search, mobile drawer, language switcher — can be driven directly.

type HelpState = ReturnType<typeof buildHelp>;

const mocks = vi.hoisted(() => ({ help: {} as Record<string, unknown> }));

vi.mock('./help/useHelp', () => ({ useHelp: () => mocks.help }));
vi.mock('../components/Layout/Navbar', () => ({
  default: () => React.createElement('nav', { 'data-testid': 'navbar' }),
}));

const setQuery = vi.fn((_v: string) => {});
const setNavOpen = vi.fn((_v: boolean) => {});
const setLang = vi.fn((_v: 'en' | 'zh') => {});

const SECTIONS: HelpNavSection[] = [
  {
    title: 'Getting started',
    pages: [
      { slug: 'Home', title: 'Home' },
      { slug: 'Install', title: 'Install' },
    ],
  },
  { title: '', pages: [{ slug: 'FAQ', title: 'FAQ' }] },
];

// Mirrors WIKI_LANGS in api/client.ts — the switcher renders from this, and a
// one-entry list must render nothing at all.
const LANGS = [
  { value: 'en' as const, label: 'English' },
  { value: 'zh' as const, label: '简体中文' },
];

function buildHelp(over: Record<string, unknown> = {}) {
  return {
    page: null as HelpPageData | null,
    loading: false,
    pageError: false,
    query: '',
    setQuery,
    navOpen: false,
    setNavOpen,
    contentRef: { current: null } as React.RefObject<HTMLDivElement | null>,
    activeSlug: 'Home',
    filtered: SECTIONS,
    lang: 'en' as const,
    setLang,
    availableLangs: LANGS,
    ...over,
  };
}

function setHelp(over: Record<string, unknown> = {}) {
  mocks.help = buildHelp(over) as unknown as Record<string, unknown>;
  return mocks.help as unknown as HelpState;
}

function page(markdown: string): HelpPageData {
  return { slug: 'Home', title: 'Home', markdown };
}

beforeEach(() => {
  setQuery.mockClear();
  setNavOpen.mockClear();
  setLang.mockClear();
  setHelp();
});

describe('HelpPage', () => {
  it('FE-PAGE-HELPUI-001: renders the desktop sidebar with section titles and page links', () => {
    setHelp();
    render(<HelpPage />);

    expect(screen.getByText('Help & Docs')).toBeInTheDocument();
    expect(screen.getByText('Getting started')).toBeInTheDocument();
    // The section with an empty title renders no heading, only its pages.
    expect(screen.getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '/help/FAQ');
    expect(screen.getByRole('link', { name: 'Install' })).toHaveAttribute('href', '/help/Install');
  });

  it('FE-PAGE-HELPUI-002: marks the active page and indents the inactive ones', () => {
    setHelp({ activeSlug: 'Install' });
    render(<HelpPage />);

    const active = screen.getByRole('link', { name: 'Install' });
    expect(active.className).toContain('text-accent');
    expect(active.querySelector('span')?.className).toBe('');

    const inactive = screen.getByRole('link', { name: 'FAQ' });
    expect(inactive.className).toContain('text-content-secondary');
    expect(inactive.querySelector('span')?.className).toContain('pl-[18px]');
  });

  it('FE-PAGE-HELPUI-003: typing in the search box reports the query upwards', () => {
    setHelp({ query: 'ins' });
    render(<HelpPage />);

    const input = screen.getByPlaceholderText('Search docs…');
    expect(input).toHaveValue('ins');
    fireEvent.change(input, { target: { value: 'inst' } });
    expect(setQuery).toHaveBeenCalledWith('inst');
  });

  it('FE-PAGE-HELPUI-004: an empty result set shows the no-results hint instead of links', () => {
    setHelp({ filtered: [], query: 'zzz' });
    render(<HelpPage />);

    expect(screen.getByText('No matching pages.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('FE-PAGE-HELPUI-005: shows a spinner while the page loads', () => {
    setHelp({ loading: true, page: page('# Ignored') });
    render(<HelpPage />);

    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ignored' })).toBeNull();
  });

  it('FE-PAGE-HELPUI-006: a failed fetch shows the error block, not the stale page', () => {
    setHelp({ pageError: true, page: page('# Stale') });
    render(<HelpPage />);

    expect(screen.getByText("Couldn't load this page")).toBeInTheDocument();
    expect(screen.getByText(/fetched from the TREK wiki/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Stale' })).toBeNull();
  });

  it('FE-PAGE-HELPUI-007: renders nothing in the content area when no page is loaded', () => {
    setHelp({ page: null });
    render(<HelpPage />);

    expect(document.querySelector('article.wiki-prose')).toBeNull();
    expect(document.querySelector('.animate-spin')).toBeNull();
  });

  it('FE-PAGE-HELPUI-008: the mobile drawer opens from the contents button', () => {
    setHelp();
    render(<HelpPage />);

    expect(screen.getAllByText('Help & Docs')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Contents' }));
    expect(setNavOpen).toHaveBeenCalledWith(true);
  });

  it('FE-PAGE-HELPUI-009: the open drawer closes on the backdrop and on its close button, but not on itself', () => {
    setHelp({ navOpen: true });
    render(<HelpPage />);

    // Nav is rendered twice while the drawer is open (sidebar + drawer).
    expect(screen.getAllByText('Help & Docs')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'FAQ' })).toHaveLength(2);

    const drawer = document.querySelector('.fixed.inset-0.z-\\[120\\]') as HTMLElement;
    const panel = drawer.querySelector('.shadow-xl') as HTMLElement;
    fireEvent.click(panel);
    expect(setNavOpen).not.toHaveBeenCalled();

    // The X button sits in the drawer header, before the nav.
    const closeBtn = panel.querySelector('button') as HTMLButtonElement;
    fireEvent.click(closeBtn);
    expect(setNavOpen).toHaveBeenCalledWith(false);

    setNavOpen.mockClear();
    fireEvent.click(drawer);
    expect(setNavOpen).toHaveBeenCalledWith(false);
  });

  it('FE-PAGE-HELPUI-010: renders headings with GitHub-compatible anchor ids', () => {
    setHelp({
      page: page(
        ['# Getting Started!', '', '## Trips & Days', '', '### Sub Heading', '', '#### Deep Heading'].join('\n')
      ),
    });
    render(<HelpPage />);

    expect(screen.getByRole('heading', { level: 1 }).id).toBe('getting-started');
    // "&" is punctuation and drops out; the surrounding spaces collapse into one hyphen.
    expect(screen.getByRole('heading', { level: 2 }).id).toBe('trips-days');
    // The sidebar section titles are h3s too, so match this one by its text.
    expect(screen.getByRole('heading', { name: 'Sub Heading' }).id).toBe('sub-heading');
    expect(screen.getByRole('heading', { level: 4 }).id).toBe('deep-heading');
  });

  it('FE-PAGE-HELPUI-019: Chinese headings get usable ids, not empty ones', () => {
    // `\w` in a JS regex is ASCII-only, so the original slug stripped a CJK
    // heading down to "". Every Chinese heading then collided on id="" and every
    // in-page anchor (#core-feature-names and friends) pointed at nothing.
    setHelp({
      page: page(['# 核心功能名', '', '## 通用界面词', '', '### 安装：Docker'].join('\n')),
    });
    render(<HelpPage />);

    // Scoped by name: the sidebar renders its own h3 section titles.
    expect(screen.getByRole('heading', { name: '核心功能名' }).id).toBe('核心功能名');
    expect(screen.getByRole('heading', { name: '通用界面词' }).id).toBe('通用界面词');
    // Punctuation still drops, and the ASCII part survives.
    expect(screen.getByRole('heading', { name: '安装：Docker' }).id).toBe('安装docker');
  });

  it('FE-PAGE-HELPUI-011: a heading built from inline markup drops the non-text children from its id', () => {
    setHelp({ page: page('## Trip **Planner** 2') });
    render(<HelpPage />);

    // "Planner" arrives as a <strong> element, so only the plain-text parts feed the slug.
    expect(screen.getByRole('heading', { level: 2 }).id).toBe('trip-2');
    expect(screen.getByText('Planner').tagName).toBe('STRONG');
  });

  it('FE-PAGE-HELPUI-012: routes internal links through the SPA router and opens external ones in a tab', () => {
    setHelp({
      page: page(
        ['[jump](#trips)', '', '[planner](/trips/1)', '', '[github](https://github.com/bhxnms/T-T)'].join('\n')
      ),
    });
    render(<HelpPage />);

    const anchor = screen.getByRole('link', { name: 'jump' });
    expect(anchor).toHaveAttribute('href', '#trips');
    expect(anchor).not.toHaveAttribute('target');

    // An internal link becomes a router <Link> — still an <a href>, but without target.
    expect(screen.getByRole('link', { name: 'planner' })).toHaveAttribute('href', '/trips/1');

    const external = screen.getByRole('link', { name: 'github' });
    expect(external).toHaveAttribute('target', '_blank');
    expect(external).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('FE-PAGE-HELPUI-013: styles lists, quotes, images, rules and both code flavours', () => {
    setHelp({
      page: page(
        [
          'Intro text.',
          '',
          '- first',
          '- second',
          '',
          '1. one',
          '2. two',
          '',
          '> quoted line',
          '',
          '![screenshot](/img/a.png)',
          '',
          'Use `npm run dev` to start.',
          '',
          '```bash',
          'npm test',
          '```',
          '',
          '---',
        ].join('\n')
      ),
    });
    render(<HelpPage />);

    expect(screen.getByText('Intro text.').tagName).toBe('P');
    expect(document.querySelector('ul.list-disc')).toBeInTheDocument();
    expect(document.querySelector('ol.list-decimal')).toBeInTheDocument();
    expect(screen.getByText('first').tagName).toBe('LI');
    expect(screen.getByText('quoted line').closest('blockquote')).toBeInTheDocument();
    expect(document.querySelector('hr')).toBeInTheDocument();

    const img = screen.getByRole('img', { name: 'screenshot' });
    expect(img.getAttribute('src')).toBe('/img/a.png');
    expect(img).toHaveAttribute('loading', 'lazy');

    // Inline code keeps the pill styling; a fenced block keeps its language class.
    expect(screen.getByText('npm run dev').className).toContain('bg-surface-tertiary');
    const block = screen.getByText('npm test');
    expect(block.className).toContain('language-bash');
    expect(block.closest('pre')?.className).toContain('overflow-x-auto');
  });

  it('FE-PAGE-HELPUI-014: renders GFM tables inside a horizontally scrollable wrapper', () => {
    setHelp({
      page: page(['| Key | Meaning |', '| --- | --- |', '| esc | close |'].join('\n')),
    });
    render(<HelpPage />);

    expect(screen.getByRole('columnheader', { name: 'Key' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'close' })).toBeInTheDocument();
    expect(screen.getByRole('table').parentElement?.className).toContain('overflow-x-auto');
  });

  it('FE-PAGE-HELPUI-015: an image without a target still renders with its alt text', () => {
    setHelp({ page: page('![alt only]()') });
    render(<HelpPage />);

    const img = screen.getByRole('img', { name: 'alt only' });
    expect(img.className).toContain('border-edge');
    expect(img.getAttribute('src')).toBeFalsy();
  });

  it('FE-PAGE-HELPUI-016: an .mp4 reference renders a looping muted video, not an image', () => {
    // Animated walkthroughs ship as MP4 rather than GIF. Authors keep writing
    // plain markdown image syntax; the extension picks the element.
    setHelp({ page: page('![drag a place onto a day](assets/DayItineraryAddPlaceDragging.mp4)') });
    render(<HelpPage />);

    const video = document.querySelector('video');
    expect(video).toBeTruthy();
    expect(video?.getAttribute('src')).toContain('DayItineraryAddPlaceDragging.mp4');
    // Behaves like the GIF it replaced: no controls, no sound, loops forever.
    expect(video?.hasAttribute('controls')).toBe(false);
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(screen.queryByRole('img', { name: /drag a place/i })).toBeNull();
  });

  it('FE-PAGE-HELPUI-017: the language switcher shows every shipped translation and reports the pick', () => {
    setHelp({ lang: 'en' });
    render(<HelpPage />);

    const group = screen.getByRole('group', { name: 'Wiki language' });
    const zh = within(group).getByRole('button', { name: '简体中文' });
    expect(within(group).getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    expect(zh).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(zh);
    expect(setLang).toHaveBeenCalledWith('zh');
  });

  it('FE-PAGE-HELPUI-018: a single-language wiki renders no switcher at all', () => {
    // A monolingual install must not show a dead control.
    setHelp({ availableLangs: [{ value: 'en', label: 'English' }] });
    render(<HelpPage />);

    expect(screen.queryByRole('group', { name: 'Wiki language' })).toBeNull();
  });
});
