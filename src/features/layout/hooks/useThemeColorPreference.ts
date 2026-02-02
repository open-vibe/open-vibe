import { useEffect } from "react";
import type { ThemeColor } from "../../../types";

export function useThemeColorPreference(themeColor: ThemeColor) {
  useEffect(() => {
    const root = document.documentElement;
    if (themeColor) {
      root.dataset.themeColor = themeColor;
    } else {
      delete root.dataset.themeColor;
    }
  }, [themeColor]);
}
