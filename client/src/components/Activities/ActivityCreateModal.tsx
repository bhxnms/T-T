import { useEffect, useState } from 'react';
import { useTripStore } from '../../store/tripStore';
import type { Place, Reservation } from '../../types';
import { getApiErrorMessage } from '../../types';
import Button from '../shared/Button';
import Modal from '../shared/Modal';
import { useToast } from '../shared/Toast';

interface ActivityCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: number;
  dayId: number;
  places: Place[];
  reservations: Reservation[];
}

type ResourceType = 'place' | 'reservation';

export default function ActivityCreateModal({
  isOpen,
  onClose,
  tripId,
  dayId,
  places,
  reservations,
}: ActivityCreateModalProps) {
  const createActivity = useTripStore((s) => s.createActivity);
  const toast = useToast();
  const [resourceType, setResourceType] = useState<ResourceType>('place');
  const [resourceId, setResourceId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setResourceType('place');
      setResourceId('');
      setStartTime('');
      setDuration('60');
      setNotes('');
      setSaving(false);
    }
  }, [isOpen, dayId]);

  const resources = resourceType === 'place' ? places : reservations;
  const resourceLabel = resourceType === 'place' ? '地点' : '预约';

  const submit = async () => {
    const id = Number(resourceId);
    const minutes = duration.trim() ? Number(duration) : undefined;
    if (!resourceId || !Number.isInteger(id) || id <= 0) {
      toast.error(`请选择${resourceLabel}`);
      return;
    }
    if (minutes !== undefined && (!Number.isFinite(minutes) || minutes <= 0)) {
      toast.error('持续时间必须是大于 0 的数字');
      return;
    }

    setSaving(true);
    try {
      await createActivity({
        day_id: dayId,
        trip_id: tripId,
        ...(resourceType === 'place' ? { place_id: id } : { reservation_id: id }),
        start_time: startTime || undefined,
        duration_minutes: minutes,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, '添加活动失败，请重试'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="添加活动"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button type="button" variant="primary" onClick={submit} disabled={saving || resources.length === 0}>
            {saving ? '添加中...' : '添加活动'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-content">活动来源</span>
          <select
            value={resourceType}
            onChange={(e) => {
              setResourceType(e.target.value as ResourceType);
              setResourceId('');
            }}
            className="w-full rounded-lg border border-edge bg-surface-input px-3 py-2 text-content"
            disabled={saving}
          >
            <option value="place">地点</option>
            <option value="reservation">预约</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-content">选择{resourceLabel}</span>
          <select
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
            className="w-full rounded-lg border border-edge bg-surface-input px-3 py-2 text-content"
            disabled={saving || resources.length === 0}
          >
            <option value="">请选择{resourceLabel}</option>
            {resources.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resourceType === 'place' ? (resource as Place).name : (resource as Reservation).title}
              </option>
            ))}
          </select>
          {resources.length === 0 && (
            <span className="mt-1 block text-xs text-content-muted">当前行程没有可选的{resourceLabel}</span>
          )}
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-content">开始时间</span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              disabled={saving}
              className="w-full rounded-lg border border-edge bg-surface-input px-3 py-2 text-content"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-content">持续时间（分钟）</span>
            <input
              type="number"
              min="1"
              step="1"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              disabled={saving}
              className="w-full rounded-lg border border-edge bg-surface-input px-3 py-2 text-content"
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-content">备注</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            rows={3}
            disabled={saving}
            className="w-full resize-y rounded-lg border border-edge bg-surface-input px-3 py-2 text-content"
          />
        </label>
      </div>
    </Modal>
  );
}
