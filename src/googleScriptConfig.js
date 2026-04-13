const env = import.meta?.env || {}
const runtimeConfig = globalThis?.__PENGUIN_CONFIG__ || {}

const DEFAULT_GOOGLE_SCRIPT_PROXY_URL = '/api/google-script'
const DEFAULT_GOOGLE_SCRIPT_URL = DEFAULT_GOOGLE_SCRIPT_PROXY_URL

function readConfigValue(name, fallback = '') {
  return String(runtimeConfig?.[name] || env?.[name] || fallback).trim()
}

export const GOOGLE_SCRIPT_URL = readConfigValue('VITE_GOOGLE_SCRIPT_URL', DEFAULT_GOOGLE_SCRIPT_URL)
export const GOOGLE_SCRIPT_CONFIGURED = Boolean(GOOGLE_SCRIPT_URL)
