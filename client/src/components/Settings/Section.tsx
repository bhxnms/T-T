import type { LucideIcon } from 'lucide-react';
import React from 'react';

interface SectionProps {
  title: string;
  icon: LucideIcon;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

export default function Section({ title, icon: Icon, badge, children }: SectionProps): React.ReactElement {
  return (
    <div className="overflow-hidden rounded-xl border border-edge bg-surface-card" style={{ marginBottom: 24 }}>
      <div className="flex items-center gap-2 border-b border-edge-secondary px-6 py-4">
        <Icon className="h-5 w-5 text-content-secondary" />
        <h2 className="font-semibold text-content">{title}</h2>
        {badge}
      </div>
      <div className="space-y-4 p-6">{children}</div>
    </div>
  );
}
