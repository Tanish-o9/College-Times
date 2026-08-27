import type { GroupRole } from '../types/group';

export const canManageMembers = (role?: GroupRole, systemRole?: string): boolean => {
  if (systemRole === 'admin') return true;
  return role === 'owner' || role === 'admin';
};

export const canModerateContent = (role?: GroupRole, systemRole?: string): boolean => {
  if (systemRole === 'admin') return true;
  return role === 'owner' || role === 'admin' || role === 'moderator';
};

export const canManageInvites = (role?: GroupRole, systemRole?: string): boolean => {
  if (systemRole === 'admin') return true;
  return role === 'owner' || role === 'admin';
};

export const canCreateAnnouncement = (role?: GroupRole, systemRole?: string): boolean => {
  if (systemRole === 'admin') return true;
  return role === 'owner' || role === 'admin' || role === 'moderator';
};

export const canTransferOwnership = (role?: GroupRole, systemRole?: string): boolean => {
  if (systemRole === 'admin') return true;
  return role === 'owner';
};

export const canArchiveGroup = (role?: GroupRole, systemRole?: string): boolean => {
  if (systemRole === 'admin') return true;
  return role === 'owner' || role === 'admin';
};

export const canEditSettings = (role?: GroupRole, systemRole?: string): boolean => {
  if (systemRole === 'admin') return true;
  return role === 'owner' || role === 'admin';
};
