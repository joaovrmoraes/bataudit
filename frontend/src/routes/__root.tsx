import { queryClient } from '@/http/query-client'
import { QueryClientProvider } from '@tanstack/react-query'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Header} from "@/components/header"

export const Route = createRootRoute({
  component: () => (
    <>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-gradient-dark">
          <Header/>
          <Outlet />
        </div>
      </QueryClientProvider>
      <TanStackRouterDevtools />
    </>
  ),
})
