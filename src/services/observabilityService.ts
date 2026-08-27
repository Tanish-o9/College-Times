/**
 * Privacy-Safe Technical Event Observability Service
 */

export interface TechnicalEvent {
  id: string;
  type:
    | 'page_load'
    | 'api_error'
    | 'firestore_error'
    | 'storage_error'
    | 'function_error'
    | 'offline_entered'
    | 'offline_recovered'
    | 'search_error'
    | 'upload_error';
  metadata?: Record<string, any>;
  timestamp: number;
}

const localEventLog: TechnicalEvent[] = [];

/**
 * Tracks technical events without capturing sensitive personal data (passwords, OTPs, phone numbers, emails, DMs).
 */
export const trackTechnicalEvent = (
  type: TechnicalEvent['type'],
  metadata?: Record<string, any>
): void => {
  try {
    const sanitizedMeta = { ...metadata };
    delete sanitizedMeta.password;
    delete sanitizedMeta.otp;
    delete sanitizedMeta.phone;
    delete sanitizedMeta.email;
    delete sanitizedMeta.token;
    delete sanitizedMeta.content;

    const evt: TechnicalEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      metadata: sanitizedMeta,
      timestamp: Date.now(),
    };

    localEventLog.unshift(evt);
    if (localEventLog.length > 100) {
      localEventLog.pop();
    }
  } catch (err) {
    console.error('Failed to log observability event:', err);
  }
};

export const getTechnicalEventsLog = (): TechnicalEvent[] => {
  return [...localEventLog];
};
