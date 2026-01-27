import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../lib/api';
import { Product } from './productSlice';

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  price: number;
  discountPrice?: number;
  itemTotal: number;
}

interface CartState {
  items: CartItem[];
  subtotal: number;
  total: number;
  itemCount: number;
  loading: boolean;
  error: string | null;
}

const initialState: CartState = {
  items: [],
  subtotal: 0,
  total: 0,
  itemCount: 0,
  loading: false,
  error: null,
};

// Get or generate session ID for guest users
const getSessionId = (): string => {
  let sessionId = localStorage.getItem('cart_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    localStorage.setItem('cart_session_id', sessionId);
  }
  return sessionId;
};

export const fetchCart = createAsyncThunk(
  'cart/fetchCart',
  async (_, { rejectWithValue }) => {
    try {
      const sessionId = getSessionId();
      const response = await api.get('/cart', {
        headers: {
          'x-session-id': sessionId,
        },
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch cart');
    }
  }
);

export const addToCart = createAsyncThunk(
  'cart/addToCart',
  async ({ productId, quantity }: { productId: string; quantity: number }, { rejectWithValue, dispatch }) => {
    try {
      const sessionId = getSessionId();
      const response = await api.post(
        '/cart/items',
        { productId, quantity },
        {
          headers: {
            'x-session-id': sessionId,
          },
        }
      );
      // Refresh cart after adding
      dispatch(fetchCart());
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to add item to cart');
    }
  }
);

export const updateCartItem = createAsyncThunk(
  'cart/updateCartItem',
  async ({ itemId, quantity }: { itemId: string; quantity: number }, { rejectWithValue, dispatch }) => {
    try {
      const sessionId = getSessionId();
      await api.patch(
        `/cart/items/${itemId}`,
        { quantity },
        {
          headers: {
            'x-session-id': sessionId,
          },
        }
      );
      // Refresh cart after update
      dispatch(fetchCart());
      return { itemId, quantity };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to update cart item');
    }
  }
);

export const removeFromCart = createAsyncThunk(
  'cart/removeFromCart',
  async (itemId: string, { rejectWithValue, dispatch }) => {
    try {
      const sessionId = getSessionId();
      await api.delete(`/cart/items/${itemId}`, {
        headers: {
          'x-session-id': sessionId,
        },
      });
      // Refresh cart after removal
      dispatch(fetchCart());
      return itemId;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to remove item from cart');
    }
  }
);

export const clearCart = createAsyncThunk(
  'cart/clearCart',
  async (_, { rejectWithValue, dispatch }) => {
    try {
      const sessionId = getSessionId();
      await api.delete('/cart', {
        headers: {
          'x-session-id': sessionId,
        },
      });
      dispatch(fetchCart());
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to clear cart');
    }
  }
);

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    clearCartState: (state) => {
      state.items = [];
      state.subtotal = 0;
      state.total = 0;
      state.itemCount = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCart.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCart.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items.map((item: any) => ({
          ...item,
          product: {
            ...item.product,
            images: typeof item.product.images === 'string' ? JSON.parse(item.product.images) : item.product.images,
          },
        }));
        state.subtotal = action.payload.subtotal;
        state.total = action.payload.total;
        state.itemCount = action.payload.itemCount;
      })
      .addCase(fetchCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(addToCart.pending, (state) => {
        state.loading = true;
      })
      .addCase(addToCart.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(addToCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearCartState } = cartSlice.actions;
export default cartSlice.reducer;

