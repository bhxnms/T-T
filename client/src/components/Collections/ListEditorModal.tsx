import type { Collection, CollectionLink } from '@trek/shared';
import { ImagePlus, Link2, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { tripsApi } from '../../api/client';
import { normalizeLinkUrl } from '../../pages/collections/collectionsModel';
import { useCollectionStore } from '../../store/collectionStore';
import type { TranslationFn } from '../../types';
import { getApiErrorMessage } from '../../utils/apiError';
import Modal from '../shared/Modal';
import { useToast } from '../shared/Toast';

interface CoverSearchPhoto {
  id: string;
  url: string;
  thumb: string;
  description?: string | null;
  photographer?: string | null;
}

const SWATCHES = ['#6366f1', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#ef4444', '#3b82f6', '#22c55e'];

interface ListEditorModalProps {
  /** null = closed, 'new' = create, a Collection = edit that list. */
  target: Collection | 'new' | null;
  onClose: () => void;
  onCreated: (id: number) => void;
  /** Owner-only: hand off to the delete-confirm flow when editing a list. */
  onRequestDelete: (id: number) => void;
  t: TranslationFn;
}

/**
 * Create / edit a list — name, colour, an optional cover image (tinted with the
 * list colour in the hero), a description and a set of links. On create it makes
 * the list then uploads the cover to the new id; on edit it patches + re-uploads.
 */
export default function ListEditorModal({
  target,
  onClose,
  onCreated,
  onRequestDelete,
  t,
}: ListEditorModalProps): React.ReactElement | null {
  const createCollection = useCollectionStore((s) => s.createCollection);
  const updateCollection = useCollectionStore((s) => s.updateCollection);
  const uploadCover = useCollectionStore((s) => s.uploadCover);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const editing = target && target !== 'new' ? target : null;
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [description, setDescription] = useState('');
  const [links, setLinks] = useState<CollectionLink[]>([]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [pendingUnsplashUrl, setPendingUnsplashUrl] = useState<string | null>(null);
  const [coverQuery, setCoverQuery] = useState('');
  const [coverResults, setCoverResults] = useState<CoverSearchPhoto[]>([]);
  const [searchingCover, setSearchingCover] = useState(false);
  const coverSeq = useRef(0);
  const [saving, setSaving] = useState(false);
  // Remembers a freshly created list id so a retry after a cover-upload failure
  // updates it instead of creating a duplicate list.
  const [createdId, setCreatedId] = useState<number | null>(null);
  const objectUrl = useRef<string | null>(null);

  const dropObjectUrl = () => {
    if (objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    }
  };

  // (Re)seed the form whenever the target changes.
  useEffect(() => {
    if (!target) return;
    setName(editing?.name ?? '');
    setColor(editing?.color ?? '#6366f1');
    setDescription(editing?.description ?? '');
    setLinks(editing?.links ?? []);
    setCoverFile(null);
    dropObjectUrl();
    setCoverPreview(editing?.cover_image ?? null);
    setPendingUnsplashUrl(null);
    setCoverQuery('');
    setCoverResults([]);
    setCreatedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // Revoke the last preview blob on unmount.
  useEffect(() => () => dropObjectUrl(), []);

  if (!target) return null;

  const pickCover = (file: File | undefined) => {
    if (!file) return;
    dropObjectUrl();
    const url = URL.createObjectURL(file);
    objectUrl.current = url;
    setCoverFile(file);
    setCoverPreview(url);
    setPendingUnsplashUrl(null); // an uploaded file wins over a picked Unsplash photo
  };

  const searchCover = async () => {
    const query = coverQuery.trim() || name.trim();
    if (!query) return;
    const seq = ++coverSeq.current;
    setSearchingCover(true);
    try {
      const data = await tripsApi.searchCoverImages(query);
      if (seq !== coverSeq.current) return;
      setCoverResults(data.photos || []);
    } catch {
      if (seq === coverSeq.current) setCoverResults([]);
    } finally {
      if (seq === coverSeq.current) setSearchingCover(false);
    }
  };

  const pickUnsplash = (photo: CoverSearchPhoto) => {
    if (!photo.url) return;
    dropObjectUrl();
    setCoverFile(null);
    setPendingUnsplashUrl(photo.url);
    setCoverPreview(photo.url);
  };

  const setLink = (i: number, patch: Partial<CollectionLink>) =>
    setLinks(links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const save = async () => {
    const trimmed = name.trim();
    // Enter fires while the create is still in flight, and `createdId` is only
    // set once it comes back — without this the second one creates a second list.
    if (!trimmed || saving) return;
    // Normalise + keep only links with a url; drop blank rows.
    const cleanLinks = links
      .map((l) => ({ label: l.label?.trim() || undefined, url: normalizeLinkUrl(l.url) }))
      .filter((l) => l.url);
    const payload = {
      name: trimmed,
      color,
      description: description.trim() || null,
      links: cleanLinks,
      ...(pendingUnsplashUrl ? { cover_image: pendingUnsplashUrl } : {}),
    };
    setSaving(true);
    try {
      // A prior create that failed at the cover step left `createdId` set — reuse
      // it so a retry updates that list instead of creating a duplicate.
      let id = editing?.id ?? createdId;
      if (id != null) {
        await updateCollection(id, payload);
      } else {
        const created = await createCollection(payload);
        id = created?.id ?? null;
        setCreatedId(id);
      }
      if (id != null && coverFile) await uploadCover(id, coverFile);
      if (!editing && id != null) onCreated(id);
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, t('common.error')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={editing ? t('collections.editListTitle') : t('collections.newList')}
      size="md"
      footer={
        <div className="flex items-center gap-2">
          {editing && editing.is_owner !== false && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onRequestDelete(editing.id);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-danger hover:bg-danger-soft"
            >
              <Trash2 size={14} /> {t('collections.deleteList')}
            </button>
          )}
          <div className="ml-auto flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-edge px-3 py-1.5 text-[13px] text-content-secondary hover:bg-surface-hover"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!name.trim() || saving}
              className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-accent-text disabled:opacity-50"
            >
              {editing ? t('common.save') : t('collections.create')}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Cover */}
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-content-secondary">
            {t('collections.coverImage')}
          </label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative flex h-32 w-full items-center justify-center overflow-hidden rounded-xl border border-edge bg-surface-secondary text-content-faint transition-colors hover:border-accent"
          >
            {coverPreview && <img src={coverPreview} alt="" className="absolute inset-0 h-full w-full object-cover" />}
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(135deg, ${color}55, transparent 70%)` }}
            />
            <span
              className="relative flex items-center gap-2 text-[13px] font-medium"
              style={{
                color: coverPreview ? '#fff' : undefined,
                textShadow: coverPreview ? '0 1px 4px rgba(0,0,0,.5)' : undefined,
              }}
            >
              <ImagePlus size={16} /> {coverPreview ? t('collections.changeCover') : t('collections.addCover')}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={(e) => pickCover(e.target.files?.[0])}
          />

          {/* Unsplash cover search — same source as trip creation */}
          <div className="mt-2 flex gap-2">
            <input
              value={coverQuery}
              onChange={(e) => setCoverQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  searchCover();
                }
              }}
              placeholder={t('dashboard.unsplashSearchPlaceholder')}
              className="min-w-0 flex-1 rounded-lg border border-edge bg-surface-input px-3 py-2 text-[13px] text-content outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={searchCover}
              disabled={searchingCover || (!coverQuery.trim() && !name.trim())}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-edge px-3 py-2 text-[13px] text-content-secondary hover:bg-surface-hover disabled:opacity-40"
            >
              {searchingCover ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              {t('dashboard.searchUnsplash')}
            </button>
          </div>
          {coverResults.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {coverResults.map((photo) => (
                <button
                  type="button"
                  key={photo.id}
                  onClick={() => pickUnsplash(photo)}
                  aria-label={photo.photographer || 'Unsplash'}
                  className={`relative h-20 overflow-hidden rounded-lg border transition-colors ${coverPreview === photo.url ? 'ring-accent/25 border-accent ring-2' : 'border-edge hover:border-accent'}`}
                >
                  <img
                    src={photo.thumb}
                    alt={photo.description || ''}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  {photo.photographer && (
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-[10px] text-white">
                      {photo.photographer}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Name */}
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-content-secondary">
            {t('collections.listName')}
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) save();
            }}
            placeholder={t('collections.listNamePlaceholder')}
            className="w-full rounded-lg border border-edge bg-surface-input px-3 py-2 text-[14px] text-content outline-none focus:border-accent"
          />
        </div>

        {/* Colour */}
        <div>
          <label className="mb-2 block text-[12px] font-medium text-content-secondary">
            {t('collections.listColor')}
          </label>
          <div className="flex flex-wrap gap-2">
            {SWATCHES.map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => setColor(col)}
                className="h-7 w-7 rounded-full transition-transform hover:scale-110"
                style={{
                  background: col,
                  outline: color === col ? '2px solid var(--accent)' : 'none',
                  outlineOffset: 2,
                }}
                aria-label={col}
              />
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-content-secondary">
            {t('collections.description')}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={t('collections.descriptionPlaceholder')}
            className="w-full resize-y rounded-lg border border-edge bg-surface-input px-3 py-2 text-[13px] text-content outline-none focus:border-accent"
          />
        </div>

        {/* Links */}
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-content-secondary">
            {t('collections.links')}
          </label>
          <div className="flex flex-col gap-2">
            {links.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={l.label ?? ''}
                  onChange={(e) => setLink(i, { label: e.target.value })}
                  placeholder={t('collections.linkLabel')}
                  className="w-32 shrink-0 rounded-lg border border-edge bg-surface-input px-2.5 py-1.5 text-[12.5px] text-content outline-none focus:border-accent"
                />
                <input
                  value={l.url}
                  onChange={(e) => setLink(i, { url: e.target.value })}
                  placeholder="https://…"
                  className="min-w-0 flex-1 rounded-lg border border-edge bg-surface-input px-2.5 py-1.5 text-[12.5px] text-content outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => setLinks(links.filter((_, idx) => idx !== i))}
                  className="rounded-md p-1.5 text-content-faint hover:bg-danger-soft hover:text-danger"
                  aria-label={t('common.delete')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLinks([...links, { url: '' }])}
              className="inline-flex items-center gap-1.5 self-start rounded-lg border border-dashed border-edge px-2.5 py-1.5 text-[12.5px] font-medium text-content-secondary hover:bg-surface-hover"
            >
              <Plus size={14} /> <Link2 size={13} /> {t('collections.addLink')}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
