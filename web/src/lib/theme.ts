import { useEffect, useState } from 'react'

// Light/dark: toggles the `dark` class on <html> (colors are remapped in index.css) and remembers the choice.
export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem('theme', dark ? 'dark' : 'light') } catch { /* private mode */ }
  }, [dark])
  return { dark, toggle: () => setDark((d) => !d) }
}
