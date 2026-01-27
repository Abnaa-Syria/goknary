import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../lib/api';
import { Product } from './productSlice';

export interface CompareItem {
  id: string;
  product: Product;
  createdAt: string;
}

interface CompareState {
  items: CompareItem[];
  count: number;
  loading: boolean;
  error: string | null;
  itemIds: string[]; // For quick lookup
}

const initialState: CompareState = {
  items: [],
  count: 0,
  loading: false,
  error: null,
  itemIds: [],
};

// Helper to get or generate session ID for guest users
const getSessionId = (): string => {
  let sessionId = localStorage.getItem('compare_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    localStorage.setItem('compare_session_id', sessionId);
  }
  return sessionId;
};

export const fetchCompare = createAsyncThunk(
  'compare/fetchCompare',
  async (_, { rejectWithValue }) => {
    try {
      const sessionId = getSessionId();
      const response = await api.get('/compare', {
        headers: {
          'x-session-id': sessionId,
        },
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch compare list');
    }
  }
);

export const addToCompare = createAsyncThunk(
  'compare/addToCompare',
  async (productId: string, { rejectWithValue, dispatch }) => {
    try {
      const sessionId = getSessionId();
      const response = await api.post(
        '/compare',
        { productId },
        {
          headers: {
            'x-session-id': sessionId,
          },
        }
      );
      dispatch(fetchCompare()); // Refresh compare list
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to add to compare');
    }
  }
);

export const removeFromCompare = createAsyncThunk(
  'compare/removeFromCompare',
  async (itemId: string, { rejectWithValue, dispatch }) => {
    try {
      const sessionId = getSessionId();
      await api.delete(`/compare/${itemId}`, {
        headers: {
          'x-session-id': sessionId,
        },
      });
      dispatch(fetchCompare()); // Refresh compare list
      return itemId;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to remove from compare');
    }
  }
);

export const clearCompare = createAsyncThunk(
  'compare/clearCompare',
  async (_, { rejectWithValue, dispatch }) => {
    try {
      const sessionId = getSessionId();
      await api.delete('/compare', {
        headers: {
          'x-session-id': sessionId,
        },
      });
      dispatch(fetchCompare()); // Refresh compare list
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to clear compare list');
    }
  }
);

const compareSlice = createSlice({
  name: 'compare',
  initialState,
  reducers: {
    clearCompareState: (state) => {
      state.items = [];
      state.count = 0;
      state.itemIds = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCompare.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCompare.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items.map((item: any) => ({
          ...item,
          product: {
            ...item.product,
            images: typeof item.product.images === 'string' ? JSON.parse(item.product.images) : item.product.images,
          },
        }));
        state.count = action.payload.count || action.payload.items.length;
        state.itemIds = state.items.map((item) => item.product.id);
      })
      .addCase(fetchCompare.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(addToCompare.pending, (state) => {
        state.loading = true;
      })
      .addCase(addToCompare.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(addToCompare.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(removeFromCompare.pending, (state) => {
        state.loading = true;
      })
      .addCase(removeFromCompare.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(removeFromCompare.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(clearCompare.pending, (state) => {
        state.loading = true;
      })
      .addCase(clearCompare.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(clearCompare.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearCompareState } = compareSlice.actions;
export default compareSlice.reducer;

