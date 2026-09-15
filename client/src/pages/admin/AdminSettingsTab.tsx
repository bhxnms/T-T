import { AlertTriangle, CheckCircle, Eye, EyeOff, Loader2, RefreshCw, Save, Sun, XCircle } from 'lucide-react';
import React from 'react';
import { adminApi, authApi } from '../../api/client';
import ToggleSwitch from '../../components/Settings/ToggleSwitch';
import type { TranslationFn } from '../../types';
import { getApiErrorMessage } from '../../types';
import type { useAdmin } from './useAdmin';

interface AdminSettingsTabProps {
  admin: ReturnType<typeof useAdmin>;
  t: TranslationFn;
}

// "Settings" admin tab: auth methods, require-MFA, allowed file types, API keys,
// OIDC config and the danger zone. Pure layout around the useAdmin hook.
export default function AdminSettingsTab({ admin, t }: AdminSettingsTabProps): React.ReactElement {
  const {
    toast,
    setPlacesPhotosEnabled,
    setPlacesAutocompleteEnabled,
    setPlacesDetailsEnabled,
    setPlacesEnrichEnabled,
    placesPhotosEnabled,
    setPlacesPhotosEnabledState,
    placesAutocompleteEnabled,
    setPlacesAutocompleteEnabledState,
    placesDetailsEnabled,
    setPlacesDetailsEnabledState,
    placesEnrichEnabled,
    setPlacesEnrichEnabledState,
    oidcConfig,
    setOidcConfig,
    savingOidc,
    setSavingOidc,
    passwordLogin,
    setPasswordLogin,
    passwordRegistration,
    setPasswordRegistration,
    oidcLogin,
    setOidcLogin,
    oidcRegistration,
    setOidcRegistration,
    envOverrideOidcOnly,
    oidcConfigured,
    requireMfa,
    passkeyLogin,
    setPasskeyLogin,
    passkeyConfigured,
    webauthnRpId,
    setWebauthnRpId,
    webauthnOrigins,
    setWebauthnOrigins,
    savingWebauthn,
    handleSaveWebauthn,
    allowedFileTypes,
    setAllowedFileTypes,
    savingFileTypes,
    setSavingFileTypes,
    mapsKey,
    setMapsKey,
    unsplashKey,
    setUnsplashKey,
    amapKey,
    setAmapKey,
    amapSearchEnabledState,
    setAmapSearchEnabledState,
    showKeys,
    savingKeys,
    validating,
    validation,
    managed,
    setShowRotateJwtModal,
    handleToggleAuthSetting,
    handleToggleRequireMfa,
    toggleKey,
    handleSaveApiKeys,
    handleValidateKey,
  } = admin;

  return (
    <div className="space-y-6">
      {/* Authentication Methods */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-slate-900">{t('admin.authMethods')}</h2>
        </div>
        <div className="space-y-5 p-6">
          {envOverrideOidcOnly && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-600">
              {t('admin.envOverrideHint')}
            </p>
          )}
          {/* Password Login */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">{t('admin.passwordLogin')}</p>
              <p className="mt-0.5 text-xs text-slate-400">{t('admin.passwordLoginHint')}</p>
            </div>
            <button
              type="button"
              disabled={envOverrideOidcOnly || (!passwordLogin && !oidcLogin)}
              onClick={() => handleToggleAuthSetting('password_login', !passwordLogin, setPasswordLogin)}
              title={!passwordLogin && !oidcLogin ? t('admin.lockoutWarning') : undefined}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${passwordLogin ? 'bg-content' : 'bg-edge'}`}
            >
              <span
                className="absolute left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200"
                style={{ transform: passwordLogin ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
          </div>
          {/* Password Registration */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">{t('admin.passwordRegistration')}</p>
              <p className="mt-0.5 text-xs text-slate-400">{t('admin.passwordRegistrationHint')}</p>
            </div>
            <button
              type="button"
              disabled={envOverrideOidcOnly}
              onClick={() =>
                handleToggleAuthSetting('password_registration', !passwordRegistration, setPasswordRegistration)
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${passwordRegistration ? 'bg-content' : 'bg-edge'}`}
            >
              <span
                className="absolute left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200"
                style={{ transform: passwordRegistration ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
          </div>
          {/* SSO Login (only when OIDC configured) */}
          {oidcConfigured && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">{t('admin.oidcLogin')}</p>
                <p className="mt-0.5 text-xs text-slate-400">{t('admin.oidcLoginHint')}</p>
              </div>
              <button
                type="button"
                disabled={!passwordLogin && oidcLogin}
                onClick={() => handleToggleAuthSetting('oidc_login', !oidcLogin, setOidcLogin)}
                title={!passwordLogin && oidcLogin ? t('admin.lockoutWarning') : undefined}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${oidcLogin ? 'bg-content' : 'bg-edge'}`}
              >
                <span
                  className="absolute left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200"
                  style={{ transform: oidcLogin ? 'translateX(20px)' : 'translateX(0)' }}
                />
              </button>
            </div>
          )}
          {/* SSO Registration (only when OIDC configured) */}
          {oidcConfigured && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">{t('admin.oidcRegistration')}</p>
                <p className="mt-0.5 text-xs text-slate-400">{t('admin.oidcRegistrationHint')}</p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleAuthSetting('oidc_registration', !oidcRegistration, setOidcRegistration)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${oidcRegistration ? 'bg-content' : 'bg-edge'}`}
              >
                <span
                  className="absolute left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200"
                  style={{ transform: oidcRegistration ? 'translateX(20px)' : 'translateX(0)' }}
                />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Passkey (WebAuthn) login */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-slate-900">{t('admin.passkey.title')}</h2>
          <p className="mt-1 text-xs text-slate-400">{t('admin.passkey.cardHint')}</p>
        </div>
        <div className="space-y-5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">{t('admin.passkey.login')}</p>
              <p className="mt-0.5 text-xs text-slate-400">{t('admin.passkey.loginHint')}</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleAuthSetting('passkey_login', !passkeyLogin, setPasskeyLogin)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${passkeyLogin ? 'bg-content' : 'bg-edge'}`}
            >
              <span
                className="absolute left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200"
                style={{ transform: passkeyLogin ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
          </div>

          {passkeyLogin && !passkeyConfigured && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-600">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              {t('admin.passkey.notConfigured')}
            </p>
          )}

          {/* The domain passkeys bind to and the origins that may present them
              follow from the address the instance is served on, which the operator
              owns. Getting either wrong invalidates every enrolled passkey, and on
              a shared parent domain a wrong RP ID reaches past this instance
              entirely — so they are pinned per container, not offered here. The
              switch above stays: whether to offer passkeys at all is a house rule. */}
          {!managed && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('admin.passkey.rpId')}</label>
                <p className="mb-1.5 text-xs text-slate-400">{t('admin.passkey.rpIdHint')}</p>
                <input
                  type="text"
                  value={webauthnRpId}
                  onChange={(e) => setWebauthnRpId(e.target.value)}
                  placeholder="trek.example.org"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t('admin.passkey.origins')}</label>
                <p className="mb-1.5 text-xs text-slate-400">{t('admin.passkey.originsHint')}</p>
                <input
                  type="text"
                  value={webauthnOrigins}
                  onChange={(e) => setWebauthnOrigins(e.target.value)}
                  placeholder="https://trek.example.org"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveWebauthn}
                disabled={savingWebauthn}
                className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {savingWebauthn ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {t('common.save')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Require 2FA for all users */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-slate-900">{t('admin.requireMfa')}</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">{t('admin.requireMfa')}</p>
              <p className="mt-0.5 text-xs text-slate-400">{t('admin.requireMfaHint')}</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleRequireMfa(!requireMfa)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${requireMfa ? 'bg-content' : 'bg-edge'}`}
            >
              <span
                className="absolute left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200"
                style={{ transform: requireMfa ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Allowed File Types */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-slate-900">{t('admin.fileTypes')}</h2>
          <p className="mt-1 text-xs text-slate-400">{t('admin.fileTypesHint')}</p>
        </div>
        <div className="p-6">
          <input
            type="text"
            value={allowedFileTypes}
            onChange={(e) => setAllowedFileTypes(e.target.value)}
            placeholder="jpg,png,pdf,doc,docx,xls,xlsx,txt,csv"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-slate-400"
          />
          <p className="mt-2 text-xs text-slate-400">{t('admin.fileTypesFormat')}</p>
          <button
            type="button"
            onClick={async () => {
              setSavingFileTypes(true);
              try {
                await authApi.updateAppSettings({ allowed_file_types: allowedFileTypes });
                toast.success(t('admin.fileTypesSaved'));
              } catch {
                toast.error(t('common.error'));
              } finally {
                setSavingFileTypes(false);
              }
            }}
            disabled={savingFileTypes}
            className="mt-3 flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:bg-slate-400"
          >
            {savingFileTypes ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {t('common.save')}
          </button>
        </div>
      </div>

      {/* Google and Unsplash come with the instance, and so does what a lookup costs;
          the per-place toggles only ever traded away quota that is not the customer’s
          to spend. Weather needs no key at all and has nothing to configure. */}
      {!managed && (
        <>
          {/* API Keys */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="font-semibold text-slate-900">{t('admin.apiKeys')}</h2>
              <p className="mt-1 text-xs text-slate-400">{t('admin.apiKeysHint')}</p>
            </div>
            <div className="space-y-4 p-6">
              {/* The two key fields, not the toggles below them: on a centrally
              administered install the operator supplies the keys, while whether
              photos and lookups are offered at all stays the admin’s call. */}
              {!managed && (
                <>
                  {/* Google Maps Key */}
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                      {t('admin.mapsKey')}
                      <span className="rounded-full bg-emerald-200 px-1.5 py-px text-[9px] font-medium text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200">
                        {t('admin.recommended')}
                      </span>
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showKeys.maps ? 'text' : 'password'}
                          value={mapsKey}
                          onChange={(e) => setMapsKey(e.target.value)}
                          placeholder={t('settings.keyPlaceholder')}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-transparent focus:ring-2 focus:ring-slate-400"
                        />
                        <button
                          type="button"
                          onClick={() => toggleKey('maps')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showKeys.maps ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleValidateKey('maps')}
                        disabled={!mapsKey || validating.maps}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {validating.maps ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : validation.maps === true ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        ) : validation.maps === false ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : null}
                        {t('admin.validateKey')}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{t('admin.mapsKeyHintLong')}</p>
                    {validation.maps === true && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
                        {t('admin.keyValid')}
                      </p>
                    )}
                    {validation.maps === false && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
                        <span className="inline-block h-2 w-2 rounded-full bg-red-500"></span>
                        {t('admin.keyInvalid')}
                      </p>
                    )}
                  </div>

                  {/* Unsplash Key */}
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                      {t('admin.unsplashKey')}
                    </label>
                    <div className="relative">
                      <input
                        type={showKeys.unsplash ? 'text' : 'password'}
                        value={unsplashKey}
                        onChange={(e) => setUnsplashKey(e.target.value)}
                        placeholder={t('settings.keyPlaceholder')}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-transparent focus:ring-2 focus:ring-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => toggleKey('unsplash')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showKeys.unsplash ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{t('admin.unsplashKeyHint')}</p>
                  </div>

                  {/* AMap (高德) Web-Service Key */}
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
                      {t('admin.amapKey')}
                    </label>
                    <div className="relative">
                      <input
                        type={showKeys.amap ? 'text' : 'password'}
                        value={amapKey}
                        onChange={(e) => setAmapKey(e.target.value)}
                        placeholder={t('settings.keyPlaceholder')}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm focus:border-transparent focus:ring-2 focus:ring-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => toggleKey('amap')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showKeys.amap ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{t('admin.amapKeyHint')}</p>
                  </div>
                </>
              )}

              {!managed && (
                <div className="flex items-center justify-between gap-4 border-t border-slate-100 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{t('admin.amapSearch.title')}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{t('admin.amapSearch.subtitle')}</p>
                  </div>
                  <ToggleSwitch
                    on={amapSearchEnabledState}
                    label={t('admin.amapSearch.title')}
                    onToggle={async () => {
                      const next = !amapSearchEnabledState;
                      setAmapSearchEnabledState(next);
                      try {
                        await adminApi.updateAmapSearch(next);
                      } catch {
                        setAmapSearchEnabledState(!next);
                      }
                    }}
                  />
                </div>
              )}

              {/* Place Photos Toggle */}
              <div className="flex items-center justify-between gap-4 border-t border-slate-100 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">{t('admin.placesPhotos.title')}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{t('admin.placesPhotos.subtitle')}</p>
                </div>
                <ToggleSwitch
                  on={placesPhotosEnabled}
                  label={t('admin.placesPhotos.title')}
                  onToggle={async () => {
                    const next = !placesPhotosEnabled;
                    setPlacesPhotosEnabledState(next);
                    setPlacesPhotosEnabled(next);
                    try {
                      await adminApi.updatePlacesPhotos(next);
                    } catch {
                      setPlacesPhotosEnabledState(!next);
                      setPlacesPhotosEnabled(!next);
                    }
                  }}
                />
              </div>

              {/* Place Autocomplete Toggle */}
              <div className="flex items-center justify-between gap-4 border-t border-slate-100 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">{t('admin.placesAutocomplete.title')}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{t('admin.placesAutocomplete.subtitle')}</p>
                </div>
                <ToggleSwitch
                  on={placesAutocompleteEnabled}
                  label={t('admin.placesAutocomplete.title')}
                  onToggle={async () => {
                    const next = !placesAutocompleteEnabled;
                    setPlacesAutocompleteEnabledState(next);
                    setPlacesAutocompleteEnabled(next);
                    try {
                      await adminApi.updatePlacesAutocomplete(next);
                    } catch {
                      setPlacesAutocompleteEnabledState(!next);
                      setPlacesAutocompleteEnabled(!next);
                    }
                  }}
                />
              </div>

              {/* Place Details Toggle */}
              <div className="flex items-center justify-between gap-4 border-t border-slate-100 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">{t('admin.placesDetails.title')}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{t('admin.placesDetails.subtitle')}</p>
                </div>
                <ToggleSwitch
                  on={placesDetailsEnabled}
                  label={t('admin.placesDetails.title')}
                  onToggle={async () => {
                    const next = !placesDetailsEnabled;
                    setPlacesDetailsEnabledState(next);
                    setPlacesDetailsEnabled(next);
                    try {
                      await adminApi.updatePlacesDetails(next);
                    } catch {
                      setPlacesDetailsEnabledState(!next);
                      setPlacesDetailsEnabled(!next);
                    }
                  }}
                />
              </div>

              {/* Place Enrichment Toggle */}
              <div className="flex items-center justify-between gap-4 border-t border-slate-100 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-700">{t('admin.placesEnrich.title')}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{t('admin.placesEnrich.subtitle')}</p>
                </div>
                <ToggleSwitch
                  on={placesEnrichEnabled}
                  label={t('admin.placesEnrich.title')}
                  onToggle={async () => {
                    const next = !placesEnrichEnabled;
                    setPlacesEnrichEnabledState(next);
                    setPlacesEnrichEnabled(next);
                    try {
                      await adminApi.updatePlacesEnrich(next);
                    } catch {
                      setPlacesEnrichEnabledState(!next);
                      setPlacesEnrichEnabled(!next);
                    }
                  }}
                />
              </div>

              {/* Open-Meteo Weather Info */}
              <div className="overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500">
                      <Sun className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                      {t('admin.weather.title')}
                    </span>
                  </div>
                  <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200">
                    {t('admin.weather.badge')}
                  </span>
                </div>
                <div className="px-4 pb-3">
                  <p className="text-xs leading-relaxed text-emerald-800 dark:text-emerald-300">
                    {t('admin.weather.description')}
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-emerald-600 dark:text-emerald-400">
                    {t('admin.weather.locationHint')}
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="rounded-md border border-emerald-100 bg-white px-3 py-2 dark:border-emerald-800 dark:bg-emerald-900/40">
                      <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                        {t('admin.weather.forecast')}
                      </p>
                      <p className="mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                        {t('admin.weather.forecastDesc')}
                      </p>
                    </div>
                    <div className="rounded-md border border-emerald-100 bg-white px-3 py-2 dark:border-emerald-800 dark:bg-emerald-900/40">
                      <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                        {t('admin.weather.climate')}
                      </p>
                      <p className="mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                        {t('admin.weather.climateDesc')}
                      </p>
                    </div>
                    <div className="rounded-md border border-emerald-100 bg-white px-3 py-2 dark:border-emerald-800 dark:bg-emerald-900/40">
                      <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                        {t('admin.weather.requests')}
                      </p>
                      <p className="mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                        {t('admin.weather.requestsDesc')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveApiKeys}
                disabled={savingKeys}
                className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:bg-slate-400"
              >
                {savingKeys ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t('common.save')}
              </button>
            </div>
          </div>

          {/* An issuer the instance names can assert any address as verified, and the
          discovery calls leave from inside the operator’s network. Sign-on is theirs
          to wire, so the fields are not offered. */}
          {!managed && <></>}
          {/* OIDC / SSO Configuration */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="font-semibold text-slate-900">{t('admin.oidcTitle')}</h2>
              <p className="mt-1 text-xs text-slate-400">{t('admin.oidcSubtitle')}</p>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('admin.oidcDisplayName')}</label>
                <input
                  type="text"
                  value={oidcConfig.display_name}
                  onChange={(e) => setOidcConfig((c) => ({ ...c, display_name: e.target.value }))}
                  placeholder="z.B. Google, Authentik, Keycloak"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">{t('admin.oidcIssuer')}</label>
                <input
                  type="url"
                  value={oidcConfig.issuer}
                  onChange={(e) => setOidcConfig((c) => ({ ...c, issuer: e.target.value }))}
                  placeholder="https://accounts.google.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-slate-400"
                />
                <p className="mt-1 text-xs text-slate-400">{t('admin.oidcIssuerHint')}</p>
              </div>
              <div>
                <label htmlFor="oidc-discovery-url" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Discovery URL <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="oidc-discovery-url"
                  type="url"
                  value={oidcConfig.discovery_url}
                  onChange={(e) => setOidcConfig((c) => ({ ...c, discovery_url: e.target.value }))}
                  placeholder="https://auth.example.com/application/o/trek/.well-known/openid-configuration"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-slate-400"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Override the auto-constructed discovery URL. Required for providers like Authentik where the endpoint
                  is not at{' '}
                  <code className="rounded bg-slate-100 px-1">{'<issuer>/.well-known/openid-configuration'}</code>.
                </p>
              </div>
              <div>
                <label htmlFor="oidc-client-id" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Client ID
                </label>
                <input
                  id="oidc-client-id"
                  type="text"
                  value={oidcConfig.client_id}
                  onChange={(e) => setOidcConfig((c) => ({ ...c, client_id: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <div>
                <label htmlFor="oidc-client-secret" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Client Secret
                </label>
                <input
                  id="oidc-client-secret"
                  type="password"
                  value={oidcConfig.client_secret}
                  onChange={(e) => setOidcConfig((c) => ({ ...c, client_secret: e.target.value }))}
                  placeholder={oidcConfig.client_secret_set ? '••••••••' : ''}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <button
                type="button"
                onClick={async () => {
                  setSavingOidc(true);
                  try {
                    const payload: Record<string, unknown> = {
                      issuer: oidcConfig.issuer,
                      client_id: oidcConfig.client_id,
                      display_name: oidcConfig.display_name,
                      discovery_url: oidcConfig.discovery_url,
                    };
                    if (oidcConfig.client_secret) payload.client_secret = oidcConfig.client_secret;
                    await adminApi.updateOidc(payload);
                    toast.success(t('admin.oidcSaved'));
                  } catch (err: unknown) {
                    toast.error(getApiErrorMessage(err, t('common.error')));
                  } finally {
                    setSavingOidc(false);
                  }
                }}
                disabled={savingOidc}
                className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:bg-slate-400"
              >
                {savingOidc ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t('common.save')}
              </button>
            </div>
          </div>
          {/* Rotating the secret signs every user out and fixes nothing an instance admin
          can reach: the file it writes belongs to the host. */}
          {!managed && <></>}
          {/* Danger Zone */}
          <div className="overflow-hidden rounded-xl border border-red-200 bg-white">
            <div className="border-b border-red-100 bg-red-50 px-6 py-4">
              <h2 className="flex items-center gap-2 font-semibold text-red-700">
                <AlertTriangle className="h-4 w-4" />
                Danger Zone
              </h2>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Rotate JWT Secret</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Generate a new JWT signing secret. All active sessions will be invalidated immediately.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRotateJwtModal(true)}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                >
                  <RefreshCw className="h-4 w-4" />
                  Rotate
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
