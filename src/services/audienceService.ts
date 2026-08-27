import type { PostAudience, AudienceType } from '../types/models';

export interface AudienceResolutionResult {
  isSupported: boolean;
  type: AudienceType;
  label: string;
  targetId?: string;
  reason?: string;
}

/**
 * Resolves post target audience metadata for campus feed and channel scope.
 * Supports 'campus' and 'channel' for Phase 16.
 * Returns safe unsupported status for 'department', 'batch', and 'custom' until Phase 17.
 */
export const resolveAudience = (audience?: PostAudience): AudienceResolutionResult => {
  if (!audience || audience.type === 'campus') {
    return {
      isSupported: true,
      type: 'campus',
      label: 'Entire Campus',
      targetId: 'campus',
    };
  }

  if (audience.type === 'channel') {
    return {
      isSupported: true,
      type: 'channel',
      label: audience.channelId ? `#${audience.channelId}` : 'Community Channel',
      targetId: audience.channelId || 'general',
    };
  }

  if (audience.type === 'department') {
    return {
      isSupported: true,
      type: 'department',
      label: audience.departmentId ? `Department (${audience.departmentId.toUpperCase()})` : 'Department Group',
      targetId: audience.departmentId,
    };
  }

  if (audience.type === 'batch') {
    return {
      isSupported: true,
      type: 'batch',
      label: audience.batchId ? `Batch (${audience.batchId})` : 'Batch Year Group',
      targetId: audience.batchId,
    };
  }

  return {
    isSupported: true,
    type: 'custom',
    label: 'Community Group',
    targetId: audience.audienceId,
  };
};
