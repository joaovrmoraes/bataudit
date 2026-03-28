import { useQuery } from '@tanstack/react-query'
import { getHealthDetails } from '@/http/health/details'

export function useHealthDetails() {
  return useQuery({
    queryKey: ['health'],
    queryFn: getHealthDetails,
  })
}
