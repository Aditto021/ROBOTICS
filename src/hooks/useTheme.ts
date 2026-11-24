import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "dark" ? "dark" : "light";
}

export function useTheme() {
  // The inline script in index.html sets light mode before React mounts, so
  // every visit lands in light. The toggle switches theme for this visit only
  // (nothing is saved, so the next visit is light again).
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggle };
}
