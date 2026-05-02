import { clearTokens, getAccessToken, getRefreshToken, setTokens } from './auth-storage'
import type { LoginResponse, RefreshResponse, UserMe } from './api-types'

function normalizeApiBaseUrl(raw: string): string {
  let base = raw.trim().replace(/\/$/, '')
  // Swagger UI lives at /docs; API paths are /api/v1/... — avoid /docs/api/v1 in env.
  base = base.replace(/\/docs\/api\/v1$/i, '/api/v1')
  return base
}

const BASE_URL = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1',
)

export function getApiBaseUrl(): string {
  return BASE_URL
}

type FastApiErrorBody = {
  detail?: string | Array<{ loc?: unknown[]; msg: string; type?: string }> | Record<string, string>
}

export function formatApiError(body: FastApiErrorBody): string {
  const { detail } = body
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg).filter(Boolean).join('; ') || 'Request failed'
  }
  if (detail && typeof detail === 'object') {
    return Object.entries(detail)
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ')
  }
  return 'Request failed'
}

let refreshPromise: Promise<boolean> | null = null

async function tryRefreshToken(): Promise<boolean> {
  const refresh = getRefreshToken()
  if (!refresh) return false

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refresh }),
        })
        if (!res.ok) return false
        const data = (await res.json()) as RefreshResponse
        const nextRefresh = getRefreshToken()
        if (nextRefresh) setTokens(data.access_token, nextRefresh)
        else setTokens(data.access_token, refresh)
        return true
      } catch {
        return false
      } finally {
        refreshPromise = null
      }
    })()
  }
  return refreshPromise
}

export type ApiRequestOptions = RequestInit & {
  /** When false, do not send Authorization header or attempt refresh. Default true. */
  auth?: boolean
}

export async function apiRequest<T>(path: string, init: ApiRequestOptions = {}): Promise<T> {
  const { auth = true, ...reqInit } = init
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`
  const headers = new Headers(reqInit.headers)

  if (
    !headers.has('Content-Type') &&
    reqInit.body &&
    typeof reqInit.body === 'string'
  ) {
    headers.set('Content-Type', 'application/json')
  }

  if (auth) {
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  const doFetch = () => fetch(url, { ...reqInit, headers })

  let res = await doFetch()

  if (res.status === 401 && auth) {
    const ok = await tryRefreshToken()
    if (ok) {
      const h2 = new Headers(reqInit.headers)
      if (
        !h2.has('Content-Type') &&
        reqInit.body &&
        typeof reqInit.body === 'string'
      ) {
        h2.set('Content-Type', 'application/json')
      }
      const token = getAccessToken()
      if (token) h2.set('Authorization', `Bearer ${token}`)
      res = await fetch(url, { ...reqInit, headers: h2 })
    } else {
      clearTokens()
    }
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as FastApiErrorBody
    throw new Error(formatApiError(body))
  }

  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  /** OpenAPI: OAuth2-style form body; `username` holds the user's email. */
  const body = {  email, password }
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    auth: false,
  })
}

export async function registerRequest(body: {
  full_name: string
  email: string
  /** API field; `phone` is accepted as an alias from older forms */
  phone_number?: string
  // phone?: string
  password: string
  is_admin?: boolean
  is_active?: boolean
}) {
  const { phone_number, password, full_name, email, is_admin, is_active } = body
  const num = phone_number
  const payload = {
    full_name,
    email,
    password,
    ...(num !== undefined && num !== '' ? { phone_number: num } : {}),
    is_admin: is_admin ?? false,
    is_active: is_active ?? true,
  }
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
    auth: false,
  })
}

export async function logoutRequest(): Promise<void> {
  try {
    await apiRequest<{ message?: string }>('/auth/logout', { method: 'POST' })
  } catch {
    /* still clear client session */
  }
}

export async function fetchCurrentUser(): Promise<UserMe> {
  return apiRequest<UserMe>('/users/me')
}
