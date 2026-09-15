import { ArrowUpCircle, Download, ExternalLink, RefreshCw } from 'lucide-react';
import React from 'react';
import type { TranslationFn } from '../../types';
import type { UpdateInfo } from './adminModel';

interface AdminUpdateBannerProps {
  updateInfo: UpdateInfo;
  t: TranslationFn;
  onHowTo: () => void;
  onCheck?: () => void;
  checking?: boolean;
}

// The "new version available" banner shown at the top of the admin page.
// Purely presentational — extracted from AdminPage with identical markup.
export default function AdminUpdateBanner({
  updateInfo,
  t,
  onHowTo,
  onCheck = () => {},
  checking = false,
}: AdminUpdateBannerProps): React.ReactElement {
  return (
    <div className="mb-6 flex flex-col items-start gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 dark:bg-amber-600">
          <ArrowUpCircle className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{t('admin.update.available')}</p>
          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
            {t('admin.update.text')
              .replace('{version}', `v${updateInfo.latest}`)
              .replace('{current}', `v${updateInfo.current}`)}
          </p>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        {updateInfo.release_url && (
          <a
            href={updateInfo.release_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-amber-300 px-3 py-2 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-900/50"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t('admin.update.button')}
          </a>
        )}
        <button
          type="button"
          onClick={onCheck}
          disabled={checking}
          className="flex items-center gap-1.5 rounded-lg border border-amber-300 px-3 py-2 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-900/50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
          {t('admin.update.checkNow')}
        </button>
        <button
          type="button"
          onClick={onHowTo}
          className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-gray-200"
        >
          <Download className="h-4 w-4" />
          {t('admin.update.howTo')}
        </button>
      </div>
    </div>
  );
}
