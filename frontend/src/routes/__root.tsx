import { queryClient } from '@/http/query-client'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export const Route = createRootRoute({
  component: () => (
    <>
      <QueryClientProvider client={queryClient}>
        <div className='bg-zinc-950 text-zinc-50 h-screen w-screen overflow-hidden p-4'>
          <Outlet />
        </div>
      </QueryClientProvider>
      <TanStackRouterDevtools />
    </>
  ),
})