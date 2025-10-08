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

type ProductTableProps = {
  products: ProductCatalogRecord[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onEdit: (product: ProductCatalogRecord) => void;
  onDelete: (product: ProductCatalogRecord) => void;
  onToggleActive: (product: ProductCatalogRecord, enabled: boolean) => void;
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
  onToggleActive,
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
          <TableCell colSpan={5}>
            <Skeleton className="h-12 w-full" />
          </TableCell>
        </TableRow>
      );
    }

    if (!hasData) {
      return (
        <TableRow>
          <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
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
            {product.description ? (
              <span className="text-xs text-muted-foreground line-clamp-2">{product.description}</span>
            ) : null}
          </div>
        </TableCell>
        <TableCell className="whitespace-nowrap">{product.code || "—"}</TableCell>
        <TableCell>
          {product.category ? <Badge variant="secondary">{product.category}</Badge> : <span className="text-muted-foreground">—</span>}
        </TableCell>
        <TableCell>
          {product.is_active ? (
            <Badge variant="secondary">Actif</Badge>
          ) : (
            <Badge variant="outline">Inactif</Badge>
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-3">
            <Switch
              checked={product.is_active}
              onCheckedChange={(checked) => onToggleActive(product, checked)}
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
              <TableHead>Code</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Statut</TableHead>
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
