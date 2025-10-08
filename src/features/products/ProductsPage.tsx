import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useOrg } from "@/features/organizations/OrgContext";
import {
  useCategories,
  useDeleteProduct,
  useProductCatalog,
  useUpdateProduct,
  type ProductCatalogRecord,
} from "./api";
import { ProductFormDialog } from "./ProductFormDialog";
import { ProductTable } from "./ProductTable";

const STATUS_OPTIONS = [
  { label: "Tous", value: "all" as const },
  { label: "Actifs", value: "active" as const },
  { label: "Inactifs", value: "inactive" as const },
];

const PAGE_SIZE = 10;

export const ProductsPage = () => {
  const { currentOrgId } = useOrg();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]["value"]>("all");
  const [page, setPage] = useState(1);
  const [productToDelete, setProductToDelete] = useState<ProductCatalogRecord | null>(null);
  const [editingProduct, setEditingProduct] = useState<ProductCatalogRecord | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, categoryFilter, statusFilter]);

  const { data: categoriesData } = useCategories(currentOrgId);
  const categories = categoriesData ?? [];

  const filters = useMemo(
    () => ({
      search: deferredSearch,
      category: categoryFilter !== "all" ? categoryFilter : undefined,
      isActive: statusFilter === "all" ? undefined : statusFilter === "active",
    }),
    [deferredSearch, categoryFilter, statusFilter],
  );

  const {
    data: catalogResult,
    isLoading: isCatalogLoading,
    isError,
    error,
  } = useProductCatalog(currentOrgId, filters, { page, pageSize: PAGE_SIZE });

  useEffect(() => {
    if (isError && error) {
      const message = error instanceof Error ? error.message : "Impossible de charger les produits";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    }
  }, [isError, error, toast]);

  const products = catalogResult?.data ?? [];
  const total = catalogResult?.count ?? 0;

  const updateProduct = useUpdateProduct(currentOrgId);
  const deleteProduct = useDeleteProduct(currentOrgId);

  useEffect(() => {
    if (page > 1 && products.length === 0 && total > 0) {
      setPage((previous) => Math.max(1, previous - 1));
    }
  }, [page, products.length, total]);

  const handleToggleActive = async (product: ProductCatalogRecord, enabled: boolean) => {
    setUpdatingId(product.id);
    try {
      await updateProduct.mutateAsync({ id: product.id, values: { is_active: enabled } });
      toast({
        title: enabled ? "Produit activé" : "Produit désactivé",
        description: `${product.name} est désormais ${enabled ? "disponible" : "masqué"}`,
      });
    } catch (mutationError) {
      const message =
        mutationError instanceof Error ? mutationError.message : "Impossible de mettre à jour le produit";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = (product: ProductCatalogRecord) => {
    setProductToDelete(product);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    try {
      await deleteProduct.mutateAsync(productToDelete.id);
      toast({ title: "Produit supprimé", description: `${productToDelete.name} a été supprimé` });
    } catch (mutationError) {
      const message =
        mutationError instanceof Error ? mutationError.message : "Impossible de supprimer le produit";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setProductToDelete(null);
    }
  };

  const handleEdit = (product: ProductCatalogRecord) => {
    setEditingProduct(product);
  };

  const clearEditing = () => {
    setEditingProduct(null);
  };

  const activeStatusLabel = STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label ?? "Tous";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Produits</h1>
          <p className="text-muted-foreground">
            Gérez le catalogue produits, les catégories et les descriptions enrichies utilisées dans les devis.
          </p>
        </div>
        <ProductFormDialog
          orgId={currentOrgId}
          categories={categories}
          trigger={
            <Button type="button" className="gap-2">
              <Plus className="h-4 w-4" /> Nouveau produit
            </Button>
          }
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-lg font-medium">
            {total} produit{total > 1 ? "s" : ""} — {activeStatusLabel.toLowerCase()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher par nom, code ou catégorie"
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={statusFilter === option.value ? "default" : "outline"}
                onClick={() => setStatusFilter(option.value)}
                className="gap-2"
              >
                {option.label}
                {statusFilter === option.value ? <Badge variant="secondary">{total}</Badge> : null}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <ProductTable
        products={products}
        isLoading={isCatalogLoading}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleActive={(product, enabled) => handleToggleActive(product, enabled)}
        updatingProductId={updatingId}
      />

      <ProductFormDialog
        orgId={currentOrgId}
        categories={categories}
        product={editingProduct}
        open={Boolean(editingProduct)}
        onOpenChange={(next) => {
          if (!next) {
            clearEditing();
          }
        }}
      />

      <AlertDialog open={productToDelete !== null} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le produit ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible et supprimera définitivement le produit du catalogue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteProduct.isPending}>
              {deleteProduct.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
