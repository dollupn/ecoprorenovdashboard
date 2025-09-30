import { useMemo, useState } from "react";
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
  Plus,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";

const typeLabels = {
  string: "Texte",
  number: "Nombre",
  boolean: "Oui/Non",
  date: "Date",
  select: "Liste",
  multiselect: "Multi-liste",
};

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

type Product = {
  id: string;
  name: string;
  code: string;
  category: string;
  description: string;
  is_active: boolean;
  schema_version: number;
  default_params?: Record<string, unknown>;
  params_schema: {
    fields: ProductParamField[];
  };
};

const mockProducts: Product[] = [
  {
    id: "prod-1",
    name: "Pompe à chaleur air/eau haute performance",
    code: "PAC-HP-12",
    category: "Chauffage",
    description:
      "Système de pompe à chaleur air/eau pour maisons individuelles, compatible avec les aides MaPrimeRénov'.",
    is_active: true,
    schema_version: 3,
    default_params: {
      puissance_kw: 12,
      fluide_frigo: "R32",
      pilotable: true,
    },
    params_schema: {
      fields: [
        {
          key: "puissance_kw",
          label: "Puissance calorifique",
          type: "number",
          unit: "kW",
          required: true,
          order: 1,
          helpText: "Valeur de 6 à 18 kW selon les modèles.",
        },
        {
          key: "type_unite_interieure",
          label: "Type d'unité intérieure",
          type: "select",
          required: true,
          options: ["Murale", "Gainable", "Plafonnier"],
          order: 2,
        },
        {
          key: "fluide_frigo",
          label: "Fluide frigorigène",
          type: "string",
          required: true,
          order: 3,
        },
        {
          key: "pilotable",
          label: "Pilotage à distance",
          type: "boolean",
          required: false,
          order: 4,
        },
        {
          key: "garantie",
          label: "Durée de garantie",
          type: "number",
          unit: "ans",
          required: false,
          order: 5,
          default: 5,
        },
      ],
    },
  },
  {
    id: "prod-2",
    name: "Isolation thermique des combles perdus",
    code: "ITC-OUATE-32",
    category: "Isolation",
    description:
      "Solution d'isolation par soufflage de ouate de cellulose avec résistance thermique certifiée.",
    is_active: true,
    schema_version: 2,
    default_params: {
      epaisseur_cm: 32,
      resistance_thermique: 7.5,
    },
    params_schema: {
      fields: [
        {
          key: "surface_m2",
          label: "Surface à traiter",
          type: "number",
          unit: "m²",
          required: true,
          order: 1,
          helpText: "Surface totale des combles perdus.",
        },
        {
          key: "epaisseur_cm",
          label: "Épaisseur projetée",
          type: "number",
          unit: "cm",
          required: true,
          order: 2,
        },
        {
          key: "resistance_thermique",
          label: "Résistance thermique visée",
          type: "number",
          unit: "R",
          required: true,
          order: 3,
        },
        {
          key: "type_acces",
          label: "Accès aux combles",
          type: "select",
          required: true,
          options: ["Trappe standard", "Échelle", "Difficile"],
          order: 4,
        },
      ],
    },
  },
  {
    id: "prod-3",
    name: "Système de panneaux solaires photovoltaïques",
    code: "PV-375M",
    category: "Énergie solaire",
    description:
      "Installation photovoltaïque résidentielle avec micro-onduleurs et monitoring en ligne.",
    is_active: false,
    schema_version: 1,
    default_params: {
      puissance_totale_kwc: 3.75,
      orientation: "Sud",
    },
    params_schema: {
      fields: [
        {
          key: "type_toiture",
          label: "Type de toiture",
          type: "select",
          required: true,
          options: ["Tuile", "Ardoise", "Bac acier", "Terrasse"],
          order: 1,
        },
        {
          key: "inclinaison",
          label: "Inclinaison",
          type: "number",
          unit: "°",
          required: true,
          order: 2,
        },
        {
          key: "orientation",
          label: "Orientation",
          type: "select",
          required: true,
          options: ["Nord", "Est", "Sud", "Ouest"],
          order: 3,
        },
        {
          key: "monitoring",
          label: "Surveillance connectée",
          type: "boolean",
          required: false,
          order: 4,
        },
        {
          key: "puissance_totale_kwc",
          label: "Puissance totale",
          type: "number",
          unit: "kWc",
          required: true,
          order: 5,
        },
      ],
    },
  },
];

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
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [search, setSearch] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [category, setCategory] = useState("Chauffage");
  const [schemaVersion, setSchemaVersion] = useState(1);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [paramFields, setParamFields] = useState<EditableParamField[]>(() =>
    defaultParamFields.map((field) => ({ ...field })),
  );

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

  const filteredProducts = useMemo(() => {
    if (!search) return products;

    return products.filter((product) => {
      const haystack = [
        product.name,
        product.code,
        product.category,
        product.description,
        ...product.params_schema.fields.map((field) => field.label),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  }, [products, search]);

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

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const categoryValue = (formData.get("category") as string) || category;
    const name = (formData.get("name") as string)?.trim();
    const code = (formData.get("code") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();

    if (!name || !code) {
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

    const payload: Product = {
      id: `prod-${Date.now()}`,
      name,
      code,
      description: description || "",
      category: categoryValue,
      is_active: isActive,
      schema_version: schemaVersion,
      params_schema: {
        fields: paramsSchemaFields,
      },
      default_params: Object.keys(defaultParams).length ? defaultParams : undefined,
    };

    setProducts((previous) => [payload, ...previous]);
    event.currentTarget.reset();
    setCategory("Chauffage");
    setIsActive(true);
    setSchemaVersion(1);
    setParamFields(defaultParamFields.map((field) => ({ ...field })));
    setIsAddProductOpen(false);
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
                          <SelectItem value="Chauffage">Chauffage</SelectItem>
                          <SelectItem value="Isolation">Isolation</SelectItem>
                          <SelectItem value="Ventilation">Ventilation</SelectItem>
                          <SelectItem value="Énergie solaire">Énergie solaire</SelectItem>
                          <SelectItem value="Menuiserie">Menuiserie</SelectItem>
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

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Paramètres dynamiques</h3>
                      <p className="text-sm text-muted-foreground">
                        Ajoutez les champs qui devront être remplis lors de la création d'un lead ou projet.
                      </p>
                    </div>
                    <Button type="button" variant="outline" className="gap-2" onClick={addParamField}>
                      <Plus className="h-4 w-4" />
                      Ajouter un champ
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {paramFields.map((field, index) => (
                      <div key={`${field.key}-${index}`} className="rounded-lg border bg-background/40 p-4">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">Champ #{index + 1}</div>
                          {paramFields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeParamField(index)}
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
                                onChange={(event) => updateParamField(index, "key", event.target.value)}
                                placeholder="Ex. surface_m2"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`param-label-${index}`}>Label affiché</Label>
                              <Input
                                id={`param-label-${index}`}
                                value={field.label}
                                onChange={(event) => updateParamField(index, "label", event.target.value)}
                                placeholder="Ex. Surface à traiter"
                              />
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Type de champ</Label>
                              <Select
                                value={field.type}
                                onValueChange={(value: ParamType) => updateParamField(index, "type", value)}
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
                                onChange={(event) => updateParamField(index, "unit", event.target.value)}
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
                                onChange={(event) => updateParamField(index, "defaultValue", event.target.value)}
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
                                onCheckedChange={(checked) => updateParamField(index, "required", checked)}
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
                                onChange={(event) => updateParamField(index, "options", event.target.value)}
                                placeholder="Ex. Tuile, Ardoise, Bac acier"
                              />
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label htmlFor={`param-help-${index}`}>Texte d'aide</Label>
                            <Textarea
                              id={`param-help-${index}`}
                              value={field.helpText ?? ""}
                              onChange={(event) => updateParamField(index, "helpText", event.target.value)}
                              placeholder="Conseils pour guider la saisie de l'utilisateur"
                              rows={3}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Card className="border border-dashed bg-background/60">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Aperçu JSON du schéma</CardTitle>
                      <CardDescription>Structure générée pour l'API</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <pre className="max-h-60 overflow-auto rounded-md bg-muted/60 p-3 text-xs">
                        {JSON.stringify(
                          {
                            schema_version: schemaVersion,
                            params_schema: {
                              fields: paramFields.map((field, index) => ({
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
                              })),
                            },
                          },
                          null,
                          2,
                        )}
                      </pre>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setIsAddProductOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Enregistrer
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
                  mockProducts.flatMap((product) =>
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
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Rechercher par nom, code, paramètre..."
                    className="pl-10"
                  />
                  <Sparkles className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
                <div className="flex flex-wrap gap-2">
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
                  {filteredProducts.map((product) => {
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
                          {product.description}
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
                          <Button variant="ghost" size="sm">
                            Modifier
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Products;
