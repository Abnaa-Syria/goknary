import { configureStore } from '@reduxjs/toolkit';
import productReducer from './slices/productSlice';
import categoryReducer from './slices/categorySlice';
import homeReducer from './slices/homeSlice';
import cartReducer from './slices/cartSlice';
import authReducer, { tokensSyncedFromStorage } from './slices/authSlice';
import wishlistReducer from './slices/wishlistSlice';
import compareReducer from './slices/compareSlice';
import settingsReducer from './slices/settingsSlice';

export const store = configureStore({
  reducer: {
    products: productReducer,
    categories: categoryReducer,
    home: homeReducer,
    cart: cartReducer,
    auth: authReducer,
    wishlist: wishlistReducer,
    compare: compareReducer,
    settings: settingsReducer,
  },
});

// `storage` events fire only in other tabs, so this keeps every tab's auth state in step.
window.addEventListener('storage', (event) => {
  if (event.key !== null && event.key !== 'accessToken' && event.key !== 'refreshToken') return;
  store.dispatch(
    tokensSyncedFromStorage({
      accessToken: localStorage.getItem('accessToken'),
      refreshToken: localStorage.getItem('refreshToken'),
    })
  );
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

