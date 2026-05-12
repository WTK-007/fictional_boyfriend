const STORAGE_KEY = 'fb_user_uid';

export function getOrCreateUid(): string {
  if (typeof window === 'undefined') return '';
  let uid = window.localStorage.getItem(STORAGE_KEY);
  if (!uid) {
    uid = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, uid);
  }
  return uid;
}
