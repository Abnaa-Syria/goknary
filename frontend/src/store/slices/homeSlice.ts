import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../lib/api';
import { Product } from './productSlice';

export interface Banner {
  id: string;
  title?: string;
  imageUrl: string;
  linkUrl?: string;
  type: string;
}

export interface HomeSection {
  id: string;
  type: string;
  title: string;
  products: Product[];
}

interface HomeState {
  banners: Banner[];
  sections: HomeSection[];
  loading: boolean;
  error: string | null;
}

const initialState: HomeState = {
  banners: [],
  sections: [],
  loading: false,
  error: null,
};

export const fetchHomeSections = createAsyncThunk(
  'home/fetchHomeSections',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/home/sections');
      const data = response.data;
      
      // Parse images for products
      const sections = data.sections.map((section: any) => ({
        ...section,
        products: section.products.map((p: any) => ({
          ...p,
          images: typeof p.images === 'string' ? JSON.parse(p.images) : p.images,
        })),
      }));
      
      return {
        banners: data.banners,
        sections,
      };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || 'Failed to fetch home sections');
    }
  }
);

const homeSlice = createSlice({
  name: 'home',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchHomeSections.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchHomeSections.fulfilled, (state, action) => {
        state.loading = false;
        state.banners = action.payload.banners;
        state.sections = action.payload.sections;
      })
      .addCase(fetchHomeSections.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default homeSlice.reducer;

