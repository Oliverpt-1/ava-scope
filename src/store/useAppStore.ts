import { create } from 'zustand';

export interface AppState {
  selectedSubnetId: string | null;
  setSelectedSubnetId: (id: string | null) => void;
}

type Setter = (partial: Partial<AppState>) => void;

export const useAppStore = create<AppState>((set: Setter) => ({
  selectedSubnetId: null,
  setSelectedSubnetId: (id: string | null) => set({ selectedSubnetId: id }),
})); 