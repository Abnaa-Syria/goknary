import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../lib/api';

export interface User {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  avatar?: string;
  role: string;
  emailVerified: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

export type RegisterFulfilledPayload =
  | { requiresVerification: true; userId: string; message?: string }
  | {
      requiresVerification: false;
      user: User;
      accessToken: string;
      refreshToken: string;
    };

export type LoginRejectedPayload =
  | string
  | { verifyEmail: true; userId: string; email: string; message?: string };

const initialState: AuthState = {
  user: null,
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  isAuthenticated: !!localStorage.getItem('accessToken'),
  loading: false,
  error: null,
};

export const register = createAsyncThunk(
  'auth/register',
  async (
    { email, password, name }: { email: string; password: string; name?: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await api.post('/auth/register', { email, password, name, role: 'CUSTOMER' });
      const data = response.data;

      if (data.requiresVerification && data.userId) {
        return { requiresVerification: true as const, userId: data.userId, message: data.message };
      }

      if (data.accessToken && data.refreshToken && data.user) {
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        return {
          requiresVerification: false as const,
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        };
      }

      return rejectWithValue(data?.error || 'Registration failed');
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Registration failed');
    }
  }
);

export const verifyEmail = createAsyncThunk(
  'auth/verifyEmail',
  async ({ userId, otp }: { userId: string; otp: string }, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/verify-email', { userId, otp });
      const { user, accessToken, refreshToken } = response.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      return { user, accessToken, refreshToken };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Verification failed');
    }
  }
);

export const resendRegistrationOTP = createAsyncThunk(
  'auth/resendRegistrationOTP',
  async ({ userId }: { userId: string }, { rejectWithValue }) => {
    try {
      await api.post('/auth/resend-otp', { userId });
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to resend code');
    }
  }
);

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { user, accessToken, refreshToken } = response.data;

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      return { user, accessToken, refreshToken };
    } catch (error: any) {
      const res = error.response;
      if (res?.status === 403 && res.data?.requiresVerification && res.data?.userId) {
        return rejectWithValue({
          verifyEmail: true as const,
          userId: res.data.userId as string,
          email,
          message: res.data?.error,
        });
      }
      return rejectWithValue((res?.data?.error as string) || 'Login failed');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await api.post('/auth/logout');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('cart_session_id');
    } catch (error: any) {
      // Even if API call fails, clear local storage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('cart_session_id');
    }
  }
);

export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/auth/me');
      return response.data.user;
    } catch (error: any) {
      // If unauthorized, clear tokens
      if (error.response?.status === 401) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch user');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Register
      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        const p = action.payload as RegisterFulfilledPayload;
        if (p.requiresVerification) {
          return;
        }
        state.user = p.user;
        state.accessToken = p.accessToken;
        state.refreshToken = p.refreshToken;
        state.isAuthenticated = true;
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Login
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        const p = action.payload as LoginRejectedPayload;
        if (p && typeof p === 'object' && 'verifyEmail' in p && p.verifyEmail) {
          state.error = null;
          return;
        }
        state.error = typeof p === 'string' ? p : 'Login failed';
      })
      // Logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
      })
      // Get Current User
      .addCase(getCurrentUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(getCurrentUser.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        if (action.payload) {
          state.error = action.payload as string;
        }
      })
      // Verify email (OTP)
      .addCase(verifyEmail.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyEmail.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(verifyEmail.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(resendRegistrationOTP.pending, () => {})
      .addCase(resendRegistrationOTP.fulfilled, () => {})
      .addCase(resendRegistrationOTP.rejected, () => {});
  },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;

