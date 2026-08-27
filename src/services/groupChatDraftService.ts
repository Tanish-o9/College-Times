/**
 * Local Storage Draft Service for Group Chat
 */

export const saveGroupChatDraft = (groupId: string, text: string): void => {
  if (!groupId) return;
  try {
    const key = `groupChatDraft:${groupId}`;
    if (!text || !text.trim()) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, text);
    }
  } catch (err) {
    console.error('Failed to save group chat draft:', err);
  }
};

export const getGroupChatDraft = (groupId: string): string => {
  if (!groupId) return '';
  try {
    const key = `groupChatDraft:${groupId}`;
    return localStorage.getItem(key) || '';
  } catch (err) {
    return '';
  }
};

export const clearGroupChatDraft = (groupId: string): void => {
  if (!groupId) return;
  try {
    const key = `groupChatDraft:${groupId}`;
    localStorage.removeItem(key);
  } catch (err) {
    console.error('Failed to clear group chat draft:', err);
  }
};
