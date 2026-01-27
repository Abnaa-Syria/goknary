import { configureStore } from '@reduxjs/toolkit';
import productReducer from './slices/productSlice';
import categoryReducer from './slices/categorySlice';
import homeReducer from './slices/homeSlice';
import cartReducer from './slices/cartSlice';
import authReducer from './slices/authSlice';
import wishlistReducer from './slices/wishlistSlice';
import compareReducer from './slices/compareSlice';

export const store = configureStore({
  reducer: {
    products: productReducer,
    categories: categoryReducer,
    home: homeReducer,
    cart: cartReducer,
    auth: authReducer,
    wishlist: wishlistReducer,
    compare: compareReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

