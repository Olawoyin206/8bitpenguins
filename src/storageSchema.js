const STORAGE_SCHEMA_VERSION_KEY = 'penguin:storage-schema-version'
const STORAGE_SCHEMA_VERSION = '2026-04-01.1'

const LEGACY_STORAGE_PREFIXES = [
  'penguin:',
  'arcade',
  'puzzle',
]

const LEGACY_STORAGE_KEYS = new Set([
  'taskSubmission',
  'savedPenguins',
  'cachedGallery',
])

function shouldRemoveKey(key) {
  if (!key || key === STORAGE_SCHEMA_VERSION_KEY) return false
  if (LEGACY_STORAGE_KEYS.has(key)) return true
  return LEGACY_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))
}

export function applyStorageSchemaMigration() {
  if (typeof window === 'undefined') return

  let storage
  try {
    storage = window.localStorage
  } catch {
    return
  }

  if (!storage) return

  try {
    const currentVersion = storage.getItem(STORAGE_SCHEMA_VERSION_KEY)
    if (currentVersion === STORAGE_SCHEMA_VERSION) return

    const keys = []
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (key) keys.push(key)
    }

    for (const key of keys) {
      if (shouldRemoveKey(key)) {
        storage.removeItem(key)
      }
    }

    storage.setItem(STORAGE_SCHEMA_VERSION_KEY, STORAGE_SCHEMA_VERSION)
  } catch {
    // Ignore storage migration failures and continue bootstrapping.
  }
}
