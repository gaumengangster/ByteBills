import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export type TopClientRow = {
  name: string
  vatId: string
  country: string
  documentCount: number
  serviceDescriptions: string
  revenue: number
  averageValue: number
}

type TopClientsTableProps = {
  clients: TopClientRow[]
}

export function TopClientsTable({ clients }: TopClientsTableProps) {
  const formatEur = (amount: number, maximumFractionDigits = 2) => {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR",
      currencyDisplay: "symbol",
      minimumFractionDigits: 0,
      maximumFractionDigits,
    }).format(amount)
  }

  if (!clients.length) {
    return (
      <div className="flex justify-center items-center h-[200px] text-muted-foreground">
        No client data available for the selected period
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[140px]">Name</TableHead>
            <TableHead className="min-w-[120px]">VAT ID</TableHead>
            <TableHead className="min-w-[72px]">Country</TableHead>
            <TableHead className="text-right min-w-[90px] whitespace-nowrap">No. of documents</TableHead>
            <TableHead className="min-w-[220px] max-w-[360px]">Descriptions of services</TableHead>
            <TableHead className="text-right min-w-[110px] whitespace-nowrap">Revenue (EUR)</TableHead>
            <TableHead className="text-right min-w-[120px] whitespace-nowrap">Average value (EUR)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium align-top">{client.name}</TableCell>
              <TableCell className="font-mono text-sm align-top">{client.vatId}</TableCell>
              <TableCell className="align-top">{client.country}</TableCell>
              <TableCell className="text-right align-top tabular-nums">{client.documentCount}</TableCell>
              <TableCell className="text-sm text-muted-foreground align-top max-w-[360px]">
                {client.serviceDescriptions ? (
                  <span className="line-clamp-4" title={client.serviceDescriptions}>
                    {client.serviceDescriptions}
                  </span>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-right align-top tabular-nums">{formatEur(client.revenue)}</TableCell>
              <TableCell className="text-right align-top tabular-nums">
                {client.documentCount > 0 ? formatEur(client.averageValue) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
