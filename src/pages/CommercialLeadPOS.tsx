import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AddressAutocomplete } from "@/components/address/AddressAutocomplete";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Building2,
  Camera,
  Check,
  ClipboardPlus,
  Phone,
  Upload,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useOrg } from "@/features/organizations/OrgContext";
import { useLeadProductTypes } from "@/features/leads/api";
import { useProjectBuildingTypes } from "@/hooks/useProjectBuildingTypes";
import { useProjectUsages } from "@/hooks/useProjectUsages";

type BuildingMeasurement = {
  length: string;
  width: string;
  height: string;
};

const EMPTY_BUILDING: BuildingMeasurement = {
  length: "",
  width: "",
  height: "",
};

const MAX_BUILDINGS = 3;

const initialFormState = {
  creationDate: new Date().toISOString().split('T')[0],
  visitDate: "",
  contactRole: "",
  firstName: "",
  lastName: "",
  company: "",
  siren: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  postalCode: "",
  buildingArea: "",
  insultationArea: "",
  buildingType: "",
  buildingUsage: "",
  subsidyReceived: "no",
  subsidyDetails: "",
  selectedProducts: [] as string[],
  buildings: [{ ...EMPTY_BUILDING }],
  luminaireCount: "",
  notes: "",
};

type FormState = typeof initialFormState;

type PhotoStep = {
  id: number;
  title: string;
  description: string;
  maxPhotos: number;
  photos: File[];
};

const formatFileSize = (sizeInBytes: number) => {
  if (sizeInBytes === 0) return "0 Ko";
  const sizeInKb = sizeInBytes / 1024;
  if (sizeInKb < 1024) {
    return `${sizeInKb.toFixed(1)} Ko`;
  }
  return `${(sizeInKb / 1024).toFixed(1)} Mo`;
};

