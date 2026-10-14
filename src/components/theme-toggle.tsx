"use client";

let transitionTimeout: number | undefined;

export function ThemeToggle() {
  const toggleTheme = () => {
    const root = document.documentElement;
    const theme = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.themeTransition = "true";
    root.dataset.theme = theme;

    try {
      window.localStorage.setItem("role-log-theme", theme);
    } catch {
      // The theme still changes for this visit when storage is unavailable.
    }

    window.clearTimeout(transitionTimeout);
    transitionTimeout = window.setTimeout(() => {
      delete root.dataset.themeTransition;
      transitionTimeout = undefined;
    }, 420);
  };

  return (
    <button className="theme-toggle" type="button" aria-label="Toggle light and dark mode" title="Toggle light and dark mode" onClick={toggleTheme}>
      <svg className="theme-icon theme-icon-moon" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.2 15.4A8.5 8.5 0 0 1 8.6 3.8 8.5 8.5 0 1 0 20.2 15.4Z" />
      </svg>
      <svg className="theme-icon theme-icon-sun" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
      </svg>
    </button>
  );
}
