import axios from 'axios';
import { getCartSessionId } from './cartSession';

// Default to the deployment origin. Local development is proxied by react-scripts,
// while split-origin deployments can provide REACT_APP_API_URL at build time.
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const REFRESH_LOCK_NAME = 'goknary-token-refresh';
// How long to wait for another tab to publish a rotated token before giving up on the session.
const CROSS_TAB_ROTATION_WAIT_MS = 2000;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const clearAuthSession = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  delete api.defaults.headers.common['Authorization'];
};

/** Saves a token pair issued outside the refresh flow (e.g. a password change revokes the old pair). */
export const storeAuthTokens = (accessToken?: string, refreshToken?: string) => {
  if (!accessToken || !refreshToken) return;
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // M-03 Fix: Attach guest session ID for cart merging
    const sessionId = getCartSessionId();
    if (sessionId) {
      config.headers['x-session-id'] = sessionId;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (error: any) => void }[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

const NO_RETRY_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'];

const isAuthFailure = (error: any) => {
  const status = error?.response?.status;
  return status === 401 || status === 403;
};

const getBearerToken = (headers: any): string | null => {
  const value = headers?.Authorization ?? headers?.authorization;
  return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice(7) : null;
};

const endSession = () => {
  clearAuthSession();
  window.location.href = '/login';
};

// Serializes refreshes across tabs where the Web Locks API exists; otherwise runs directly.
const withRefreshLock = <T,>(task: () => Promise<T>): Promise<T> => {
  const locks = (navigator as any).locks;
  if (locks?.request) {
    return locks.request(REFRESH_LOCK_NAME, task);
  }
  return task();
};

// Resolves with the newer refresh token if another tab rotates `staleToken`, or null on timeout/logout.
const waitForRotatedToken = (staleToken: string, timeoutMs: number): Promise<string | null> =>
  new Promise((resolve) => {
    const current = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (current !== staleToken) {
      resolve(current);
      return;
    }

    const finish = (value: string | null) => {
      window.clearTimeout(timer);
      window.removeEventListener('storage', onStorage);
      resolve(value);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === REFRESH_TOKEN_KEY && event.newValue !== staleToken) {
        finish(event.newValue);
      }
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    window.addEventListener('storage', onStorage);
  });

class SessionMissingError extends Error {}

/**
 * Returns a valid access token, refreshing at most once across tabs.
 * Throws the refresh error when the session cannot be renewed.
 */
const refreshAccessToken = (staleRefreshToken: string): Promise<string> =>
  withRefreshLock(async () => {
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!storedRefreshToken) {
      throw new SessionMissingError();
    }

    // Another tab refreshed while this one waited for the lock.
    const storedAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (storedRefreshToken !== staleRefreshToken && storedAccessToken) {
      return storedAccessToken;
    }

    try {
      // Use a fresh axios instance to avoid interceptor loops
      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refreshToken: storedRefreshToken,
      });
      const { accessToken, refreshToken: newRefreshToken } = response.data;

      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);

      return accessToken;
    } catch (refreshError) {
      if (!isAuthFailure(refreshError)) {
        throw refreshError;
      }

      // A rejected token may simply have been rotated by another tab a moment earlier.
      const rotated = await waitForRotatedToken(storedRefreshToken, CROSS_TAB_ROTATION_WAIT_MS);
      const rotatedAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (rotated && rotatedAccessToken) {
        return rotatedAccessToken;
      }
      throw refreshError;
    }
  });

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Prevent loops for login, refresh and logout endpoints
      if (NO_RETRY_PATHS.some((path) => originalRequest.url?.includes(path))) {
        return Promise.reject(error);
      }

      // The token was already replaced (by a parallel refresh or another tab) — just retry.
      const sentToken = getBearerToken(originalRequest.headers);
      const currentAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (sentToken && currentAccessToken && sentToken !== currentAccessToken) {
        originalRequest._retry = true;
        originalRequest.headers.Authorization = `Bearer ${currentAccessToken}`;
        return api(originalRequest);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest._retry = true;
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;

      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

      if (!refreshToken) {
        endSession();
        return Promise.reject(error);
      }

      isRefreshing = true;

      try {
        const accessToken = await refreshAccessToken(refreshToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        processQueue(null, accessToken);

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);

        // Only a definitive rejection of the refresh token ends the session.
        // Network errors, 429 and 5xx keep the tokens so a later request can retry.
        if (refreshError instanceof SessionMissingError) {
          endSession();
          return Promise.reject(error);
        }
        if (isAuthFailure(refreshError)) {
          endSession();
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