const CommercialLeadPOS = () => {
  const { currentOrgId } = useOrg();
  const orgId = currentOrgId;
  const { data: productTypes = [] } = useLeadProductTypes(orgId);
  const buildingTypes = useProjectBuildingTypes();
  const buildingUsages = useProjectUsages();
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPhotoStep, setCurrentPhotoStep] = useState(0);
  const [photoSteps, setPhotoSteps] = useState<PhotoStep[]>([
    { id: 1, title: "Intérieur", description: "Photos de l'intérieur du bâtiment", maxPhotos: 3, photos: [] },
    { id: 2, title: "Plafond", description: "Photos du plafond", maxPhotos: 3, photos: [] },
    { id: 3, title: "Luminaires LED", description: "Photos des luminaires si LED", maxPhotos: 6, photos: [] },
  ]);
  const [sectionsOpen, setSectionsOpen] = useState({
    general: true,
    technical: false,
    photos: false,
  });
  const photoInputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null]);
  const { toast } = useToast();
  const [isManualAddress, setIsManualAddress] = useState(false);

  const availableProducts = useMemo(
    () =>
      productTypes
        .map((product) => product.name?.trim() ?? "")
        .filter((name): name is string => Boolean(name)),
    [productTypes],
  );

  useEffect(() => {
    setFormState((prev) => {
      const filteredProducts = prev.selectedProducts.filter((product) => availableProducts.includes(product));
      if (filteredProducts.length === prev.selectedProducts.length) {
        return prev;
      }

      return {
        ...prev,
        selectedProducts: filteredProducts,
      };
    });
  }, [availableProducts]);

  const isLedSelected = useMemo(
    () => formState.selectedProducts.some((product) => product.toLowerCase().includes("led")),
    [formState.selectedProducts],
  );

  useEffect(() => {
    if (!isLedSelected && formState.luminaireCount) {
      setFormState((prev) => ({
        ...prev,
        luminaireCount: "",
      }));
    }
  }, [isLedSelected, formState.luminaireCount]);

  useEffect(() => {
    if (isLedSelected && formState.insultationArea) {
      setFormState((prev) => ({
        ...prev,
        insultationArea: "",
      }));
    }
  }, [isLedSelected, formState.insultationArea]);

  useEffect(() => {
    if (!formState.address) {
      setIsManualAddress(false);
      return;
    }

    if (!formState.city || !formState.postalCode) {
      setIsManualAddress(true);
    }
  }, [formState.address, formState.city, formState.postalCode]);

  const handleInputChange = (field: keyof FormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormState((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleBuildingChange = (index: number, field: keyof BuildingMeasurement) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setFormState((prev) => ({
        ...prev,
        buildings: prev.buildings.map((building, idx) =>
          idx === index ? { ...building, [field]: value } : building
        ),
      }));
    };

  const handleAddBuilding = () => {
    setFormState((prev) => {
      if (prev.buildings.length >= MAX_BUILDINGS) {
        return prev;
      }

      return {
        ...prev,
        buildings: [...prev.buildings, { ...EMPTY_BUILDING }],
      };
    });
  };

  const handleRemoveBuilding = (index: number) => {
    setFormState((prev) => {
      if (prev.buildings.length <= 1) {
        return prev;
      }

      const buildings = prev.buildings.filter((_, idx) => idx !== index);

      return {
        ...prev,
        buildings: buildings.length > 0 ? buildings : [{ ...EMPTY_BUILDING }],
      };
    });
  };

  const handleSelectChange = (field: keyof FormState) => (value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleProductToggle = (product: string) => {
    if (!product) return;

    setFormState((prev) => ({
      ...prev,
      selectedProducts: prev.selectedProducts.includes(product)
        ? prev.selectedProducts.filter((p) => p !== product)
        : [...prev.selectedProducts, product],
    }));
  };

  const toggleSection = (section: keyof typeof sectionsOpen) => {
    setSectionsOpen((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleStepPhotoChange = (stepIndex: number, event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length === 0) return;

    const step = photoSteps[stepIndex];
    const imageFiles = selectedFiles.filter((file) => file.type.startsWith("image/"));
    
    if (imageFiles.length === 0) {
      toast({
        title: "Format invalide",
        description: "Seuls les fichiers image sont acceptés",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    const availableSlots = step.maxPhotos - step.photos.length;
    const filesToAdd = imageFiles.slice(0, availableSlots);

    if (filesToAdd.length < imageFiles.length) {
      toast({
        title: "Limite atteinte",
        description: `Maximum ${step.maxPhotos} photos pour cette étape`,
      });
    }

    setPhotoSteps((prev) =>
      prev.map((s, i) =>
        i === stepIndex ? { ...s, photos: [...s.photos, ...filesToAdd] } : s
      )
    );
  };

  const removeStepPhoto = (stepIndex: number, photoIndex: number) => {
    setPhotoSteps((prev) =>
      prev.map((s, i) =>
        i === stepIndex
          ? { ...s, photos: s.photos.filter((_, idx) => idx !== photoIndex) }
          : s
      )
    );
  };

  const getTotalPhotos = () => photoSteps.reduce((sum, step) => sum + step.photos.length, 0);
  const getMaxPhotos = () => photoSteps.reduce((sum, step) => sum + step.maxPhotos, 0);
  const getPhotoProgress = () => (getTotalPhotos() / getMaxPhotos()) * 100;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      setFormState(initialFormState);
      setIsManualAddress(false);
      setPhotoSteps([
        { id: 1, title: "Intérieur", description: "Photos de l'intérieur du bâtiment", maxPhotos: 3, photos: [] },
        { id: 2, title: "Plafond", description: "Photos du plafond", maxPhotos: 3, photos: [] },
        { id: 3, title: "Luminaires LED", description: "Photos des luminaires si LED", maxPhotos: 6, photos: [] },
      ]);
      setCurrentPhotoStep(0);
      toast({
        title: "Lead enregistré",
        description:
          "Le lead terrain a été ajouté avec succès. Vous pouvez retrouver la fiche dans le CRM.",
        action: (
          <div className="flex items-center text-primary">
            <Check className="mr-2 h-4 w-4" />
            <span>Enregistré</span>
          </div>
        ),
      });
    }, 800);
  };

  return (
    <Layout>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-2 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ClipboardPlus className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-primary">Nouveau lead terrain</h1>
              <p className="text-sm text-muted-foreground">
                Renseignez les informations collectées sur site pour accélérer la prise en charge.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6" autoComplete="off">
          {/* General Information Section */}
          <Collapsible open={sectionsOpen.general} onOpenChange={() => toggleSection("general")}>
            <Card className="border-2 border-muted shadow-lg">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer border-b bg-muted/40 transition-colors hover:bg-muted/60">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold">Informations générales</CardTitle>
                    {sectionsOpen.general ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="grid gap-6 p-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="creationDate">Date de création lead</Label>
                      <Input
                        id="creationDate"
                        type="date"
                        value={formState.creationDate}
                        onChange={handleInputChange("creationDate")}
                        className="h-12"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="visitDate">Date de visite</Label>
                      <Input
                        id="visitDate"
                        type="date"
                        value={formState.visitDate}
                        onChange={handleInputChange("visitDate")}
                        className="h-12"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="contactRole">Fonction interlocuteur</Label>
                    <Input
                      id="contactRole"
                      value={formState.contactRole}
                      onChange={handleInputChange("contactRole")}
                      placeholder="Ex: Directeur, Gérant, Responsable..."
                      className="h-12"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="firstName">Prénom</Label>
                      <Input
                        id="firstName"
                        value={formState.firstName}
                        onChange={handleInputChange("firstName")}
                        placeholder="Prénom du contact"
                        className="h-12"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="lastName">Nom</Label>
                      <Input
                        id="lastName"
                        value={formState.lastName}
                        onChange={handleInputChange("lastName")}
                        placeholder="Nom du contact"
                        className="h-12"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="company">Nom de la société</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="company"
                          value={formState.company}
                          onChange={handleInputChange("company")}
                          placeholder="Entreprise visitée"
                          className="h-12 pl-10"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="siren">SIREN (optionnel)</Label>
                      <Input
                        id="siren"
                        value={formState.siren}
                        onChange={handleInputChange("siren")}
                        placeholder="000000000"
                        maxLength={11}
                        className="h-12"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formState.email}
                        onChange={handleInputChange("email")}
                        placeholder="contact@entreprise.fr"
                        className="h-12"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Téléphone</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="phone"
                          type="tel"
                          value={formState.phone}
                          onChange={handleInputChange("phone")}
                          placeholder="Numéro de téléphone"
                          className="h-12 pl-10"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2">
                <Label htmlFor="address">Adresse</Label>
                <AddressAutocomplete
                  value={formState.address}
                  onChange={(address, city, postalCode, options) => {
                    const isManual = options?.manual ?? false;
                    setIsManualAddress(isManual);
                    setFormState((prev) => ({
                      ...prev,
                      address,
                      city,
                      postalCode,
                    }));
                  }}
                  disabled={isSubmitting}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="city">Ville</Label>
                  <Input
                    id="city"
                    value={formState.city}
                    readOnly={!isManualAddress}
                    onChange={handleInputChange("city")}
                    placeholder="Sélectionnez une adresse"
                    className="h-12"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="postalCode">Code postal</Label>
                  <Input
                    id="postalCode"
                    value={formState.postalCode}
                    readOnly={!isManualAddress}
                    onChange={handleInputChange("postalCode")}
                    placeholder="Sélectionnez une adresse"
                    className="h-12"
                  />
                </div>
              </div>

                  <div className="grid gap-3">
                    <Label className="text-base font-semibold">Produits intéressés</Label>
                    {availableProducts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Configurez vos produits dans les paramètres lead pour les proposer ici.
                      </p>
                    ) : (
                      <div className="grid gap-2">
                        {productTypes.map((product) => {
                          const rawName = product.name ?? "";
                          const trimmedName = rawName.trim();

                          if (!trimmedName) {
                            return null;
                          }

                          return (
                            <div key={product.id} className="flex items-center gap-2">
                              <Checkbox
                                id={`product-${product.id}`}
                                checked={formState.selectedProducts.includes(trimmedName)}
                                onCheckedChange={() => handleProductToggle(trimmedName)}
                              />
                              <label
                                htmlFor={`product-${product.id}`}
                                className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {trimmedName}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Technical Details Section */}
          <Collapsible open={sectionsOpen.technical} onOpenChange={() => toggleSection("technical")}>
            <Card className="border-2 border-muted shadow-lg">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer border-b bg-muted/40 transition-colors hover:bg-muted/60">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold">Détails techniques</CardTitle>
                    {sectionsOpen.technical ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="grid gap-6 p-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="buildingArea">Surface bâtiment (m²)</Label>
                      <Input
                        id="buildingArea"
                        type="number"
                        min="0"
                        value={formState.buildingArea}
                        onChange={handleInputChange("buildingArea")}
                        placeholder="Surface totale"
                        className="h-12"
                      />
                    </div>
                    {!isLedSelected && (
                      <div className="grid gap-2">
                        <Label htmlFor="insultationArea">Surface à isoler (m²)</Label>
                        <Input
                          id="insultationArea"
                          type="number"
                          min="0"
                          value={formState.insultationArea}
                          onChange={handleInputChange("insultationArea")}
                          placeholder="Surface à traiter"
                          className="h-12"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="buildingType">Type bâtiment</Label>
                      <Select value={formState.buildingType} onValueChange={handleSelectChange("buildingType")}>
                        <SelectTrigger id="buildingType" className="h-12">
                          <SelectValue placeholder="Sélectionner le type" />
                        </SelectTrigger>
                        <SelectContent>
                          {buildingTypes.length === 0 ? (
                            <SelectItem value="" disabled>
                              Aucun type disponible
                            </SelectItem>
                          ) : (
                            buildingTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="buildingUsage">Usage bâtiment</Label>
                      <Select value={formState.buildingUsage} onValueChange={handleSelectChange("buildingUsage")}>
                        <SelectTrigger id="buildingUsage" className="h-12">
                          <SelectValue placeholder="Sélectionner l'usage" />
                        </SelectTrigger>
                        <SelectContent>
                          {buildingUsages.length === 0 ? (
                            <SelectItem value="" disabled>
                              Aucun usage disponible
                            </SelectItem>
                          ) : (
                            buildingUsages.map((usage) => (
                              <SelectItem key={usage} value={usage}>
                                {usage}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>Subvention déjà reçue ?</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="subsidyReceived"
                          value="no"
                          checked={formState.subsidyReceived === "no"}
                          onChange={(e) => setFormState((prev) => ({ ...prev, subsidyReceived: e.target.value, subsidyDetails: "" }))}
                          className="h-4 w-4"
                        />
                        Non
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="subsidyReceived"
                          value="yes"
                          checked={formState.subsidyReceived === "yes"}
                          onChange={(e) => setFormState((prev) => ({ ...prev, subsidyReceived: e.target.value }))}
                          className="h-4 w-4"
                        />
                        Oui
                      </label>
                    </div>
                  </div>

                  {formState.subsidyReceived === "yes" && (
                    <div className="grid gap-2">
                      <Label htmlFor="subsidyDetails">Détails de la subvention</Label>
                      <Textarea
                        id="subsidyDetails"
                        value={formState.subsidyDetails}
                        onChange={handleInputChange("subsidyDetails")}
                        placeholder="Précisez le type et le montant de la subvention reçue"
                        className="min-h-[80px]"
                      />
                    </div>
                  )}

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Mesures des bâtiments</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddBuilding}
                        disabled={formState.buildings.length >= MAX_BUILDINGS || isSubmitting}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Ajouter un bâtiment
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Vous pouvez ajouter jusqu'à {MAX_BUILDINGS} bâtiments.
                    </p>
                    <div className="space-y-4">
                      {formState.buildings.map((building, index) => (
                        <div key={index} className="space-y-4 rounded-lg border p-4">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Bâtiment {index + 1}</span>
                            {formState.buildings.length > 1 ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleRemoveBuilding(index)}
                                disabled={isSubmitting}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Supprimer
                              </Button>
                            ) : null}
                          </div>
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="grid gap-2">
                              <Label htmlFor={`building-length-${index}`}>Longueur (m)</Label>
                              <Input
                                id={`building-length-${index}`}
                                type="number"
                                min="0"
                                step="0.1"
                                value={building.length}
                                onChange={handleBuildingChange(index, "length")}
                                placeholder="Longueur totale"
                                className="h-12"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor={`building-width-${index}`}>Largeur (m)</Label>
                              <Input
                                id={`building-width-${index}`}
                                type="number"
                                min="0"
                                step="0.1"
                                value={building.width}
                                onChange={handleBuildingChange(index, "width")}
                                placeholder="Largeur totale"
                                className="h-12"
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor={`building-height-${index}`}>Hauteur (m)</Label>
                              <Input
                                id={`building-height-${index}`}
                                type="number"
                                min="0"
                                step="0.1"
                                value={building.height}
                                onChange={handleBuildingChange(index, "height")}
                                placeholder="Hauteur totale"
                                className="h-12"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {isLedSelected && (
                    <div className="grid gap-2">
                      <Label htmlFor="luminaireCount">Nombre de luminaires</Label>
                      <Input
                        id="luminaireCount"
                        type="number"
                        min="0"
                        value={formState.luminaireCount}
                        onChange={handleInputChange("luminaireCount")}
                        placeholder="Indiquez le nombre de luminaires"
                        className="h-12"
                      />
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="notes">Notes complémentaires</Label>
                    <Textarea
                      id="notes"
                      value={formState.notes}
                      onChange={handleInputChange("notes")}
                      placeholder="Ajoutez des détails sur le besoin, la décision ou les contraintes rencontrées"
                      className="min-h-[100px]"
                    />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Photo Upload Section with Steps */}
          <Collapsible open={sectionsOpen.photos} onOpenChange={() => toggleSection("photos")}>
            <Card className="border-2 border-muted shadow-lg">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer border-b bg-muted/40 transition-colors hover:bg-muted/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-semibold">Photos de la visite</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {getTotalPhotos()} / {getMaxPhotos()} photos ajoutées
                      </p>
                    </div>
                    {sectionsOpen.photos ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="grid gap-6 p-6">
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Progression</span>
                      <span className="text-muted-foreground">{Math.round(getPhotoProgress())}%</span>
                    </div>
                    <Progress value={getPhotoProgress()} className="h-2" />
                  </div>

                  {/* Photo Steps */}
                  <div className="grid gap-4">
                    {photoSteps.map((step, index) => (
                      <div key={step.id} className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                            currentPhotoStep === index ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}>
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold">{step.title}</h4>
                            <p className="text-sm text-muted-foreground">{step.description}</p>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {step.photos.length}/{step.maxPhotos}
                          </span>
                        </div>

                        <div className="grid gap-3 pl-11">
                          <label
                            htmlFor={`photo-step-${index}`}
                            className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 p-4 transition hover:border-primary hover:bg-primary/5"
                          >
                            <Upload className="h-5 w-5 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              Ajouter des photos ({step.maxPhotos - step.photos.length} restantes)
                            </span>
                          </label>
                          <Input
                            id={`photo-step-${index}`}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => handleStepPhotoChange(index, e)}
                            ref={(el) => (photoInputRefs.current[index] = el)}
                            className="hidden"
                            disabled={step.photos.length >= step.maxPhotos}
                          />

                          {step.photos.length > 0 && (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {step.photos.map((file, photoIndex) => (
                                <div
                                  key={`${file.name}-${photoIndex}`}
                                  className="flex items-center gap-3 rounded-lg border bg-card p-3"
                                >
                                  <Camera className="h-5 w-5 text-primary" />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeStepPhoto(index, photoIndex)}
                                    className="h-8 w-8 p-0"
                                  >
                                    ×
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <div className="sticky bottom-4 z-10 flex justify-end">
            <Button
              type="submit"
              size="lg"
              className="h-16 w-full rounded-2xl text-lg font-semibold shadow-xl md:w-auto md:px-16"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Enregistrement..." : "Enregistrer le lead"}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
};

export default CommercialLeadPOS;
