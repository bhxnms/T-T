import { Edit2, Pipette, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { categoriesApi } from '../../api/client';
import { useTranslation } from '../../i18n';
import { getApiErrorMessage } from '../../types';
import { CATEGORY_ICON_MAP, ICON_LABELS, getCategoryIcon } from '../shared/categoryIcons';
import { useToast } from '../shared/Toast';

const PRESET_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#84cc16',
  '#6b7280',
  '#1f2937',
];

const ICON_NAMES = Object.keys(CATEGORY_ICON_MAP);

export default function CategoryManager() {
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', color: '#6366f1', icon: 'MapPin' });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const colorInputRef = useRef(null);
  const toast = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const data = await categoriesApi.list();
      setCategories(data.categories || []);
    } catch (err: unknown) {
      toast.error(t('categories.toast.loadError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEdit = (cat) => {
    setEditingId(cat.id);
    setForm({ name: cat.name, color: cat.color || '#6366f1', icon: cat.icon || 'MapPin' });
    setShowForm(false);
  };

  const handleStartCreate = () => {
    setEditingId(null);
    setForm({ name: '', color: '#6366f1', icon: 'MapPin' });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
  };

  // The Save button carries disabled={… || !form.name.trim()}, so the name is set here.
  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (editingId) {
        const result = await categoriesApi.update(editingId, form);
        setCategories((prev) => prev.map((c) => (c.id === editingId ? result.category : c)));
        setEditingId(null);
        toast.success(t('categories.toast.updated'));
      } else {
        const result = await categoriesApi.create(form);
        setCategories((prev) => [...prev, result.category]);
        setShowForm(false);
        toast.success(t('categories.toast.created'));
      }
      setForm({ name: '', color: '#6366f1', icon: 'MapPin' });
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, t('categories.toast.saveError')));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('categories.confirm.delete'))) return;
    try {
      await categoriesApi.delete(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      toast.success(t('categories.toast.deleted'));
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, t('categories.toast.deleteError')));
    }
  };

  const isPresetColor = PRESET_COLORS.includes(form.color);
  const PreviewIcon = getCategoryIcon(form.icon);

  const categoryForm = (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <input
        type="text"
        value={form.name}
        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        placeholder={t('categories.namePlaceholder')}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        autoFocus
      />

      <div>
        <label className="mb-2 block text-xs font-medium text-gray-600">{t('categories.icon')}</label>
        <div className="max-h-48 overflow-y-auto">
          <div className="flex flex-wrap gap-1.5 px-1.5 py-1.5">
            {ICON_NAMES.map((name) => {
              const Icon = CATEGORY_ICON_MAP[name];
              const isSelected = form.icon === name;
              return (
                <button
                  key={name}
                  type="button"
                  title={ICON_LABELS[name] || name}
                  onClick={() => setForm((prev) => ({ ...prev, icon: name }))}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
                    isSelected ? 'ring-2 ring-slate-700 ring-offset-1' : 'hover:bg-gray-200'
                  }`}
                  style={{ background: isSelected ? `${form.color}18` : undefined }}
                >
                  <Icon size={17} strokeWidth={1.8} color={isSelected ? form.color : '#374151'} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-600">{t('categories.color')}</label>
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, color }))}
              className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${form.color === color ? 'scale-110 ring-2 ring-gray-400 ring-offset-2' : ''}`}
              style={{ backgroundColor: color }}
            />
          ))}

          {/* Custom color button */}
          <input
            ref={colorInputRef}
            type="color"
            value={form.color}
            onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
            className="sr-only"
          />
          <button
            type="button"
            title={t('categories.customColor')}
            onClick={() => colorInputRef.current?.click()}
            className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-transform hover:scale-110 ${
              !isPresetColor
                ? 'scale-110 border-transparent ring-2 ring-gray-400 ring-offset-2'
                : 'border-dashed border-gray-300 hover:border-gray-400'
            }`}
            style={!isPresetColor ? { backgroundColor: form.color } : undefined}
          >
            {isPresetColor && <Pipette className="h-3 w-3 text-gray-400" />}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">{t('categories.preview')}:</span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium"
          style={{ backgroundColor: `${form.color}20`, color: form.color }}
        >
          <PreviewIcon size={14} strokeWidth={1.8} />
          {form.name || t('categories.defaultName')}
        </span>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !form.name.trim()}
          className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {isSaving ? t('common.saving') : editingId ? t('categories.update') : t('categories.create')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-content">{t('categories.title')}</h2>
          <p className="mt-1 text-xs text-content-muted">{t('categories.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={handleStartCreate}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 sm:px-4"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{t('categories.new')}</span>
        </button>
      </div>

      {showForm && <div className="mb-4">{categoryForm}</div>}

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-slate-600" />
        </div>
      ) : categories.length === 0 ? (
        <div className="py-8 text-center text-gray-400">
          <p className="text-sm">{t('categories.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => {
            const Icon = getCategoryIcon(cat.icon);
            return (
              <div key={cat.id}>
                {editingId === cat.id ? (
                  <div className="mb-2">{categoryForm}</div>
                ) : (
                  <div className="group flex items-center gap-3 rounded-xl border border-gray-100 p-3 hover:border-gray-200">
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${cat.color}20` }}
                    >
                      <Icon size={18} strokeWidth={1.8} color={cat.color} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{cat.name}</span>
                        <span
                          className="rounded-full px-2 py-0.5 text-xs"
                          style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                        >
                          {cat.color}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(cat)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cat.id)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
