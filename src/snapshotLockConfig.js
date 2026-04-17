const env = import.meta?.env || {}
const runtimeConfig = globalThis?.__PENGUIN_CONFIG__ || {}

function readConfigValue(name, fallback = '') {
  return String(runtimeConfig?.[name] || env?.[name] || fallback).trim()
}

function readConfigBoolean(name, fallback = false) {
  const raw = readConfigValue(name, '')
  if (!raw) return Boolean(fallback)
  const normalized = raw.toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return Boolean(fallback)
}

export const SNAPSHOT_LOCK_ENABLED = readConfigBoolean('VITE_SNAPSHOT_LOCK_ENABLED', true)
export const SNAPSHOT_LOCK_TITLE = readConfigValue('VITE_SNAPSHOT_LOCK_TITLE', 'Snapshot Taken')
export const SNAPSHOT_LOCK_NOTE = readConfigValue(
  'VITE_SNAPSHOT_LOCK_NOTE',
  'Please wait for Mint Day.'
)
