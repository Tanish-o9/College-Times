import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'card' | 'avatar' | 'button' | 'rectangular';
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', variant = 'text' }) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'avatar':
        return 'w-10 h-10 rounded-full';
      case 'button':
        return 'h-10 w-24 rounded-xl';
      case 'card':
        return 'w-full h-44 rounded-3xl';
      case 'rectangular':
        return 'w-full h-12 rounded-xl';
      case 'text':
      default:
        return 'h-4 w-full rounded';
    }
  };

  return (
    <div
      className={`bg-slate-800/60 animate-pulse border border-slate-700/40 ${getVariantStyles()} ${className}`}
    />
  );
};
