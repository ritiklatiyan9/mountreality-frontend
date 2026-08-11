export const LIGHT_THEME = 'light';
export const DARK_THEME = 'dark';

export const normaliseTheme = (theme) => (theme === DARK_THEME ? DARK_THEME : LIGHT_THEME);

export const currentTheme = () => (
  typeof document !== 'undefined' && document.documentElement.classList.contains(DARK_THEME)
    ? DARK_THEME
    : LIGHT_THEME
);

export const applyTheme = (theme, { persist = true } = {}) => {
  const nextTheme = normaliseTheme(theme);
  if (typeof document === 'undefined') return nextTheme;

  const root = document.documentElement;
  root.classList.toggle(DARK_THEME, nextTheme === DARK_THEME);
  root.style.colorScheme = nextTheme;
  if (persist) localStorage.setItem('theme', nextTheme);
  return nextTheme;
};

// The signed-out experience is deliberately neutral. A new user on a shared
// device must never inherit the prior user's dark-mode preference.
export const resetThemeToWhite = () => {
  localStorage.removeItem('theme');
  return applyTheme(LIGHT_THEME, { persist: false });
};
