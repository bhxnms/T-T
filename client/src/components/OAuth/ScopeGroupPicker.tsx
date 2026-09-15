import { ChevronDown, ChevronRight } from 'lucide-react';
import React, { useState } from 'react';
import { getScopesByGroup } from '../../api/oauthScopes';
import { useTranslation } from '../../i18n';

interface Props {
  selected: string[];
  onChange: (scopes: string[]) => void;
}

export default function ScopeGroupPicker({ selected, onChange }: Props): React.ReactElement {
  const { t } = useTranslation();
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const scopesByGroup = getScopesByGroup(t);
  const allScopeKeys = Object.values(scopesByGroup)
    .flat()
    .map((s) => s.scope);
  const allSelected = allScopeKeys.every((s) => selected.includes(s));

  return (
    <div className="space-y-1">
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => onChange(allSelected ? [] : allScopeKeys)}
          className="rounded border border-edge px-2 py-0.5 text-xs text-content-secondary transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          {allSelected ? t('settings.oauth.modal.deselectAll') : t('settings.oauth.modal.selectAll')}
        </button>
      </div>
      <div className="max-h-96 space-y-1 overflow-y-auto pr-1">
        {Object.entries(scopesByGroup).map(([group, groupScopes]) => {
          const groupScopeKeys = groupScopes.map((s) => s.scope);
          const allGroupSelected = groupScopeKeys.every((s) => selected.includes(s));
          const someGroupSelected = groupScopeKeys.some((s) => selected.includes(s));
          return (
            <div key={group} className="overflow-hidden rounded-lg border border-edge">
              <div className="flex items-center gap-1 bg-surface-secondary px-3 py-2">
                <button
                  type="button"
                  onClick={() => setOpen((prev) => ({ ...prev, [group]: !prev[group] }))}
                  className="flex flex-1 items-center gap-1 text-left text-xs font-semibold text-content-secondary transition-opacity hover:opacity-70"
                >
                  {open[group] ? (
                    <ChevronDown className="h-3 w-3 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-3 w-3 flex-shrink-0" />
                  )}
                  {group}
                  {someGroupSelected && (
                    <span className="ml-1.5 text-xs font-normal" style={{ color: 'var(--text-tertiary)' }}>
                      ({groupScopeKeys.filter((s) => selected.includes(s)).length}/{groupScopeKeys.length})
                    </span>
                  )}
                </button>
                <input
                  type="checkbox"
                  checked={allGroupSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someGroupSelected && !allGroupSelected;
                  }}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...new Set([...selected, ...groupScopeKeys])]
                        : selected.filter((s) => !groupScopeKeys.includes(s))
                    )
                  }
                  className="rounded"
                  title={allGroupSelected ? `Deselect all ${group}` : `Select all ${group}`}
                />
              </div>
              {open[group] && (
                <div className="divide-y border-edge">
                  {groupScopes.map(({ scope, label, description }) => (
                    <label
                      key={scope}
                      className="flex cursor-pointer items-start gap-2.5 px-3 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(scope)}
                        onChange={(e) =>
                          onChange(e.target.checked ? [...selected, scope] : selected.filter((s) => s !== scope))
                        }
                        className="mt-0.5 flex-shrink-0 rounded"
                      />
                      <div className="text-xs font-medium text-content">
                        {label}
                        <p className="text-xs font-normal" style={{ color: 'var(--text-tertiary)' }}>
                          {description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
