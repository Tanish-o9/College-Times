import type { User } from '../types/models';

/**
 * Calculates profile completeness score out of 100.
 */
export const calculateProfileCompleteness = (profile?: User | null): { score: number; missingFields: string[] } => {
  let score = 0;
  const missingFields: string[] = [];

  if (!profile) {
    return { score: 0, missingFields: ['Name', 'Bio', 'Avatar', 'Department', 'Batch Year', 'Skills', 'Interests'] };
  }

  // 1. displayName: 15%
  if (profile.displayName && profile.displayName.trim().length > 0) {
    score += 15;
  } else {
    missingFields.push('Full Name');
  }

  // 2. bio: 15%
  if (profile.bio && profile.bio.trim().length > 0) {
    score += 15;
  } else {
    missingFields.push('Bio');
  }

  // 3. photoURL: 20%
  if (profile.photoURL && profile.photoURL.trim().length > 0) {
    score += 20;
  } else {
    missingFields.push('Profile Picture');
  }

  // 4. departmentId: 15%
  if (profile.departmentId && profile.departmentId.trim().length > 0) {
    score += 15;
  } else {
    missingFields.push('Department Major');
  }

  // 5. batchYear: 15%
  if (profile.batchYear) {
    score += 15;
  } else {
    missingFields.push('Batch Graduation Year');
  }

  // 6. skills: 10%
  if (profile.skills && Array.isArray(profile.skills) && profile.skills.length > 0) {
    score += 10;
  } else {
    missingFields.push('Skills');
  }

  // 7. interests: 10%
  if (profile.interests && Array.isArray(profile.interests) && profile.interests.length > 0) {
    score += 10;
  } else {
    missingFields.push('Interests & Hobbies');
  }

  return { score, missingFields };
};
