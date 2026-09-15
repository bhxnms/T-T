/**
 * Landmark Popup Component for Atlas
 * 景点弹窗组件 - 显示景点详细信息
 */

import { CheckCircle2, X } from 'lucide-react';
import type { ProvinceLandmark } from '../../data/chinaProvinces';
import { getLandmarkColor, getLandmarkIcon } from '../../utils/landmarkIcons';

interface LandmarkPopupProps {
  landmark: ProvinceLandmark & { provinceCode: string; provinceName: string };
  isVisited: boolean;
  /** Epoch ms the landmark was checked in at, when visited. */
  visitedAt?: number;
  onClose: () => void;
  onToggleVisit: () => void;
}

export default function LandmarkPopup({ landmark, isVisited, visitedAt, onClose, onToggleVisit }: LandmarkPopupProps) {
  const iconSvg = getLandmarkIcon(landmark.type);
  const color = getLandmarkColor(landmark.type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative mx-4 max-w-md rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '400px', width: '90%' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="关闭"
        >
          <X size={20} />
        </button>

        {/* Icon */}
        <div
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: `${color}20`, color: color }}
          dangerouslySetInnerHTML={{ __html: iconSvg }}
        />

        {/* Content - 只显示中文 */}
        <div>
          <div className="mb-1 text-sm text-gray-500">{landmark.provinceName}</div>
          <h3 className="mb-3 text-xl font-bold text-gray-900">{landmark.name}</h3>
          {isVisited && visitedAt != null && visitedAt > 0 && (
            <p className="mb-3 text-sm text-gray-600">打卡日期：{new Date(visitedAt).toLocaleDateString('zh-CN')}</p>
          )}
          <p className="leading-relaxed text-gray-700">{landmark.description}</p>
        </div>

        {/* Check-in button */}
        <button
          onClick={onToggleVisit}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold transition-all"
          style={{
            backgroundColor: isVisited ? color : 'white',
            color: isVisited ? 'white' : '#333',
            border: isVisited ? `2px solid ${color}` : '2px solid #e5e5e5',
          }}
        >
          <CheckCircle2 size={20} />
          {isVisited ? '已打卡' : '标记为已打卡'}
        </button>
      </div>
    </div>
  );
}
