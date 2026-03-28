import { Sun, Moon } from 'lucide-react'
import { Button } from './ui/button'
import { toggleTheme, getStoredTheme } from '@/lib/theme'
import React from 'react'

export function ThemeToggle() {
  const [theme, setTheme] = React.useState(getStoredTheme)

  function handleToggle() {
    const next = toggleTheme()
    setTheme(next)
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleToggle} className="h-8 w-8 p-0">
      {theme === 'dark' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  )
}
