import React from 'react'

interface EnvironmentContextValue {
  selectedEnvironment: string | null // null = all environments
  setSelectedEnvironment: (env: string | null) => void
}

const EnvironmentContext = React.createContext<EnvironmentContextValue>({
  selectedEnvironment: null,
  setSelectedEnvironment: () => {},
})

export function EnvironmentProvider({ children }: { children: React.ReactNode }) {
  const [selectedEnvironment, setSelectedEnvironment] = React.useState<string | null>(null)

  return (
    <EnvironmentContext.Provider value={{ selectedEnvironment, setSelectedEnvironment }}>
      {children}
    </EnvironmentContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEnvironment() {
  return React.useContext(EnvironmentContext)
}
