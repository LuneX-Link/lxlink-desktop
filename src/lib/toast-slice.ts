import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { ToastProps } from "../components/ui/toast/toast";

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  type: ToastProps["type"];
  duration?: number;
}

export interface ToastState {
  toasts: ToastItem[];
}

let toastId = 0;

const initialState: ToastState = {
  toasts: [],
};

export const toastSlice = createSlice({
  name: "toast",
  initialState,
  reducers: {
    showToast: (state, action: PayloadAction<Omit<ToastItem, "id">>) => {
      const id = `toast-${++toastId}`;
      state.toasts.push({ ...action.payload, id });
    },
    closeToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
  },
});

export const { showToast, closeToast } = toastSlice.actions;
