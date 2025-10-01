import { useCallback, useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Filter,
  Layers,
  Loader2,
  Plus,
  Pencil,
  Settings2,
  Sparkles,
  Trash2,
  Eye,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

const typeLabels = {
  string: "Texte",
  number: "Nombre",
  boolean: "Oui/Non",
  date: "Date",
  select: "Liste",
  multiselect: "Multi-liste",
};

const defaultCategories = [
  "Chauffage",
  "Isolation",
  "Ventilation",
  "Énergie solaire",
  "Menuiserie",
];

type ParamType = keyof typeof typeLabels;

type ProductParamField = {
  key: string;
  label: string;
  type: ParamType;
  unit?: string;
  required: boolean;
  options?: string[];
  default?: string | number | boolean | string[];
  validation?: string;
  order: number;
  helpText?: string;
};

type ProductRow = Tables<"product_catalog">;

type Product = Omit<
  ProductRow,
  "params_schema" | "default_params" | "schema_version" | "description" | "category" | "code"
> & {
  schema_version: number;
  params_schema: {
    fields: ProductParamField[];
  };
  default_params?: Record<string, unknown>;
  description: string;
  category: string;
  code: string;
};

type EditableParamField = {
  key: string;
  label: string;
  type: ParamType;
  unit?: string;
  required: boolean;
  options?: string;
  defaultValue?: string;
  helpText?: string;
};

type StatusFilter = "all" | "active" | "inactive";

type ParamFieldsConfiguratorProps = {
  fields: EditableParamField[];
  onAddField: () => void;
  onRemoveField: (index: number) => void;
  onUpdateField: <K extends keyof EditableParamField>(
    index: number,
    key: K,
    value: EditableParamField[K],
  ) => void;
};

const ParamFieldsConfigurator = ({
  fields,
  onAddField,
  onRemoveField,
  onUpdateField,
}: ParamFieldsConfiguratorProps) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-semibold">Paramètres dynamiques</h3>
        <p className="text-sm text-muted-foreground">
          Ajoutez les champs qui devront être remplis lors de la création d'un lead ou projet.
        </p>
      </div>
      <Button type="button" variant="outline" className="gap-2" onClick={onAddField}>
        <Plus className="h-4 w-4" />
        Ajouter un champ
      </Button>
    </div>

    <div className="space-y-4">
      {fields.map((field, index) => (
        <div key={index} className="rounded-lg border bg-background/40 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Champ #{index + 1}</div>
            {fields.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemoveField(index)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="mt-4 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`param-key-${index}`}>Clé technique</Label>
                <Input
                  id={`param-key-${index}`}
                  value={field.key}
                  onChange={(event) => onUpdateField(index, "key", event.target.value)}
                  placeholder="Ex. surface_m2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`param-label-${index}`}>Label affiché</Label>
                <Input
                  id={`param-label-${index}`}
                  value={field.label}
                  onChange={(event) => onUpdateField(index, "label", event.target.value)}
                  placeholder="Ex. Surface à traiter"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Type de champ</Label>
                <Select
                  value={field.type}
                  onValueChange={(value: ParamType) => onUpdateField(index, "type", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`param-unit-${index}`}>Unité (optionnel)</Label>
                <Input
                  id={`param-unit-${index}`}
                  value={field.unit ?? ""}
                  onChange={(event) => onUpdateField(index, "unit", event.target.value)}
                  placeholder="Ex. m², kW"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`param-default-${index}`}>Valeur par défaut</Label>
                <Input
                  id={`param-default-${index}`}
                  value={field.defaultValue ?? ""}
                  onChange={(event) => onUpdateField(index, "defaultValue", event.target.value)}
                  placeholder="Ex. 12"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-background/40 p-3">
                <div>
                  <Label className="text-sm">Champ obligatoire</Label>
                  <p className="text-xs text-muted-foreground">
                    Le commercial devra renseigner cette information
                  </p>
                </div>
                <Switch
                  checked={field.required}
                  onCheckedChange={(checked) => onUpdateField(index, "required", checked)}
                />
              </div>
            </div>

            {(field.type === "select" || field.type === "multiselect") && (
              <div className="space-y-2">
                <Label htmlFor={`param-options-${index}`}>
                  Options disponibles (séparées par des virgules)
                </Label>
                <Input
                  id={`param-options-${index}`}
                  value={field.options ?? ""}
                  onChange={(event) => onUpdateField(index, "options", event.target.value)}
                  placeholder="Ex. Tuile, Ardoise, Bac acier"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor={`param-help-${index}`}>Texte d'aide</Label>
              <Textarea
                id={`param-help-${index}`}
                value={field.helpText ?? ""}
                onChange={(event) => onUpdateField(index, "helpText", event.target.value)}
                placeholder="Conseils pour guider la saisie de l'utilisateur"
                rows={3}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);


const defaultParamFields: EditableParamField[] = [
  {
    key: "surface_m2",
    label: "Surface à traiter",
    type: "number",
    unit: "m²",
    required: true,
    options: "",
    defaultValue: "100",
    helpText: "Surface totale des travaux.",
  },
];

const Products = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isActive, setIsActive] = useState(true);
  const [category, setCategory] = useState("Chauffage");
  const [schemaVersion, setSchemaVersion] = useState(1);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [paramFields, setParamFields] = useState<EditableParamField[]>(() =>
    defaultParamFields.map((field) => ({ ...field })),
  );
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [isViewProductOpen, setIsViewProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditProductOpen, setIsEditProductOpen] = useState(false);
  const [editCategory, setEditCategory] = useState("Chauffage");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editSchemaVersion, setEditSchemaVersion] = useState(1);
  const [editParamFields, setEditParamFields] = useState<EditableParamField[]>(() =>
    defaultParamFields.map((field) => ({ ...field })),
  );

  const parseParamFields = useCallback((value: unknown): ProductParamField[] => {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item, index) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const field = item as Partial<ProductParamField> & Record<string, unknown>;
        const resolvedType = (field.type ?? "string") as ParamType;
        const options = Array.isArray(field.options)
          ? field.options.filter((option): option is string => typeof option === "string")
          : undefined;

        return {
          key:
            typeof field.key === "string"
              ? field.key
              : `champ_${index + 1}`,
          label:
            typeof field.label === "string"
              ? field.label
              : `Champ ${index + 1}`,
          type: typeLabels[resolvedType] ? resolvedType : "string",
          unit: typeof field.unit === "string" ? field.unit : undefined,
          required: Boolean(field.required),
          options,
          default: field.default,
          validation: typeof field.validation === "string" ? field.validation : undefined,
          order: typeof field.order === "number" ? field.order : index + 1,
          helpText: typeof field.helpText === "string" ? field.helpText : undefined,
        } as ProductParamField;
      })
      .filter((field): field is ProductParamField => field !== null)
      .sort((a, b) => a.order - b.order);
  }, []);

  const normalizeProduct = useCallback(
    (row: ProductRow): Product => {
      const paramsSchema =
        row.params_schema && typeof row.params_schema === "object"
          ? (row.params_schema as { fields?: unknown })
          : null;

      const fields = paramsSchema?.fields ? parseParamFields(paramsSchema.fields) : [];

      return {
        ...row,
        code: row.code ?? "",
        category: row.category ?? "Non classé",
        description: row.description ?? "",
        schema_version: row.schema_version ?? 1,
        params_schema: {
          fields,
        },
        default_params: (row.default_params as Record<string, unknown> | null) ?? undefined,
      };
    },
    [parseParamFields],
  );

  const toEditableFields = useCallback((fields: ProductParamField[]): EditableParamField[] => {
    return fields
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        unit: field.unit,
        required: field.required,
        options: Array.isArray(field.options) ? field.options.join(", ") : "",
        defaultValue:
          typeof field.default === "boolean"
            ? String(field.default)
            : Array.isArray(field.default)
              ? field.default.join(", ")
              : field.default?.toString() ?? "",
        helpText: field.helpText,
      }));
  }, []);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("product_catalog")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const normalized = (data ?? []).map(normalizeProduct);
      setProducts(normalized);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossible de récupérer les produits";
      toast({
        title: "Erreur lors du chargement",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [normalizeProduct, toast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const addParamField = () => {
    setParamFields((prev) => [
      ...prev,
      {
        key: "nouveau_champ",
        label: "Nouveau champ",
        type: "string",
        required: false,
        options: "",
        defaultValue: "",
      },
    ]);
  };

  const removeParamField = (index: number) => {
    setParamFields((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateParamField = <K extends keyof EditableParamField>(
    index: number,
    key: K,
    value: EditableParamField[K],
  ) => {
    setParamFields((prev) =>
      prev.map((field, idx) => (idx === index ? { ...field, [key]: value } : field)),
    );
  };

  const addEditParamField = () => {
    setEditParamFields((prev) => [
      ...prev,
      {
        key: "nouveau_champ",
        label: "Nouveau champ",
        type: "string",
        required: false,
        options: "",
        defaultValue: "",
      },
    ]);
  };

  const removeEditParamField = (index: number) => {
    setEditParamFields((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateEditParamField = <K extends keyof EditableParamField>(
    index: number,
    key: K,
    value: EditableParamField[K],
  ) => {
    setEditParamFields((prev) =>
      prev.map((field, idx) => (idx === index ? { ...field, [key]: value } : field)),
    );
  };

  const handleViewProduct = useCallback((product: Product) => {
    setViewProduct(product);
    setIsViewProductOpen(true);
  }, []);

  const resetEditState = useCallback(() => {
    setEditingProduct(null);
    setEditParamFields(defaultParamFields.map((field) => ({ ...field })));
    setEditCategory("Chauffage");
    setEditIsActive(true);
    setEditSchemaVersion(1);
    setIsUpdating(false);
  }, []);

  const handleEditProduct = useCallback(
    (product: Product) => {
      setEditingProduct(product);
      setEditCategory(product.category);
      setEditIsActive(product.is_active);
      setEditSchemaVersion(product.schema_version);
      setEditParamFields((current) => {
        const fields = product.params_schema.fields.length
          ? toEditableFields(product.params_schema.fields)
          : current;
        return fields.length ? fields : defaultParamFields.map((field) => ({ ...field }));
      });
      setIsEditProductOpen(true);
    },
    [toEditableFields],
  );

  useEffect(() => {
    if (!isEditProductOpen) {
      resetEditState();
    }
  }, [isEditProductOpen, resetEditState]);

  useEffect(() => {
    if (!isViewProductOpen) {
      setViewProduct(null);
    }
  }, [isViewProductOpen]);

  const handleUpdateProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingProduct) {
      return;
    }

    if (!user) {
      toast({
        title: "Authentification requise",
        description: "Vous devez être connecté pour modifier un produit.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData(event.currentTarget);
    const name = (formData.get("edit-name") as string)?.trim();
    const codeValue = (formData.get("edit-code") as string)?.trim();
    const description = (formData.get("edit-description") as string)?.trim() ?? "";

    if (!name || !codeValue) {
      toast({
        title: "Champs obligatoires",
        description: "Le nom et le code produit sont requis.",
        variant: "destructive",
      });
      return;
    }

    const paramsSchemaFields = editParamFields.map((field, index) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      unit: field.unit || undefined,
      required: field.required,
      options: field.options
        ?.split(",")
        .map((option) => option.trim())
        .filter(Boolean),
      default: field.defaultValue,
      order: index + 1,
      helpText: field.helpText,
    }));

    const defaultParams = editParamFields.reduce<Record<string, unknown>>((acc, field) => {
      if (!field.defaultValue) {
        return acc;
      }

      let value: unknown = field.defaultValue;

      if (field.type === "number") {
        const numericValue = Number(field.defaultValue);
        value = Number.isNaN(numericValue) ? field.defaultValue : numericValue;
      } else if (field.type === "boolean") {
        value = field.defaultValue === "true";
      } else if (field.type === "multiselect") {
        value = field.defaultValue
          .split(",")
          .map((option) => option.trim())
          .filter(Boolean);
      }

      return {
        ...acc,
        [field.key]: value,
      };
    }, {});

    setIsUpdating(true);
    try {
      const { data, error } = await supabase
        .from("product_catalog")
        .update({
          name,
          code: codeValue,
          description,
          category: editCategory,
          is_active: editIsActive,
          schema_version: editSchemaVersion,
          params_schema: { fields: paramsSchemaFields } as any,
          default_params: Object.keys(defaultParams).length ? (defaultParams as any) : null,
        })
        .eq("id", editingProduct.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        const normalized = normalizeProduct(data);
        setProducts((previous) =>
          previous.map((product) => (product.id === normalized.id ? normalized : product)),
        );
        setEditingProduct(normalized);
      }

      toast({
        title: "Produit mis à jour",
        description: "Les informations du produit ont été enregistrées.",
      });

      setIsEditProductOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossible de mettre à jour le produit";
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      if (statusFilter === "active" && !product.is_active) {
        return false;
      }

      if (statusFilter === "inactive" && product.is_active) {
        return false;
      }

      if (categoryFilter !== "all" && product.category !== categoryFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        product.name,
        product.code,
        product.category,
        product.description,
        ...product.params_schema.fields.map((field) => field.label),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [products, search, categoryFilter, statusFilter]);

  const resetFilters = useCallback(() => {
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("all");
  }, []);

  const totalActive = useMemo(
    () => products.filter((product) => product.is_active).length,
    [products],
  );

  const totalDynamicFields = useMemo(
    () =>
      products.reduce(
        (acc, product) => acc + product.params_schema.fields.length,
        0,
      ),
    [products],
  );

  const schemaDiversity = useMemo(
    () => new Set(products.map((product) => product.schema_version)).size,
    [products],
  );

  const availableCategories = useMemo(() => {
    const categories = Array.from(new Set(products.map((product) => product.category))).filter(
      (category): category is string => Boolean(category),
    );
    return categories.sort((a, b) => a.localeCompare(b));
  }, [products]);

  const categoryOptions = useMemo(() => {
    const merged = new Set([...defaultCategories, ...availableCategories]);
    return Array.from(merged).sort((a, b) => a.localeCompare(b));
  }, [availableCategories]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      toast({
        title: "Authentification requise",
        description: "Vous devez être connecté pour ajouter un produit.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData(event.currentTarget);
    const categoryValue = (formData.get("category") as string) || category;
    const name = (formData.get("name") as string)?.trim();
    const codeValue = (formData.get("code") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();

    if (!name || !codeValue) {
      toast({
        title: "Champs obligatoires",
        description: "Veuillez renseigner au minimum le nom et le code produit.",
        variant: "destructive",
      });
      return;
    }

    const paramsSchemaFields = paramFields.map((field, index) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      unit: field.unit || undefined,
      required: field.required,
      options: field.options
        ?.split(",")
        .map((option) => option.trim())
        .filter(Boolean),
      default: field.defaultValue,
      order: index + 1,
      helpText: field.helpText,
    }));

    const defaultParams = paramFields.reduce<Record<string, unknown>>(
      (acc, field) => {
        if (!field.defaultValue) {
          return acc;
        }

        let value: unknown = field.defaultValue;

        if (field.type === "number") {
          const numericValue = Number(field.defaultValue);
          value = Number.isNaN(numericValue) ? field.defaultValue : numericValue;
        } else if (field.type === "boolean") {
          value = field.defaultValue === "true";
        } else if (field.type === "multiselect") {
          value = field.defaultValue
            .split(",")
            .map((option) => option.trim())
            .filter(Boolean);
        }

        return {
          ...acc,
          [field.key]: value,
        };
      },
      {},
    );

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("product_catalog")
        .insert({
          name,
          code: codeValue,
          category: categoryValue,
          description: description || "",
          is_active: isActive,
          schema_version: schemaVersion,
          params_schema: { fields: paramsSchemaFields } as any,
          default_params: Object.keys(defaultParams).length ? (defaultParams as any) : null,
          owner_id: user.id,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        const normalized = normalizeProduct(data);
        setProducts((previous) => [normalized, ...previous]);
      }

      toast({
        title: "Produit créé",
        description: "Le produit a été ajouté avec succès au catalogue.",
      });

      setCategory("Chauffage");
      setIsActive(true);
      setSchemaVersion(1);
      setParamFields(defaultParamFields.map((field) => ({ ...field })));
      setIsAddProductOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossible d'enregistrer le produit";
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary/70">
              Catalogue
            </p>
            <h1 className="bg-gradient-to-r from-primary to-accent bg-clip-text text-3xl font-bold text-transparent">
              Produits & Solutions
            </h1>
            <p className="mt-1 text-muted-foreground">
              Centralisez vos solutions pour les rendre sélectionnables dans les leads et projets.
            </p>
          </div>
          <Dialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="shadow-lg shadow-primary/20">
                <Plus className="mr-2 h-4 w-4" />
                Ajouter un produit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Ajouter un produit</DialogTitle>
                <DialogDescription>
                  Définissez les champs dynamiques qui seront proposés lors de la création d'un lead ou d'un projet.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nom du produit</Label>
                    <Input id="name" name="name" placeholder="Ex. Pompe à chaleur Atlantic" required />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="code">Code unique</Label>
                      <Input id="code" name="code" placeholder="Ex. PAC-ATL-12" required />
                    </div>
                    <div className="space-y-2">
                      <Label>Catégorie</Label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir" />
                        </SelectTrigger>
                        <SelectContent>
                          {categoryOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <input type="hidden" name="category" value={category} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      rows={4}
                      placeholder="Décrivez brièvement la solution, son périmètre et les bénéfices pour le client."
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="schemaVersion">Version de schéma</Label>
                      <Input
                        id="schemaVersion"
                        type="number"
                        min={1}
                        value={schemaVersion}
                        onChange={(event) => setSchemaVersion(Number(event.target.value))}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border bg-background/40 p-3">
                      <div>
                        <Label className="text-sm">Produit actif</Label>
                        <p className="text-xs text-muted-foreground">
                          Contrôle la disponibilité dans les formulaires
                        </p>
                      </div>
                      <Switch checked={isActive} onCheckedChange={setIsActive} />
                    </div>
                  </div>
                </div>

                <Separator />

                <ParamFieldsConfigurator
                  fields={paramFields}
                  onAddField={addParamField}
                  onRemoveField={removeParamField}
                  onUpdateField={updateParamField}
                />
                <div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setIsAddProductOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" className="gap-2" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {isSubmitting ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-0 bg-gradient-card shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Produits actifs</CardTitle>
              <CardDescription>Produits disponibles pour les équipes</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-semibold text-primary">{totalActive}</div>
            </CardContent>
          </Card>
          <Card className="border-0 bg-gradient-card shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Champs dynamiques</CardTitle>
              <CardDescription>Total de champs configurés</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-semibold text-primary">{totalDynamicFields}</div>
            </CardContent>
          </Card>
          <Card className="border-0 bg-gradient-card shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Versions de schéma</CardTitle>
              <CardDescription>Historique des évolutions</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-semibold text-primary">{schemaDiversity}</div>
            </CardContent>
          </Card>
          <Card className="border-0 bg-gradient-card shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Paramètres populaires</CardTitle>
              <CardDescription>Champs récurrents dans vos produits</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 pt-0">
              {Array.from(
                new Set(
                  products.flatMap((product) =>
                    product.params_schema.fields
                      .filter((field) => field.required)
                      .map((field) => field.label),
                  ),
                ),
              )
                .slice(0, 4)
                .map((label) => (
                  <Badge key={label} variant="outline" className="border-dashed">
                    {label}
                  </Badge>
                ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-0 bg-gradient-card shadow-card">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative flex-1">
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Rechercher par nom, code, paramètre..."
                    className="pl-10"
                  />
                  <Sparkles className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="min-w-[180px]">
                      <SelectValue placeholder="Catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les catégories</SelectItem>
                      {availableCategories.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                  >
                    <SelectTrigger className="min-w-[150px]">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="active">Actifs uniquement</SelectItem>
                      <SelectItem value="inactive">Désactivés</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    className="gap-2"
                    onClick={resetFilters}
                    disabled={
                      search.length === 0 && categoryFilter === "all" && statusFilter === "all"
                    }
                  >
                    Réinitialiser
                  </Button>
                  <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Filtres avancés
                  </Button>
                  <Button variant="outline" className="gap-2">
                    <Settings2 className="h-4 w-4" />
                    Gérer les catégories
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-card shadow-card">
            <CardHeader className="pb-0">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-xl">Produits ({filteredProducts.length})</CardTitle>
                  <CardDescription>
                    Liste des solutions disponibles avec leurs paramètres dynamiques
                  </CardDescription>
                </div>
                <Button variant="outline" className="gap-2">
                  <Layers className="h-4 w-4" />
                  Historique des versions
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Produit</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Paramètres</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Chargement des produits...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Aucun produit ne correspond aux filtres sélectionnés.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((product) => {
                      const extraFields =
                        product.params_schema.fields.length > 3
                          ? product.params_schema.fields.length - 3
                          : 0;

                      return (
                        <TableRow key={product.id}>
                          <TableCell className="align-top">
                            <div className="font-medium text-foreground">{product.name}</div>
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">
                              {product.category}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <Badge variant="outline" className="border-dashed">
                              {product.code}
                            </Badge>
                            <div className="text-xs text-muted-foreground">
                              v{product.schema_version.toString().padStart(2, "0")}
                            </div>
                          </TableCell>
                          <TableCell className="align-top text-sm text-muted-foreground">
                            {product.description || "—"}
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex flex-wrap gap-2">
                              {product.params_schema.fields.slice(0, 3).map((field) => (
                                <Badge key={field.key} variant="secondary" className="gap-1">
                                  {field.label}
                                  <span className="text-[10px] uppercase text-muted-foreground">
                                    {typeLabels[field.type]}
                                  </span>
                                </Badge>
                              ))}
                              {extraFields > 0 && (
                                <Badge variant="outline" className="border-dashed text-muted-foreground">
                                  +{extraFields} autres
                                </Badge>
                              )}
                              {product.params_schema.fields.length === 0 && (
                                <span className="text-xs text-muted-foreground">Aucun paramètre configuré</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <Badge
                              className={
                                product.is_active
                                  ? "border-none bg-emerald-500/10 text-emerald-600"
                                  : "border-none bg-slate-500/10 text-slate-600"
                              }
                            >
                              {product.is_active ? "Actif" : "Désactivé"}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1"
                                onClick={() => handleViewProduct(product)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Voir
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1"
                                onClick={() => handleEditProduct(product)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Modifier
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
      <Dialog open={isViewProductOpen} onOpenChange={setIsViewProductOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewProduct?.name ?? "Produit"}</DialogTitle>
            <DialogDescription>
              Visualisez les informations du produit sélectionné.
            </DialogDescription>
          </DialogHeader>
          {viewProduct ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Code produit</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-dashed">
                      {viewProduct.code}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      v{viewProduct.schema_version.toString().padStart(2, "0")}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Catégorie</Label>
                  <div className="font-medium">{viewProduct.category}</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Statut</Label>
                  <Badge
                    className={
                      viewProduct.is_active
                        ? "border-none bg-emerald-500/10 text-emerald-600"
                        : "border-none bg-slate-500/10 text-slate-600"
                    }
                  >
                    {viewProduct.is_active ? "Actif" : "Désactivé"}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Dernière mise à jour</Label>
                  <div className="text-sm text-muted-foreground">
                    {new Date(viewProduct.updated_at).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Description</Label>
                <p className="text-sm text-muted-foreground">
                  {viewProduct.description || "Aucune description fournie."}
                </p>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Paramètres dynamiques</h4>
                  <Badge variant="outline" className="border-dashed">
                    {viewProduct.params_schema.fields.length} champs
                  </Badge>
                </div>
                {viewProduct.params_schema.fields.length > 0 ? (
                  <div className="space-y-3">
                    {viewProduct.params_schema.fields.map((field) => (
                      <div
                        key={field.key}
                        className="rounded-lg border bg-muted/30 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-medium">{field.label}</div>
                            <div className="text-xs text-muted-foreground">{field.key}</div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="secondary" className="border-none">
                              {typeLabels[field.type]}
                            </Badge>
                            {field.required && (
                              <Badge variant="outline" className="border-dashed text-amber-600">
                                Obligatoire
                              </Badge>
                            )}
                          </div>
                        </div>
                        {field.helpText && (
                          <p className="mt-2 text-xs text-muted-foreground">{field.helpText}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Aucun paramètre dynamique n'est configuré pour ce produit.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Chargement...
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditProductOpen} onOpenChange={setIsEditProductOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le produit</DialogTitle>
            <DialogDescription>
              Actualisez les informations et le schéma dynamique du produit.
            </DialogDescription>
          </DialogHeader>
          {editingProduct ? (
            <form
              key={editingProduct.id}
              className="space-y-6"
              onSubmit={handleUpdateProduct}
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nom du produit</Label>
                  <Input
                    id="edit-name"
                    name="edit-name"
                    defaultValue={editingProduct.name}
                    required
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-code">Code unique</Label>
                    <Input
                      id="edit-code"
                      name="edit-code"
                      defaultValue={editingProduct.code}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Catégorie</Label>
                    <Select value={editCategory} onValueChange={setEditCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    name="edit-description"
                    rows={4}
                    defaultValue={editingProduct.description}
                    placeholder="Décrivez brièvement la solution."
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-schema-version">Version de schéma</Label>
                    <Input
                      id="edit-schema-version"
                      type="number"
                      min={1}
                      value={editSchemaVersion}
                      onChange={(event) => setEditSchemaVersion(Number(event.target.value))}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border bg-background/40 p-3">
                    <div>
                      <Label className="text-sm">Produit actif</Label>
                      <p className="text-xs text-muted-foreground">
                        Contrôle la disponibilité dans les formulaires
                      </p>
                    </div>
                    <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
                  </div>
                </div>
              </div>

              <Separator />

              <ParamFieldsConfigurator
                fields={editParamFields}
                onAddField={addEditParamField}
                onRemoveField={removeEditParamField}
                onUpdateField={updateEditParamField}
              />

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsEditProductOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" className="gap-2" disabled={isUpdating}>
                  {isUpdating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Pencil className="h-4 w-4" />
                  )}
                  {isUpdating ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Chargement...
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Products;
