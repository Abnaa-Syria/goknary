import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../lib/api';
import { Product } from './productSlice';

export interface WishlistItem {
  id: string;
  product: Product;
  createdAt: string;
}

interface WishlistState {
  items: WishlistItem[];
  count: number;
  loading: boolean;
  error: string | null;
  itemIds: string[]; // For quick lookup
}

const initialState: WishlistState = {
  items: [],
  count: 0,
  loading: false,
  error: null,
  itemIds: [],
};

export const fetchWishlist = createAsyncThunk(
  'wishlist/fetchWishlist',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/wishlist');
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch wishlist');
    }
  }
);

export const addToWishlist = createAsyncThunk(
  'wishlist/addToWishlist',
  async (productId: string, { rejectWithValue, dispatch }) => {
    try {
      const response = await api.post('/wishlist', { productId });
      dispatch(fetchWishlist()); // Refresh wishlist
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to add to wishlist');
    }
  }
);

export const removeFromWishlist = createAsyncThunk(
  'wishlist/removeFromWishlist',
  async (itemId: string, { rejectWithValue, dispatch }) => {
    try {
      await api.delete(`/wishlist/${itemId}`);
      dispatch(fetchWishlist()); // Refresh wishlist
      return itemId;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to remove from wishlist');
    }
  }
);

export const removeFromWishlistByProductId = createAsyncThunk(
  'wishlist/removeFromWishlistByProductId',
  async (productId: string, { rejectWithValue, dispatch }) => {
    try {
      await api.delete(`/wishlist/product/${productId}`);
      dispatch(fetchWishlist()); // Refresh wishlist
      return productId;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to remove from wishlist');
    }
  }
);

export const checkWishlistStatus = createAsyncThunk(
  'wishlist/checkWishlistStatus',
  async (productId: string, { rejectWithValue }) => {
    try {
      const response = await api.get(`/wishlist/check/${productId}`);
      return { productId, inWishlist: response.data.inWishlist };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to check wishlist status');
    }
  }
);

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    clearWishlistState: (state) => {
      state.items = [];
      state.count = 0;
      state.itemIds = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWishlist.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWishlist.fulfilled, (state, action) => {
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
      .addCase(fetchWishlist.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(addToWishlist.pending, (state) => {
        state.loading = true;
      })
      .addCase(addToWishlist.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(addToWishlist.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(removeFromWishlist.pending, (state) => {
        state.loading = true;
      })
      .addCase(removeFromWishlist.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(removeFromWishlist.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(removeFromWishlistByProductId.pending, (state) => {
        state.loading = true;
      })
      .addCase(removeFromWishlistByProductId.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(removeFromWishlistByProductId.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearWishlistState } = wishlistSlice.actions;
export default wishlistSlice.reducer;

