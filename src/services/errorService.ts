import { trackTechnicalEvent } from './observabilityService';

export type ErrorClass =
  | 'AUTH'
  | 'PERMISSION'
  | 'VALIDATION'
  | 'NETWORK'
  | 'FIRESTORE'
  | 'UPLOAD'
  | 'NOT_FOUND'
  | 'RATE_LIMIT'
  | 'UNKNOWN';

export interface AppError {
  code: string;
  message: string;
  category: ErrorClass;
  originalError?: any;
}

/**
 * Maps system exceptions to localized, user-friendly strings.
 * Classification shields internal structures from being presented to users.
 */
export const classifyAndMapError = (error: any): AppError => {
  const code = error?.code || error?.message || 'UNKNOWN';
  let message = 'An unexpected campus system error occurred. Please try again.';
  let category: ErrorClass = 'UNKNOWN';

  const codeStr = String(code).toLowerCase();

  // 1. Auth errors
  if (codeStr.includes('auth/')) {
    category = 'AUTH';
    if (codeStr.includes('wrong-password') || codeStr.includes('user-not-found')) {
      message = 'Incorrect email or password. Please verify credentials.';
    } else if (codeStr.includes('email-already-in-use')) {
      message = 'This college email is already registered to another account.';
    } else if (codeStr.includes('weak-password')) {
      message = 'Password is too weak. Must be at least 6 characters.';
    } else if (codeStr.includes('invalid-email')) {
      message = 'Please enter a valid academic email address.';
    } else if (codeStr.includes('user-disabled')) {
      message = 'This account has been suspended by campus moderators.';
    } else if (codeStr.includes('too-many-requests')) {
      message = 'Too many failed login attempts. Please wait a moment and try again.';
    } else {
      message = 'Authentication failed. Please verify credentials and try again.';
    }
  }
  // 2. Permission / Firebase rules
  else if (codeStr.includes('permission-denied') || codeStr.includes('permission_denied')) {
    category = 'PERMISSION';
    message = "You don't have authorization or membership permissions to perform this action.";
  }
  // 3. Network issues
  else if (
    codeStr.includes('network-request-failed') ||
    codeStr.includes('unavailable') ||
    codeStr.includes('offline') ||
    codeStr.includes('timeout')
  ) {
    category = 'NETWORK';
    message = 'Campus network connection is weak or offline. Please check your signal.';
  }
  // 4. Firestore / DB errors
  else if (codeStr.includes('firestore') || codeStr.includes('database')) {
    category = 'FIRESTORE';
    message = 'Campus database is currently busy. Please refresh the page.';
  }
  // 5. Upload errors
  else if (codeStr.includes('storage/') || codeStr.includes('upload')) {
    category = 'UPLOAD';
    if (codeStr.includes('quota-exceeded')) {
      message = 'Storage limit exceeded. Try uploading smaller media items.';
    } else {
      message = 'Failed to upload resources. Check file size limits and try again.';
    }
  }
  // 6. Validation / Input errors
  else if (codeStr.includes('validation') || codeStr.includes('invalid-argument')) {
    category = 'VALIDATION';
    message = 'Some submitted fields are invalid. Please check your entries.';
  }

  // Safe observability logging (excludes raw user content or tokens)
  trackTechnicalEvent(
    category === 'FIRESTORE' ? 'firestore_error' : 'api_error',
    {
      errorCode: code,
      errorCategory: category,
      errorMessage: error?.message || '',
    }
  );

  return {
    code,
    message,
    category,
    originalError: error,
  };
};
