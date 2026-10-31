import { create } from 'zustand';

/** Becomes true once the launch screen is gone, so entrances play where the user can see them. */
export const useLaunch = create<{ revealed: boolean; reveal: () => void }>((set) => ({
  revealed: false,
  reveal: () => set({ revealed: true }),
}));
