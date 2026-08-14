import { configureStore } from "@reduxjs/toolkit";
import { toastSlice } from "./toast-slice";
import { debugLoggerMiddleware } from "./redux-logger";

export const store = configureStore({
  reducer: {
    toast: toastSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(debugLoggerMiddleware),
  devTools: process.env.NODE_ENV !== 'production', // Enable in development
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
