import { useState, useEffect, createContext, useContext } from "react";
import { apiRequest } from "@/lib/queryClient";

type Theme = "dark" | "light";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start with dark (default). We'll update from the backend on mount.
  const [theme, setTheme] = useState<Theme>("dark");
  const [loaded, setLoaded] = useState(false);

  // Apply theme class immediately whenever it changes
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Load persisted theme from backend on first mount
  useEffect(() => {
    apiRequest("GET", "/api/settings/theme")
      .then((res) => res.json())
      .then((data) => {
        if (data.value === "light" || data.value === "dark") {
          setTheme(data.value);
        }
      })
      .catch(() => { /* keep default dark */ })
      .finally(() => setLoaded(true));
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    // Persist to backend (fire-and-forget)
    apiRequest("POST", "/api/settings/theme", { value: next }).catch(() => {});
  };

  // Render children immediately — the brief dark flash before load is acceptable
  // and avoids a blank screen while waiting for the network.
  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
