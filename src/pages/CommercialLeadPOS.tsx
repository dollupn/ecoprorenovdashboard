import { useState, type ChangeEvent, type FormEvent } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  MapPin,
  Phone,
  Upload,
} from "lucide-react";

const PRODUCT_OPTIONS = [
  "Isolation thermique extérieure",
  "Pompe à chaleur",
  "Panneaux solaires",
  "Chaudière haute performance",
  "Isolation des combles",
  "Audit énergétique",
];

const initialFormState = {
  fullName: "",
  company: "",
  surface: "",
  phone: "",
  address: "",
  product: "",
  notes: "",
};

type FormState = typeof initialFormState;

const formatFileSize = (sizeInBytes: number) => {
  if (sizeInBytes === 0) return "0 Ko";
  const sizeInKb = sizeInBytes / 1024;
  if (sizeInKb < 1024) {
    return `${sizeInKb.toFixed(1)} Ko`;
  }
  return `${(sizeInKb / 1024).toFixed(1)} Mo`;
};

const CommercialLeadPOS = () => {
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [photos, setPhotos] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (field: keyof FormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormState((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleProductChange = (value: string) => {
    setFormState((prev) => ({ ...prev, product: value }));
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    setPhotos(selectedFiles);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      setFormState(initialFormState);
      setPhotos([]);
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
          <Card className="border-2 border-dashed border-muted-foreground/30 shadow-lg">
            <CardHeader className="space-y-1 border-b bg-muted/40">
              <CardTitle className="text-lg font-semibold">Informations générales</CardTitle>
              <p className="text-sm text-muted-foreground">
                Cette interface est optimisée pour une utilisation sur tablette lors de vos visites terrain.
              </p>
            </CardHeader>
            <CardContent className="grid gap-6 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="fullName">Nom</Label>
                  <Input
                    id="fullName"
                    value={formState.fullName}
                    onChange={handleInputChange("fullName")}
                    placeholder="Nom et prénom du contact"
                    className="h-14 text-lg"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company">Nom de la société</Label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="company"
                      value={formState.company}
                      onChange={handleInputChange("company")}
                      placeholder="Entreprise visitée"
                      className="h-14 pl-12 text-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="surface">Surface du bâtiment</Label>
                  <Input
                    id="surface"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={formState.surface}
                    onChange={handleInputChange("surface")}
                    placeholder="Surface en m²"
                    className="h-14 text-lg"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      value={formState.phone}
                      onChange={handleInputChange("phone")}
                      placeholder="Numéro de téléphone"
                      className="h-14 pl-12 text-lg"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="address">Adresse</Label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-4 h-5 w-5 text-muted-foreground" />
                  <Textarea
                    id="address"
                    value={formState.address}
                    onChange={handleInputChange("address")}
                    placeholder="Adresse complète du site visité"
                    className="min-h-[120px] rounded-xl border-2 border-muted-foreground/30 bg-background/80 py-4 pl-12 text-lg"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="product">Produit intéressé</Label>
                <Select value={formState.product} onValueChange={handleProductChange}>
                  <SelectTrigger id="product" className="h-14 text-lg">
                    <SelectValue placeholder="Sélectionnez le produit proposé" />
                  </SelectTrigger>
                  <SelectContent className="text-base">
                    {PRODUCT_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option} className="text-base">
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Notes complémentaires</Label>
                <Textarea
                  id="notes"
                  value={formState.notes}
                  onChange={handleInputChange("notes")}
                  placeholder="Ajoutez des détails sur le besoin, la décision ou les contraintes rencontrées"
                  className="min-h-[120px] rounded-xl border-2 border-muted-foreground/30 bg-background/80 p-4 text-lg"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-dashed border-muted-foreground/30 shadow-lg">
            <CardHeader className="border-b bg-muted/40">
              <CardTitle className="text-lg font-semibold">Photos de la visite</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 p-6">
              <div className="grid gap-3">
                <Label htmlFor="photos">Ajouter des photos</Label>
                <label
                  htmlFor="photos"
                  className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-background/90 p-10 text-center transition hover:border-primary hover:bg-primary/5"
                >
                  <Upload className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-lg font-medium">Déposez vos photos ici</p>
                    <p className="text-sm text-muted-foreground">
                      Formats acceptés : JPG, PNG – vous pouvez sélectionner plusieurs fichiers
                    </p>
                  </div>
                </label>
                <Input
                  id="photos"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>

              {photos.length > 0 && (
                <div className="grid gap-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    {photos.length} fichier{photos.length > 1 ? "s" : ""} sélectionné{photos.length > 1 ? "s" : ""}
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {photos.map((file) => (
                      <div
                        key={file.name}
                        className="flex items-center gap-3 rounded-xl border border-muted-foreground/30 bg-muted/20 p-4"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Camera className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

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
