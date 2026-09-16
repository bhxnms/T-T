import { BookOpen, Bug, Calendar, ChevronDown, ChevronUp, ExternalLink, Lightbulb, Loader2, Tag } from 'lucide-react';
import { useEffect, useState } from 'react';
import apiClient from '../../api/client';
import { getLocaleForLanguage, useTranslation } from '../../i18n';

const REPO = 'bhxnms/T-T';
const PER_PAGE = 10;

interface GithubRelease {
  id: number;
  prerelease: boolean;
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string | null;
  created_at: string;
  author: { login: string } | null;
  [key: string]: unknown;
}

export default function GitHubPanel({ isPrerelease = false }: { isPrerelease?: boolean }) {
  const { t, language } = useTranslation();
  const [releases, setReleases] = useState<GithubRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const MAX_PAGES_PER_LOAD = 5;
  const fetchReleases = async (startPage = 1, append = false) => {
    try {
      const collected: GithubRelease[] = [];
      let pageNum = startPage;
      let hasMorePages = true;
      for (let i = 0; i < MAX_PAGES_PER_LOAD; i += 1) {
        const res = await apiClient.get(`/admin/github-releases`, { params: { per_page: PER_PAGE, page: pageNum } });
        const data = Array.isArray(res.data) ? res.data : [];
        const visible = data.filter((release: GithubRelease) => isPrerelease || !release.prerelease);
        collected.push(...visible);
        hasMorePages = data.length === PER_PAGE;
        if (!hasMorePages || isPrerelease || visible.length > 0) break;
        pageNum += 1;
      }
      setReleases((prev) => (append ? [...prev, ...collected] : collected));
      setHasMore(hasMorePages);
      setPage(pageNum);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  useEffect(() => {
    setLoading(true);
    void fetchReleases(1).finally(() => setLoading(false));
    // Release filtering is selected when the panel mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPrerelease]);

  const handleLoadMore = async () => {
    const next = page + 1;
    setLoadingMore(true);
    await fetchReleases(next, true);
    setLoadingMore(false);
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(getLocaleForLanguage(language), { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Simple markdown-to-html for release notes (handles headers, bold, lists, links)
  const renderBody = (body) => {
    if (!body) return null;
    const lines = body.split('\n');
    const elements = [];
    let listItems = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`ul-${elements.length}`} className="my-2 space-y-1">
            {listItems.map((item, i) => (
              <li key={i} className="flex gap-2 text-xs text-content-muted">
                <span
                  className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full"
                  style={{ background: 'var(--text-faint)' }}
                />
                <span dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
              </li>
            ))}
          </ul>
        );
        listItems = [];
      }
    };

    const escapeHtml = (str) =>
      str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const inlineFormat = (text) => {
      return escapeHtml(text)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(
          /`(.+?)`/g,
          '<code style="font-size:11px;padding:1px 4px;border-radius:4px;background:var(--bg-secondary)">$1</code>'
        )
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
          const safeUrl = url.startsWith('http://') || url.startsWith('https://') ? url : '#';
          return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" style="color:#3b82f6;text-decoration:underline">${label}</a>`;
        });
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        flushList();
        continue;
      }

      if (trimmed.startsWith('### ')) {
        flushList();
        elements.push(
          <h4 key={elements.length} className="mb-1 mt-3 text-xs font-semibold text-content">
            {trimmed.slice(4)}
          </h4>
        );
      } else if (trimmed.startsWith('## ')) {
        flushList();
        elements.push(
          <h3 key={elements.length} className="mb-1 mt-3 text-sm font-semibold text-content">
            {trimmed.slice(3)}
          </h3>
        );
      } else if (/^[-*] /.test(trimmed)) {
        listItems.push(trimmed.slice(2));
      } else {
        flushList();
        elements.push(
          <p
            key={elements.length}
            className="my-1 text-xs text-content-muted"
            dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed) }}
          />
        );
      }
    }
    flushList();
    return elements;
  };

  return (
    <div className="space-y-3">
      {/* TT project information */}
      <div className="rounded-xl border border-edge bg-surface-card px-5 py-4">
        <div className="text-sm font-semibold text-content">Tourism-Team (TT)</div>
        <p className="mt-1 text-xs text-content-muted">
          TT 是基于 TREK 开源项目分支开发的旅行规划与活动管理工具，由 TT 团队持续维护。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <a
          href="https://github.com/bhxnms/T-T/issues/new?template=bug_report.yml"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 overflow-hidden rounded-xl border border-edge bg-surface-card px-5 py-4 no-underline transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]"
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#ef4444';
            e.currentTarget.style.boxShadow = '0 0 0 1px #ef444422';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-primary)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div
            className="bg-[#ef444415]"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Bug size={20} className="text-[#ef4444]" />
          </div>
          <div>
            <div className="text-sm font-semibold text-content">{t('settings.about.reportBug')}</div>
            <div className="text-xs text-content-faint">{t('settings.about.reportBugHint')}</div>
          </div>
          <ExternalLink size={14} className="ml-auto flex-shrink-0 text-content-faint" />
        </a>
        <a
          href="https://github.com/bhxnms/T-T/discussions"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 overflow-hidden rounded-xl border border-edge bg-surface-card px-5 py-4 no-underline transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]"
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#f59e0b';
            e.currentTarget.style.boxShadow = '0 0 0 1px #f59e0b22';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-primary)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div
            className="bg-[#f59e0b15]"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Lightbulb size={20} className="text-[#f59e0b]" />
          </div>
          <div>
            <div className="text-sm font-semibold text-content">{t('settings.about.featureRequest')}</div>
            <div className="text-xs text-content-faint">{t('settings.about.featureRequestHint')}</div>
          </div>
          <ExternalLink size={14} className="ml-auto flex-shrink-0 text-content-faint" />
        </a>
        <a
          href="https://github.com/bhxnms/T-T/wiki"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 overflow-hidden rounded-xl border border-edge bg-surface-card px-5 py-4 no-underline transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]"
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#6366f1';
            e.currentTarget.style.boxShadow = '0 0 0 1px #6366f122';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-primary)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div
            className="bg-[#6366f115]"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <BookOpen size={20} className="text-[#6366f1]" />
          </div>
          <div>
            <div className="text-sm font-semibold text-content">Wiki</div>
            <div className="text-xs text-content-faint">{t('settings.about.wikiHint')}</div>
          </div>
          <ExternalLink size={14} className="ml-auto flex-shrink-0 text-content-faint" />
        </a>
      </div>

      {/* Loading / Error / Releases */}
      {loading ? (
        <div className="overflow-hidden rounded-xl border border-edge bg-surface-card">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-content-muted" />
          </div>
        </div>
      ) : error ? (
        <div className="overflow-hidden rounded-xl border border-edge bg-surface-card">
          <div className="p-6 text-center">
            <p className="text-sm text-content-muted">{t('admin.github.error')}</p>
            <p className="mt-1 text-xs text-content-faint">{error}</p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-edge bg-surface-card">
          <div className="flex items-center justify-between border-b border-edge-secondary px-5 py-4">
            <div>
              <h2 className="font-semibold text-content">{t('admin.github.title')}</h2>
              <p className="mt-0.5 text-xs text-content-faint">{t('admin.github.subtitle').replace('{repo}', REPO)}</p>
            </div>
            <a
              href={`https://github.com/${REPO}/releases`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-surface-secondary px-3 py-1.5 text-xs font-medium text-content-muted transition-colors"
            >
              <ExternalLink size={12} />
              GitHub
            </a>
          </div>

          {/* Timeline */}
          <div className="px-5 py-4">
            <div className="relative">
              {/* Timeline line */}
              <div
                className="absolute bottom-3 left-[11px] top-3 w-px"
                style={{ background: 'var(--border-primary)' }}
              />

              <div className="space-y-0">
                {(isPrerelease ? releases : releases.filter((r) => !r.prerelease)).map((release, idx) => {
                  const isLatest = idx === 0;
                  const isExpanded = expanded[release.id];

                  return (
                    <div key={release.id} className="relative pb-5 pl-8">
                      {/* Timeline dot */}
                      <div
                        className="absolute left-0 top-1 flex h-[23px] w-[23px] items-center justify-center rounded-full border-2"
                        style={{
                          background: isLatest ? 'var(--text-primary)' : 'var(--bg-card)',
                          borderColor: isLatest ? 'var(--text-primary)' : 'var(--border-primary)',
                        }}
                      >
                        <Tag size={10} style={{ color: isLatest ? 'var(--bg-card)' : 'var(--text-faint)' }} />
                      </div>

                      {/* Release content */}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-content">{release.tag_name}</span>
                          {isLatest && (
                            <span className="rounded-full bg-[rgba(34,197,94,0.12)] px-2 py-0.5 text-[10px] font-semibold text-[#16a34a]">
                              {t('admin.github.latest')}
                            </span>
                          )}
                          {release.prerelease && (
                            <span className="rounded-full bg-[rgba(245,158,11,0.12)] px-2 py-0.5 text-[10px] font-semibold text-[#d97706]">
                              {t('admin.github.prerelease')}
                            </span>
                          )}
                        </div>

                        {release.name && release.name !== release.tag_name && (
                          <p className="mt-0.5 text-xs font-medium text-content-muted">{release.name}</p>
                        )}

                        <div className="mt-1 flex items-center gap-3">
                          <span className="flex items-center gap-1 text-[11px] text-content-faint">
                            <Calendar size={10} />
                            {formatDate(release.published_at || release.created_at)}
                          </span>
                          {release.author && (
                            <span className="text-[11px] text-content-faint">
                              {t('admin.github.by')} {release.author.login}
                            </span>
                          )}
                        </div>

                        {/* Expandable body */}
                        {release.body && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => toggleExpand(release.id)}
                              className="flex items-center gap-1 text-[11px] font-medium text-content-muted transition-colors"
                            >
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              {isExpanded ? t('admin.github.hideDetails') : t('admin.github.showDetails')}
                            </button>

                            {isExpanded && (
                              <div className="mt-2 rounded-lg bg-surface-secondary p-3">{renderBody(release.body)}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 rounded-lg bg-surface-secondary px-4 py-2 text-xs font-medium text-content-muted transition-colors"
                >
                  {loadingMore ? <Loader2 size={12} className="animate-spin" /> : <ChevronDown size={12} />}
                  {loadingMore ? t('admin.github.loading') : t('admin.github.loadMore')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
