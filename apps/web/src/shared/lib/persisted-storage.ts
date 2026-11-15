/** Read the renamed browser key without losing data from earlier releases.
 * Keep the old copy for rollback; never overwrite an existing new value. */
export function readPersistedValue(key: string): string | null {
  const current = localStorage.getItem(key);
  if (current !== null || !key.startsWith("raahi.")) return current;
  const previous = localStorage.getItem(`opentrip.${key.slice("raahi.".length)}`);
  if (previous === null) return null;
  try {
    localStorage.setItem(key, previous);
  } catch {
    // Quota/full storage must not hide the user's existing journal or settings.
    // The next read retries this explicit migration.
  }
  return previous;
}
