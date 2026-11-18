import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'

export default function DataTable<T>({
  columns,
  data,
  loading = false,
  emptyTitle,
  emptyDescription,
  page,
  limit,
  total,
  onPageChange,
}: {
  columns: ColumnDef<T, unknown>[]
  data: T[]
  loading?: boolean
  emptyTitle: string
  emptyDescription?: string
  page: number
  limit: number
  total: number
  onPageChange: (page: number) => void
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.max(1, Math.ceil(total / limit)),
  })

  const totalPages = Math.max(1, Math.ceil(total / limit))

  if (!loading && data.length === 0) {
    return (
      <div className="table-empty">
        <p className="table-empty-title">{emptyTitle}</p>
        {emptyDescription ? <p className="table-empty-desc">{emptyDescription}</p> : null}
      </div>
    )
  }

  return (
    <div>
      <div className="table-shell">
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, rowIndex) => (
                  <tr key={`skel-${rowIndex}`}>
                    {columns.map((_, colIndex) => (
                      <td key={colIndex}>
                        <span className="skel skel-row" />
                      </td>
                    ))}
                  </tr>
                ))
              : table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      <div className="table-pager">
        <span className="table-pager-info">
          Halaman <span className="num">{page}</span> dari <span className="num">{totalPages}</span>
          <span className="table-pager-total">· {total} baris</span>
        </span>
        <div className="table-pager-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
          >
            Sebelumnya
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
          >
            Berikutnya
          </button>
        </div>
      </div>
    </div>
  )
}
