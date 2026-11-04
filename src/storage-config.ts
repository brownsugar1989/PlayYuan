/** Public Worker URL; configure as a Vite environment variable when building. */
export const STORAGE_API_URL = (import.meta.env.VITE_STORAGE_API_URL || '').replace(/\/$/, '');
