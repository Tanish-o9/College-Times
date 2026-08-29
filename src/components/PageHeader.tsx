import React from 'react';
import { BackButton } from './BackButton';
import clsx from 'clsx';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  customFallback?: string;
  className?: string;
  actions?: React.ReactNode;
  onBeforeNav?: () => boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  customFallback,
  className,
  actions,
  onBeforeNav,
}) => {
  return (
    <div className={clsx("flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6", className)}>
      <div className="flex items-start gap-3.5 min-w-0">
        <BackButton customFallback={customFallback} onBeforeNav={onBeforeNav} className="mt-1 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-black text-white leading-tight tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs md:text-sm text-slate-400 mt-0.5 leading-relaxed truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
          {actions}
        </div>
      )}
    </div>
  );
};
