import { useEffect, useState, useCallback } from "react";

type Theme = "dark" | "light";
const KEY = "rota013-theme";

function apply(theme: Theme) {
  const el = document.documentElement;
  if (theme === "light") {
    el.classList.add("light");
    el.classList.remove("dark");
  } else {
    el.classList.add("dark");
    el.classList.remove("light");
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem(KEY) as Theme | null) ?? "dark";
  });

  useEffect(() => {
    apply(theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, setTheme, toggle };
}
