import { queryClient } from '@/http/query-client'
import { QueryClientProvider } from '@tanstack/react-query'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { ProjectProvider } from '@/lib/project-context'
import { EnvironmentProvider } from '@/lib/environment-context'

export const Route = createRootRoute({
  component: () => (
    <>
      <QueryClientProvider client={queryClient}>
        <ProjectProvider>
          <EnvironmentProvider>
            <Outlet />
          </EnvironmentProvider>
        </ProjectProvider>
      </QueryClientProvider>
      <TanStackRouterDevtools />
    </>
  ),
})
