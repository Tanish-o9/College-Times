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

export const canDeleteGroup = (role?: GroupRole, systemRole?: string): boolean => {
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

// Roles & Permissions 2.0 extensions
export const canManageGroup = (role?: GroupRole, systemRole?: string): boolean => {
  if (systemRole === 'admin') return true;
  return role === 'owner' || role === 'admin';
};

export const canManageAnnouncements = (role?: GroupRole, systemRole?: string): boolean => {
  if (systemRole === 'admin') return true;
  return role === 'owner' || role === 'admin';
};

export const canManagePosts = (
  role?: GroupRole,
  systemRole?: string,
  postAuthorId?: string,
  currentUserId?: string
): boolean => {
  if (systemRole === 'admin') return true;
  if (role === 'owner' || role === 'admin' || role === 'moderator') return true;
  return !!(postAuthorId && currentUserId && postAuthorId === currentUserId);
};

export const canManageEvents = (role?: GroupRole, systemRole?: string): boolean => {
  if (systemRole === 'admin') return true;
  return role === 'owner' || role === 'admin';
};

export const canManagePolls = (role?: GroupRole, systemRole?: string): boolean => {
  if (systemRole === 'admin') return true;
  return role === 'owner' || role === 'admin';
};

export const canManageChat = (role?: GroupRole, systemRole?: string): boolean => {
  if (systemRole === 'admin') return true;
  return role === 'owner' || role === 'admin';
};

export const canManageJoinRequests = (role?: GroupRole, systemRole?: string): boolean => {
  if (systemRole === 'admin') return true;
  return role === 'owner' || role === 'admin';
};

export const canInviteMembers = (_role?: GroupRole, _systemRole?: string): boolean => {
  return true; // All members can invite by default
};

export const canRemoveMembers = (role?: GroupRole, systemRole?: string): boolean => {
  if (systemRole === 'admin') return true;
  return role === 'owner' || role === 'admin' || role === 'moderator';
};

export const canBanMembers = (role?: GroupRole, systemRole?: string): boolean => {
  if (systemRole === 'admin') return true;
  return role === 'owner' || role === 'admin' || role === 'moderator';
};

export const canViewPrivateContent = (
  role?: GroupRole,
  isMember?: boolean,
  systemRole?: string
): boolean => {
  if (systemRole === 'admin') return true;
  return !!isMember || role === 'owner' || role === 'admin' || role === 'moderator';
};
