import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

interface AppPaginationProps {
  page: number
  totalPages: number
  setPage: (page: number) => void
}

export function AppPagination({
  page,
  totalPages,
  setPage,
}: AppPaginationProps) {
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={() => setPage(page > 1 ? page - 1 : 1)}
          />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink
            href="#"
            isActive={page === 1}
            onClick={() => setPage(1)}
          >
            1
          </PaginationLink>
        </PaginationItem>
        {page > 2 && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}
        {page > 1 && page < totalPages && (
          <PaginationItem>
            <PaginationLink href="#" isActive onClick={() => setPage(page)}>
              {page}
            </PaginationLink>
          </PaginationItem>
        )}
        {page < totalPages - 1 && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}
        {totalPages > 1 && (
          <PaginationItem>
            <PaginationLink
              href="#"
              isActive={page === totalPages}
              onClick={() => setPage(totalPages)}
            >
              {totalPages}
            </PaginationLink>
          </PaginationItem>
        )}
        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={() => setPage(page < totalPages ? page + 1 : totalPages)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
