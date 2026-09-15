import {
  AlertTriangle,
  Check,
  Clock,
  Download,
  HardDrive,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { backupApi } from '../../api/client';
import { useTranslation } from '../../i18n';
import { useSettingsStore } from '../../store/settingsStore';
import { getApiErrorMessage } from '../../types';
import CustomSelect from '../shared/CustomSelect';
import { useToast } from '../shared/Toast';

const INTERVAL_OPTIONS = [
  { value: 'hourly', labelKey: 'backup.interval.hourly' },
  { value: 'daily', labelKey: 'backup.interval.daily' },
  { value: 'weekly', labelKey: 'backup.interval.weekly' },
  { value: 'monthly', labelKey: 'backup.interval.monthly' },
];

const KEEP_OPTIONS = [
  { value: 1, labelKey: 'backup.keep.1day' },
  { value: 3, labelKey: 'backup.keep.3days' },
  { value: 7, labelKey: 'backup.keep.7days' },
  { value: 14, labelKey: 'backup.keep.14days' },
  { value: 30, labelKey: 'backup.keep.30days' },
  { value: 0, labelKey: 'backup.keep.forever' },
];

const DAYS_OF_WEEK = [
  { value: 0, labelKey: 'backup.dow.sunday' },
  { value: 1, labelKey: 'backup.dow.monday' },
  { value: 2, labelKey: 'backup.dow.tuesday' },
  { value: 3, labelKey: 'backup.dow.wednesday' },
  { value: 4, labelKey: 'backup.dow.thursday' },
  { value: 5, labelKey: 'backup.dow.friday' },
  { value: 6, labelKey: 'backup.dow.saturday' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const DAYS_OF_MONTH = Array.from({ length: 28 }, (_, i) => i + 1);

export default function BackupPanel() {
  const [backups, setBackups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [restoringFile, setRestoringFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [autoSettings, setAutoSettings] = useState({
    enabled: false,
    interval: 'daily',
    keep_days: 7,
    hour: 2,
    day_of_week: 0,
    day_of_month: 1,
  });
  const [autoSettingsSaving, setAutoSettingsSaving] = useState(false);
  const [autoSettingsDirty, setAutoSettingsDirty] = useState(false);
  const [serverTimezone, setServerTimezone] = useState('');
  const [restoreConfirm, setRestoreConfirm] = useState(null); // { type: 'file'|'upload', filename, file? }
  const fileInputRef = useRef(null);
  const toast = useToast();
  const { t, language, locale } = useTranslation();
  const is12h = useSettingsStore((s) => s.settings.time_format) === '12h';

  const loadBackups = async () => {
    setIsLoading(true);
    try {
      const data = await backupApi.list();
      setBackups(data.backups || []);
    } catch {
      toast.error(t('backup.toast.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadAutoSettings = async () => {
    try {
      const data = await backupApi.getAutoSettings();
      setAutoSettings(data.settings);
      if (data.timezone) setServerTimezone(data.timezone);
    } catch (err) {
      console.error('Failed to load automatic backup settings:', err);
      toast.error(t('backup.toast.loadError'));
    }
  };

  useEffect(() => {
    loadBackups();
    loadAutoSettings();
  }, []);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await backupApi.create();
      toast.success(t('backup.toast.created'));
      await loadBackups();
    } catch {
      toast.error(t('backup.toast.createError'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestore = (filename) => {
    setRestoreConfirm({ type: 'file', filename });
  };

  const handleUploadRestore = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    e.target.value = '';
    setRestoreConfirm({ type: 'upload', filename: file.name, file });
  };

  const executeRestore = async () => {
    if (!restoreConfirm) return;
    const { type, filename, file } = restoreConfirm;
    setRestoreConfirm(null);

    if (type === 'file') {
      setRestoringFile(filename);
      try {
        await backupApi.restore(filename);
        toast.success(t('backup.toast.restored'));
        setTimeout(() => window.location.reload(), 1500);
      } catch (err: unknown) {
        toast.error(getApiErrorMessage(err, t('backup.toast.restoreError')));
        setRestoringFile(null);
      }
    } else {
      setIsUploading(true);
      try {
        await backupApi.uploadRestore(file);
        toast.success(t('backup.toast.restored'));
        setTimeout(() => window.location.reload(), 1500);
      } catch (err: unknown) {
        toast.error(getApiErrorMessage(err, t('backup.toast.uploadError')));
        setIsUploading(false);
      }
    }
  };

  const handleDelete = async (filename) => {
    if (!confirm(t('backup.confirm.delete', { name: filename }))) return;
    try {
      await backupApi.delete(filename);
      toast.success(t('backup.toast.deleted'));
      setBackups((prev) => prev.filter((b) => b.filename !== filename));
    } catch {
      toast.error(t('backup.toast.deleteError'));
    }
  };

  const handleAutoSettingsChange = (key, value) => {
    setAutoSettings((prev) => ({ ...prev, [key]: value }));
    setAutoSettingsDirty(true);
  };

  const handleSaveAutoSettings = async () => {
    setAutoSettingsSaving(true);
    try {
      const data = await backupApi.setAutoSettings(autoSettings);
      setAutoSettings(data.settings);
      setAutoSettingsDirty(false);
      toast.success(t('backup.toast.settingsSaved'));
    } catch {
      toast.error(t('backup.toast.settingsError'));
    } finally {
      setAutoSettingsSaving(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const opts: Intl.DateTimeFormatOptions = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      };
      if (serverTimezone) opts.timeZone = serverTimezone;
      return new Date(dateStr).toLocaleString(locale, opts);
    } catch {
      return dateStr;
    }
  };

  const isAuto = (filename) => filename.startsWith('auto-backup-');

  return (
    <div className="flex flex-col gap-6">
      {/* Manual Backups */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HardDrive className="h-5 w-5 text-gray-400" />
            <div>
              <h2 className="font-semibold text-content">{t('backup.title')}</h2>
              <p className="mt-1 text-xs text-content-muted">{t('backup.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadBackups}
              disabled={isLoading}
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100"
              title={t('backup.refresh')}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {/* Upload & Restore */}
            <input ref={fileInputRef} type="file" accept=".zip" className="hidden" onChange={handleUploadRestore} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              title={isUploading ? t('backup.uploading') : t('backup.upload')}
            >
              {isUploading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{isUploading ? t('backup.uploading') : t('backup.upload')}</span>
            </button>

            <button
              type="button"
              onClick={handleCreate}
              disabled={isCreating}
              className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 sm:px-4"
              title={isCreating ? t('backup.creating') : t('backup.create')}
            >
              {isCreating ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{isCreating ? t('backup.creating') : t('backup.create')}</span>
            </button>
          </div>
        </div>

        {isLoading && backups.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <div className="mr-2 h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-slate-700" />
            {t('common.loading')}
          </div>
        ) : backups.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <HardDrive className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">{t('backup.empty')}</p>
            <button type="button" onClick={handleCreate} className="mt-4 text-sm text-slate-700 hover:underline">
              {t('backup.createFirst')}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {backups.map((backup) => (
              <div key={backup.filename} className="flex items-center gap-4 py-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                  {isAuto(backup.filename) ? (
                    <RefreshCw className="h-4 w-4 text-blue-500" />
                  ) : (
                    <HardDrive className="h-4 w-4 text-gray-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-gray-900">{backup.filename}</p>
                    {isAuto(backup.filename) && (
                      <span className="whitespace-nowrap rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                        Auto
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3">
                    <span className="text-xs text-gray-400">{formatDate(backup.created_at)}</span>
                    <span className="text-xs text-gray-400">{formatSize(backup.size)}</span>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      backupApi.download(backup.filename).catch(() => toast.error(t('backup.toast.downloadError')))
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    {t('backup.download')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRestore(backup.filename)}
                    disabled={restoringFile === backup.filename}
                    className="flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                  >
                    {restoringFile === backup.filename ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    {t('backup.restore')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(backup.filename)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Auto-Backup Settings */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-6 flex items-center gap-3">
          <Clock className="h-5 w-5 text-gray-400" />
          <div>
            <h2 className="font-semibold text-content">{t('backup.auto.title')}</h2>
            <p className="mt-1 text-xs text-content-muted">{t('backup.auto.subtitle')}</p>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          {/* Enable toggle */}
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div className="min-w-0 text-sm font-medium text-gray-900">
              {t('backup.auto.enable')}
              <p className="mt-0.5 text-xs font-normal text-gray-500">{t('backup.auto.enableHint')}</p>
            </div>
            <button
              type="button"
              onClick={() => handleAutoSettingsChange('enabled', !autoSettings.enabled)}
              className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
              style={{ background: autoSettings.enabled ? 'var(--text-primary)' : 'var(--border-primary)' }}
            >
              <span
                className="absolute left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200"
                style={{ transform: autoSettings.enabled ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
          </label>

          {autoSettings.enabled && (
            <>
              {/* Interval */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">{t('backup.auto.interval')}</label>
                <div className="flex flex-wrap gap-2">
                  {INTERVAL_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => handleAutoSettingsChange('interval', opt.value)}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                        autoSettings.interval === opt.value
                          ? 'border-slate-700 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {t(opt.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hour picker (for daily, weekly, monthly) */}
              {autoSettings.interval !== 'hourly' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">{t('backup.auto.hour')}</label>
                  <CustomSelect
                    value={String(autoSettings.hour)}
                    onChange={(v) => handleAutoSettingsChange('hour', Number.parseInt(String(v), 10))}
                    size="sm"
                    options={HOURS.map((h) => {
                      let label: string;
                      if (is12h) {
                        const period = h >= 12 ? 'PM' : 'AM';
                        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                        label = `${h12}:00 ${period}`;
                      } else {
                        label = `${String(h).padStart(2, '0')}:00`;
                      }
                      return { value: String(h), label };
                    })}
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    {t('backup.auto.hourHint', { format: is12h ? '12h' : '24h' })}
                    {serverTimezone ? ` (Timezone: ${serverTimezone})` : ''}
                  </p>
                </div>
              )}

              {/* Day of week (for weekly) */}
              {autoSettings.interval === 'weekly' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">{t('backup.auto.dayOfWeek')}</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((opt) => (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => handleAutoSettingsChange('day_of_week', opt.value)}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          autoSettings.day_of_week === opt.value
                            ? 'border-slate-700 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {t(opt.labelKey)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Day of month (for monthly) */}
              {autoSettings.interval === 'monthly' && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">{t('backup.auto.dayOfMonth')}</label>
                  <CustomSelect
                    value={String(autoSettings.day_of_month)}
                    onChange={(v) => handleAutoSettingsChange('day_of_month', Number.parseInt(String(v), 10))}
                    size="sm"
                    options={DAYS_OF_MONTH.map((d) => ({ value: String(d), label: String(d) }))}
                  />
                  <p className="mt-1 text-xs text-gray-400">{t('backup.auto.dayOfMonthHint')}</p>
                </div>
              )}

              {/* Keep duration */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">{t('backup.auto.keepLabel')}</label>
                <div className="flex flex-wrap gap-2">
                  {KEEP_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => handleAutoSettingsChange('keep_days', opt.value)}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                        autoSettings.keep_days === opt.value
                          ? 'border-slate-700 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {t(opt.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Save button */}
          <div className="flex justify-end border-t border-gray-100 pt-2">
            <button
              type="button"
              onClick={handleSaveAutoSettings}
              disabled={autoSettingsSaving || !autoSettingsDirty}
              className="flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
            >
              {autoSettingsSaving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {autoSettingsSaving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </div>

      {/* Restore Warning Modal */}
      {restoreConfirm && (
        <div
          // Dismiss-on-backdrop is a mouse shortcut for the Cancel button below;
          // the backdrop itself carries no semantics of its own.
          role="presentation"
          className="bg-[rgba(0,0,0,0.5)]"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setRestoreConfirm(null)}
        >
          <div
            role="presentation"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 440, borderRadius: 16, overflow: 'hidden' }}
            className="border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
          >
            {/* Red header */}
            <div
              style={{
                background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                className="bg-[rgba(255,255,255,0.2)]"
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
                <AlertTriangle size={20} className="text-white" />
              </div>
              <div>
                <h3
                  className="text-white"
                  style={{ margin: 0, fontSize: 'calc(16px * var(--fs-scale-subtitle, 1))', fontWeight: 700 }}
                >
                  {t('backup.restoreConfirmTitle')}
                </h3>
                <p
                  className="text-[rgba(255,255,255,0.8)]"
                  style={{ margin: '2px 0 0', fontSize: 'calc(12px * var(--fs-scale-body, 1))' }}
                >
                  {restoreConfirm.filename}
                </p>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px' }}>
              <p
                className="text-gray-700 dark:text-gray-300"
                style={{ fontSize: 'calc(13px * var(--fs-scale-body, 1))', lineHeight: 1.6, margin: 0 }}
              >
                {t('backup.restoreWarning')}
              </p>

              <div
                style={{
                  marginTop: 14,
                  padding: '10px 12px',
                  borderRadius: 10,
                  fontSize: 'calc(12px * var(--fs-scale-body, 1))',
                  lineHeight: 1.5,
                }}
                className="border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"
              >
                {t('backup.restoreTip')}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '0 24px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setRestoreConfirm(null)}
                className="text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                style={{
                  padding: '9px 20px',
                  borderRadius: 10,
                  fontSize: 'calc(13px * var(--fs-scale-body, 1))',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={executeRestore}
                className="bg-[#dc2626] text-white"
                style={{
                  padding: '9px 20px',
                  borderRadius: 10,
                  fontSize: 'calc(13px * var(--fs-scale-body, 1))',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#b91c1c')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#dc2626')}
              >
                {t('backup.restoreConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
