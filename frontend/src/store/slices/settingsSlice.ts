import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../lib/api';

export interface SettingsState {
  freeShippingThreshold: number;
  supportPhone: string;
  facebookUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
  twitterUrl: string;
  loading: boolean;
  error: string | null;
}

const initialState: SettingsState = {
  freeShippingThreshold: 500,
  supportPhone: '',
  facebookUrl: '',
  instagramUrl: '',
  linkedinUrl: '',
  twitterUrl: '',
  loading: false,
  error: null,
};

// Fetch public settings for all users
export const fetchPublicSettings = createAsyncThunk(
  'settings/fetchPublic',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/settings/public');
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch settings');
    }
  }
);

// Fetch all settings for admin settings dashboard
export const fetchAdminSettings = createAsyncThunk(
  'settings/fetchAdmin',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/settings');
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch admin settings');
    }
  }
);

// Update settings (Admin-only)
export const updateSettings = createAsyncThunk(
  'settings/update',
  async (settingsData: Partial<Record<string, string>>, { rejectWithValue }) => {
    try {
      const response = await api.put('/settings', settingsData);
      return response.data.settings;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to update settings');
    }
  }
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Fetch Public Settings
      .addCase(fetchPublicSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPublicSettings.fulfilled, (state, action) => {
        state.loading = false;
        state.freeShippingThreshold = action.payload.freeShippingThreshold;
        state.supportPhone = action.payload.supportPhone;
        state.facebookUrl = action.payload.facebookUrl;
        state.instagramUrl = action.payload.instagramUrl;
        state.linkedinUrl = action.payload.linkedinUrl;
        state.twitterUrl = action.payload.twitterUrl;
      })
      .addCase(fetchPublicSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch Admin Settings
      .addCase(fetchAdminSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAdminSettings.fulfilled, (state, action) => {
        state.loading = false;
        state.freeShippingThreshold = action.payload.freeShippingThreshold;
        state.supportPhone = action.payload.supportPhone;
        state.facebookUrl = action.payload.facebookUrl;
        state.instagramUrl = action.payload.instagramUrl;
        state.linkedinUrl = action.payload.linkedinUrl;
        state.twitterUrl = action.payload.twitterUrl;
      })
      .addCase(fetchAdminSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Update Settings
      .addCase(updateSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateSettings.fulfilled, (state, action) => {
        state.loading = false;
        state.freeShippingThreshold = action.payload.freeShippingThreshold;
        state.supportPhone = action.payload.supportPhone;
        state.facebookUrl = action.payload.facebookUrl;
        state.instagramUrl = action.payload.instagramUrl;
        state.linkedinUrl = action.payload.linkedinUrl;
        state.twitterUrl = action.payload.twitterUrl;
      })
      .addCase(updateSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default settingsSlice.reducer;
