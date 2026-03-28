import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listProjects, createProject } from '@/http/projects/list'

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, slug }: { name: string; slug: string }) =>
      createProject(name, slug),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}
