import React from 'react'

interface ProjectContextValue {
  selectedProjectId: string | null // null = all projects
  setSelectedProjectId: (id: string | null) => void
}

const ProjectContext = React.createContext<ProjectContextValue>({
  selectedProjectId: null,
  setSelectedProjectId: () => {},
})

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null)

  return (
    <ProjectContext.Provider value={{ selectedProjectId, setSelectedProjectId }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  return React.useContext(ProjectContext)
}
