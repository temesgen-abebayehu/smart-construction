const ACCESS = 'cms_access_token'
const REFRESH = 'cms_refresh_token'

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACCESS)
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH)
}

export function setTokens(access: string, refresh: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACCESS, access)
  localStorage.setItem(REFRESH, refresh)
}

export function clearTokens() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ACCESS)
  localStorage.removeItem(REFRESH)
}
