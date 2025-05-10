import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type TopClientsTableProps = {
  clients: Array<{
    name: string
    revenue: number
    documents: number
  }>
}

export function TopClientsTable({ clients }: TopClientsTableProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Client Name</TableHead>
          <TableHead className="text-right">Documents</TableHead>
          <TableHead className="text-right">Revenue</TableHead>
          <TableHead className="text-right">Average Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((client, index) => (
          <TableRow key={index}>
            <TableCell className="font-medium">{client.name}</TableCell>
            <TableCell className="text-right">{client.documents}</TableCell>
            <TableCell className="text-right">{formatCurrency(client.revenue)}</TableCell>
            <TableCell className="text-right">
              {formatCurrency(client.revenue / client.documents)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
