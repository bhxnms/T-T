import { BookOpen, Bug, Coffee, ExternalLink, Heart, Info, Lightbulb } from 'lucide-react';
import React from 'react';
import { useTranslation } from '../../i18n';
import Section from './Section';
import { useAuthStore } from '../../store/authStore';
import { PRODUCT_DERIVATION } from '../../config/brand';

interface Props {
  appVersion: string;
}

export default function AboutTab({ appVersion }: Props): React.ReactElement {
  const { t, locale } = useTranslation();
  const managed = useAuthStore((s) => s.managed);

  return (
    <Section title={t('settings.about')} icon={Info}>
      <style>{`
        @keyframes heartPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
      <p
        className="text-content-secondary"
        style={{ fontSize: 'calc(13px * var(--fs-scale-body, 1))', lineHeight: 1.6, marginBottom: 6, marginTop: -4 }}
      >
        {/* The stock line calls TREK self-hosted and points at 'your own server'.
            Both are true for the reader who set it up and neither is for a customer
            of a hosted instance, so the mode picks the sentence rather than the
            wording being watered down for everybody. */}
        {t(managed ? 'settings.about.descriptionManaged' : 'settings.about.description')}
      </p>
      <p className="text-content-faint" style={{ fontSize: 'calc(12px * var(--fs-scale-body, 1))', lineHeight: 1.6, marginBottom: 6 }}>
        {PRODUCT_DERIVATION}
      </p>
      <p
        className="text-content-faint"
        style={{ fontSize: 'calc(12px * var(--fs-scale-body, 1))', lineHeight: 1.6, marginBottom: 16 }}
      >
        {t('settings.about.madeWith')}{' '}
        <Heart
          size={11}
          fill="#991b1b"
          stroke="#991b1b"
          style={{ display: 'inline-block', verticalAlign: '-1px', animation: 'heartPulse 1.5s ease-in-out infinite' }}
        />{' '}
        {t('settings.about.madeBy')}{' '}
        <span
          className="bg-surface-tertiary text-content-faint"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            borderRadius: 99,
            padding: '1px 7px',
            fontSize: 'calc(10px * var(--fs-scale-caption, 1))',
            fontWeight: 600,
            verticalAlign: '1px',
          }}
        >
          v{appVersion}
        </span>
      </p>

      {/* Ko-fi, Buy Me a Coffee, Discord, and the issue/discussion links assume
          the reader runs this install and can act on it. On a centrally
          administered one they support somebody they are not the customer of,
          and file bugs against an instance they do not operate. The version and
          the source link below stay in both modes: AGPL §13 wants the source
          offered prominently to the people using it over a network, and that is
          not the part being trimmed here. */}
      {!managed && (<>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <a
          href="mailto:bhxnms@gmail.com?subject=TT%20Bug%20Report"
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
            <div className="text-xs text-content-faint">bhxnms@gmail.com</div>
          </div>
          <ExternalLink size={14} className="ml-auto flex-shrink-0 text-content-faint" />
        </a>
        <a
          href="mailto:bhxnms@gmail.com?subject=TT%20Feature%20Request"
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
            <div className="text-xs text-content-faint">bhxnms@gmail.com</div>
          </div>
          <ExternalLink size={14} className="ml-auto flex-shrink-0 text-content-faint" />
        </a>
      </div>
      </>)}

      {/* What replaces the grids above. AGPL §13 asks for the source to be
          offered prominently to whoever uses the software over a network, and a
          customer of a hosted instance is exactly that reader. The support and
          bug-report links go; this does not. */}
      {managed && (
        <a
          href="https://github.com/bhxnms/T-T"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 overflow-hidden rounded-xl border border-edge bg-surface-card px-5 py-4 no-underline"
        >
          <div>
            <div className="text-sm font-semibold text-content">{t('settings.about.sourceTitle')}</div>
            <div className="text-xs text-content-faint">{t('settings.about.sourceHint')}</div>
          </div>
          <ExternalLink size={14} className="ml-auto flex-shrink-0 text-content-faint" />
        </a>
      )}
    </Section>
  );
}
