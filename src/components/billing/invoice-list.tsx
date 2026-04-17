import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileDown } from "lucide-react";
import { formatInvoiceAmount } from "@/lib/stripe/invoices";
import type { Invoice, InvoiceStatus } from "@/types/database";

interface InvoiceListProps {
  invoices: Invoice[];
}

const STATUS_VARIANT: Record<
  InvoiceStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  paid: "default",
  open: "secondary",
  draft: "outline",
  uncollectible: "destructive",
  void: "outline",
};

export function InvoiceList({ invoices }: InvoiceListProps) {
  if (invoices.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No invoices yet. Your first invoice will appear after your trial ends.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.id}>
            <TableCell className="text-sm">
              {new Date(invoice.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </TableCell>
            <TableCell className="font-medium">
              {formatInvoiceAmount(invoice.amount_paid || invoice.amount_due, invoice.currency)}
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[invoice.status]} className="capitalize">
                {invoice.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                {invoice.hosted_invoice_url && (
                  <Button variant="ghost" size="sm" asChild>
                    <a
                      href={invoice.hosted_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
                {invoice.invoice_pdf && (
                  <Button variant="ghost" size="sm" asChild>
                    <a
                      href={invoice.invoice_pdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                    >
                      <FileDown className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
