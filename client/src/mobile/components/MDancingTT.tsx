import { useState } from 'react';

/**
 * TT 吉祥物 - 一个简约的旅行图标，采用扁平化设计风格。
 * 基于 TT logo 的设计语言，使用几何形状和现代化动画。
 *
 * 支持多种场景和心情，保持轻量级和高性能。
 */
export type TTScene =
  | 'idle'
  | 'chat'
  | 'transport'
  | 'bookings'
  | 'guide'
  | 'packing'
  | 'files'
  | 'notes'
  | 'polls'
  | 'journey'
  | 'collections'
  | 'dashboard'
  | 'atlas'
  | 'notifications'
  | 'costs'
  | 'search'
  | 'tasks';

export type TTMood = 'default' | 'happy' | 'sleepy' | 'confused' | 'error';

// TT 简化 logo - 两个字母 T 的几何形状
const TT_SHAPE =
  'M20,15 L30,15 L30,20 L26,20 L26,35 L24,35 L24,20 L20,20 Z M35,15 L45,15 L45,20 L41,20 L41,35 L39,35 L39,20 L35,20 Z';

const SCENE_MOOD: Partial<Record<TTScene, TTMood>> = {
  notifications: 'sleepy',
  search: 'confused',
};

export default function MDancingTT({
  size = 96,
  scene = 'idle',
  mood,
  className = '',
}: {
  size?: number;
  scene?: TTScene;
  mood?: TTMood;
  className?: string;
}) {
  const face = mood ?? SCENE_MOOD[scene] ?? 'default';
  const shadowCy = scene === 'transport' ? 86 : 73;
  const [poke, setPoke] = useState(0);

  return (
    <svg
      key={poke}
      onClick={() => setPoke((p) => p + 1)}
      width={size}
      height={(size * 96) / 88}
      viewBox="0 0 88 96"
      fill="none"
      aria-hidden="true"
      className={`tt-mascot tt-mascot--${scene} cursor-pointer text-m-ink ${className}`}
    >
      {/* 地面阴影 */}
      <ellipse className="tt-shadow" cx="44" cy={shadowCy} rx="19" ry="3.4" fill="currentColor" opacity="0.2" />

      <g className="tt-root">
        {/* 场景道具 - 背景层 */}
        <SceneBack scene={scene} />

        {/* 主体 - 简化的旅行背包或地图标记图标 */}
        <g className={`tt-bounce tt-bounce--${scene}`}>
          <g className="tt-body">
            {/* 简约的旅行背包形状 */}
            <g transform="translate(24, 28)">
              {/* 背包主体 */}
              <rect x="8" y="8" width="24" height="28" rx="3" fill="currentColor" />
              {/* 背包顶部 */}
              <rect x="12" y="4" width="16" height="6" rx="2" fill="currentColor" />
              {/* 背包口袋 */}
              <rect x="11" y="14" width="18" height="12" rx="2" fill="var(--m-bg)" opacity="0.3" />
              {/* TT 标记 */}
              <text x="20" y="22" fontSize="8" fontWeight="bold" fill="var(--m-bg)" textAnchor="middle">
                TT
              </text>
            </g>

            {/* 眼睛 */}
            <Eyes mood={face} />
          </g>
        </g>

        {/* 场景道具 - 前景层 */}
        <SceneFront scene={scene} />
      </g>
    </svg>
  );
}

/* ── 眼睛 ──────────────────────────────────────────────────────────────── */
function Eyes({ mood }: { mood: TTMood }) {
  if (mood === 'sleepy') {
    return (
      <g className="tt-eyes tt-eyes--sleepy">
        <line x1="30" y1="42" x2="36" y2="42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="52" y1="42" x2="58" y2="42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </g>
    );
  }

  if (mood === 'happy') {
    return (
      <g className="tt-eyes tt-eyes--happy">
        <path d="M30,40 Q33,38 36,40" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M52,40 Q55,38 58,40" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      </g>
    );
  }

  if (mood === 'confused') {
    return (
      <g className="tt-eyes tt-eyes--confused">
        <circle cx="33" cy="42" r="2" fill="currentColor" />
        <circle cx="55" cy="40" r="2" fill="currentColor" />
      </g>
    );
  }

  if (mood === 'error') {
    return (
      <g className="tt-eyes tt-eyes--error">
        <line x1="30" y1="40" x2="36" y2="44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="36" y1="40" x2="30" y2="44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="52" y1="40" x2="58" y2="44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="58" y1="40" x2="52" y2="44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </g>
    );
  }

  // default mood - 正常的圆形眼睛
  return (
    <g className="tt-eyes tt-blink">
      <circle cx="33" cy="42" r="2.5" fill="currentColor" />
      <circle cx="55" cy="42" r="2.5" fill="currentColor" />
    </g>
  );
}

/* ── 场景道具 - 背景 ──────────────────────────────────────────────────── */
function SceneBack({ scene }: { scene: TTScene }) {
  switch (scene) {
    case 'transport':
      return (
        <g className="tt-prop-back">
          {/* 简单的道路线条 */}
          <line x1="10" y1="70" x2="78" y2="70" stroke="currentColor" strokeWidth="1" opacity="0.3" />
        </g>
      );
    default:
      return null;
  }
}

/* ── 场景道具 - 前景 ──────────────────────────────────────────────────── */
function SceneFront({ scene }: { scene: TTScene }) {
  switch (scene) {
    case 'search':
      return (
        <g className="tt-prop-front">
          {/* 放大镜 */}
          <circle cx="65" cy="35" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
          <line x1="69" y1="39" x2="73" y2="43" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    case 'packing':
      return (
        <g className="tt-prop-front">
          {/* 小行李箱 */}
          <rect x="62" y="52" width="12" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <line x1="65" y1="52" x2="65" y2="48" stroke="currentColor" strokeWidth="1.5" />
          <line x1="71" y1="52" x2="71" y2="48" stroke="currentColor" strokeWidth="1.5" />
        </g>
      );
    case 'files':
      return (
        <g className="tt-prop-front">
          {/* 文件图标 */}
          <rect x="60" y="45" width="14" height="18" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <line x1="63" y1="50" x2="71" y2="50" stroke="currentColor" strokeWidth="1" />
          <line x1="63" y1="54" x2="71" y2="54" stroke="currentColor" strokeWidth="1" />
          <line x1="63" y1="58" x2="68" y2="58" stroke="currentColor" strokeWidth="1" />
        </g>
      );
    case 'notes':
      return (
        <g className="tt-prop-front">
          {/* 笔记本 */}
          <rect x="60" y="48" width="12" height="16" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <line x1="62" y1="53" x2="70" y2="53" stroke="currentColor" strokeWidth="0.8" />
          <line x1="62" y1="57" x2="70" y2="57" stroke="currentColor" strokeWidth="0.8" />
        </g>
      );
    default:
      return null;
  }
}
