import { useEffect } from "react";
import type { ThemePreference } from "../../../types";

export function useThemePreference(theme: ThemePreference) {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyDarkClass = (isDark: boolean) => {
      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    if (theme === "system") {
      delete root.dataset.theme;
      applyDarkClass(media.matches);
      const handler = (event: MediaQueryListEvent) => {
        applyDarkClass(event.matches);
      };
      if (media.addEventListener) {
        media.addEventListener("change", handler);
      } else {
        media.addListener(handler);
      }
      return () => {
        if (media.removeEventListener) {
          media.removeEventListener("change", handler);
        } else {
          media.removeListener(handler);
        }
      };
    }

    root.dataset.theme = theme;
    applyDarkClass(theme === "dark");
  }, [theme]);
}
