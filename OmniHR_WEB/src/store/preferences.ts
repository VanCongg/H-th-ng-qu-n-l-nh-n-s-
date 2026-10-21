import { create } from "zustand";

export type AppLanguage = "en" | "vi";

const LANGUAGE_KEY = "omnihr_language";

type PreferencesState = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  hydrate: () => void;
};

export const usePreferencesStore = create<PreferencesState>((set) => ({
  language: "en",

  setLanguage: (language) => {
    localStorage.setItem(LANGUAGE_KEY, language);
    set({ language });
  },

  hydrate: () => {
    const storedLanguage = localStorage.getItem(LANGUAGE_KEY);
    if (storedLanguage === "en" || storedLanguage === "vi") {
      set({ language: storedLanguage });
    }
  }
}));
