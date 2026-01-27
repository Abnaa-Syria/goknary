import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../lib/api';

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  discountPrice?: number | null;
  stock: number;
  image?: string | null;
  attributes: Array<{ name: string; value: string }>;
  isDefault: boolean;
  status: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  discountPrice?: number;
  stock: number;
  ratingAvg: number;
  ratingCount: number;
  images: string[];
  hasVariants?: boolean;
  variants?: ProductVariant[];
  vendor: {
    id: string;
    storeName: string;
    slug: string;
    rating: number;
  };
  category: {
    id: string;
    name: string;
    slug: string;
  };
  brand?: {
    id: string;
    name: string;
    slug: string;
  };
}

interface ProductsState {
  products: Product[];
  product: Product | null;
  similarProducts: Product[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    categoryId?: string;
    brandId?: string;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    sort: string;
    search?: string;
  };
}

const initialState: ProductsState = {
  products: [],
  product: null,
  similarProducts: [],
  loading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 24,
    total: 0,
    totalPages: 0,
  },
  filters: {
    sort: 'relevance',
  },
};

export const fetchProducts = createAsyncThunk(
  'products/fetchProducts',
  async (params: any, { rejectWithValue }) => {
    try {
      const response = await api.get('/products', { params });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch products');
    }
  }
);

export const fetchProductBySlug = createAsyncThunk(
  'products/fetchProductBySlug',
  async (slug: string, { rejectWithValue }) => {
    try {
      const response = await api.get(`/products/${slug}`);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch product');
    }
  }
);

const productSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<ProductsState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = { sort: 'relevance' };
    },
    clearProduct: (state) => {
      state.product = null;
      state.similarProducts = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.products = action.payload.products.map((p: any) => ({
          ...p,
          images: typeof p.images === 'string' ? JSON.parse(p.images) : p.images,
        }));
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchProductBySlug.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProductBySlug.fulfilled, (state, action) => {
        state.loading = false;
        const productData = action.payload.product;
        state.product = {
          ...productData,
          images: typeof productData.images === 'string' ? JSON.parse(productData.images) : productData.images,
        };
        state.similarProducts = action.payload.similarProducts.map((p: any) => ({
          ...p,
          images: typeof p.images === 'string' ? JSON.parse(p.images) : p.images,
        }));
      })
      .addCase(fetchProductBySlug.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setFilters, clearFilters, clearProduct } = productSlice.actions;
export default productSlice.reducer;

