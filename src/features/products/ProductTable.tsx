import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Edit, MoreHorizontal, Trash2 } from "lucide-react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import type { ProductCatalogRecord } from "./api";

const formatCurrency = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
};

const formatQuantity = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
};

type ProductTableProps = {
  products: ProductCatalogRecord[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onEdit: (product: ProductCatalogRecord) => void;
  onDelete: (product: ProductCatalogRecord) => void;
  onToggleEnabled: (product: ProductCatalogRecord, enabled: boolean) => void;
  updatingProductId?: string | null;
};

export const ProductTable = ({
  products,
  isLoading,
  total,
  page,
  pageSize,
  onPageChange,
  onEdit,
  onDelete,
  onToggleEnabled,
  updatingProductId,
}: ProductTableProps) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasData = products.length > 0;
  const latestUpdate = hasData
    ? products.reduce((latest, product) => {
        const date = new Date(product.updated_at);
        return date > latest ? date : latest;
      }, new Date(products[0].updated_at))
    : null;

  const renderRows = () => {
    if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={7}>
          <Skeleton className="h-12 w-full" />
        </TableCell>
      </TableRow>
    );
    }

    if (!hasData) {
      return (
        <TableRow>
          <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
            Aucun produit trouvé.
          </TableCell>
        </TableRow>
      );
    }

    return products.map((product) => (
      <TableRow key={product.id} className={!product.is_active ? "opacity-60" : undefined}>
        <TableCell className="font-medium">
          <div className="flex flex-col">
            <span>{product.name}</span>
            <span className="text-xs text-muted-foreground">{product.code || "Sans code"}</span>
          </div>
        </TableCell>
        <TableCell>
          {product.category ? <Badge variant="secondary">{product.category}</Badge> : <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell>
          {product.unit_type ? <span className="text-sm">{product.unit_type}</span> : <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="text-right">
          {formatCurrency(product.base_price_ht)}
        </TableCell>
        <TableCell className="text-right">
          {formatCurrency(product.price_ttc)}
        </TableCell>
        <TableCell>
          {product.supplier_name || <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-3">
            <Switch
              checked={product.is_active}
              onCheckedChange={(checked) => onToggleEnabled(product, checked)}
              disabled={updatingProductId === product.id}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={updatingProductId === product.id}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => onEdit(product)}>
                  <Edit className="mr-2 h-4 w-4" /> Modifier
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onDelete(product)} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>
    ));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Catégorie</TableHead>
            <TableHead>Unité</TableHead>
            <TableHead className="text-right">Prix HT</TableHead>
            <TableHead className="text-right">Prix TTC</TableHead>
            <TableHead>Fournisseur</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
          </TableHeader>
          <TableBody>{renderRows()}</TableBody>
        </Table>
      </div>
      {totalPages > 1 ? (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(event) => {
                event.preventDefault();
                onPageChange(Math.max(1, page - 1));
              }}
              className="cursor-pointer"
            />
          </PaginationItem>
          {Array.from({ length: totalPages }).map((_, index) => {
            const pageNumber = index + 1;
            const isActive = pageNumber === page;
            return (
              <PaginationItem key={pageNumber}>
                <PaginationLink
                  isActive={isActive}
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    onPageChange(pageNumber);
                  }}
                  className="cursor-pointer"
                >
                  {pageNumber}
                </PaginationLink>
              </PaginationItem>
            );
          })}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(event) => {
                event.preventDefault();
                onPageChange(Math.min(totalPages, page + 1));
              }}
              className="cursor-pointer"
            />
          </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
      {hasData && latestUpdate ? (
        <p className="text-xs text-muted-foreground text-right">
          Dernière mise à jour :
          {" "}
          {format(latestUpdate, "dd MMM yyyy à HH:mm", { locale: fr })}
        </p>
      ) : null}
    </div>
  );
};
