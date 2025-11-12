import { FormEvent } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AddressAutocomplete } from "@/components/address/AddressAutocomplete";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BusinessLocation, CompanyInfo, Delegataire } from "./types";

interface OrganizationPrimeSettings {
  businessLocation: BusinessLocation;
  primeBonification: string;
}

interface CompanyInformationCardProps {
  companyInfo: CompanyInfo;
  isManualAddress: boolean;
  onCompanyInfoChange: (changes: Partial<CompanyInfo>) => void;
  onCompanySubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCompanyCancel?: () => void;
  businessLocations: { value: BusinessLocation; label: string; description: string }[];
  organizationPrimeSettings: OrganizationPrimeSettings;
  onOrganizationPrimeChange: (changes: Partial<OrganizationPrimeSettings>) => void;
  loadingOrganizationSettings: boolean;
  savingOrganizationSettings: boolean;
  onAddressChange: (
    address: string,
    city: string,
    postalCode: string,
    options?: { manual?: boolean },
  ) => void;
  delegataires: Delegataire[];
  onAddDelegataire: () => void;
  onRemoveDelegataire: (id: string) => void;
  onDelegataireChange: (id: string, field: keyof Delegataire, value: string) => void;
  onSaveDelegataires: () => void;
}

export const CompanyInformationCard = ({
  companyInfo,
  isManualAddress,
  onCompanyInfoChange,
  onCompanySubmit,
  onCompanyCancel,
  businessLocations,
  organizationPrimeSettings,
  onOrganizationPrimeChange,
  loadingOrganizationSettings,
  savingOrganizationSettings,
  onAddressChange,
  delegataires,
  onAddDelegataire,
  onRemoveDelegataire,
  onDelegataireChange,
  onSaveDelegataires,
}: CompanyInformationCardProps) => {
  return (
    <Card className="border border-border/60 bg-card/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Building2 className="h-5 w-5 text-primary" />
          Informations sur l&apos;entreprise
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Ces informations sont utilisées pour vos documents commerciaux et la communication client.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="company" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="company">Entreprise</TabsTrigger>
            <TabsTrigger value="delegataire">Délégataires</TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-6">
            <form className="space-y-6" onSubmit={onCompanySubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Nom d&apos;usage</Label>
                  <Input
                    id="company-name"
                    value={companyInfo.name}
                    onChange={(event) => onCompanyInfoChange({ name: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-legal">Raison sociale</Label>
                  <Input
                    id="company-legal"
                    value={companyInfo.legalName}
                    onChange={(event) => onCompanyInfoChange({ legalName: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-registration">Enregistrement</Label>
                  <Input
                    id="company-registration"
                    value={companyInfo.registration}
                    onChange={(event) => onCompanyInfoChange({ registration: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-phone">Téléphone</Label>
                  <Input
                    id="company-phone"
                    value={companyInfo.phone}
                    onChange={(event) => onCompanyInfoChange({ phone: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-email">Email principal</Label>
                  <Input
                    id="company-email"
                    type="email"
                    value={companyInfo.email}
                    onChange={(event) => onCompanyInfoChange({ email: event.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="company-address">Adresse</Label>
                  <AddressAutocomplete
                    value={companyInfo.address}
                    onChange={onAddressChange}
                  />
                </div>
                <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="company-city">Ville</Label>
                    <Input
                      id="company-city"
                      value={companyInfo.city}
                      readOnly={!isManualAddress}
                      onChange={(event) => onCompanyInfoChange({ city: event.target.value })}
                      placeholder="Sélectionnez une adresse"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-postal">Code postal</Label>
                    <Input
                      id="company-postal"
                      value={companyInfo.postalCode}
                      readOnly={!isManualAddress}
                      onChange={(event) => onCompanyInfoChange({ postalCode: event.target.value })}
                      placeholder="Sélectionnez une adresse"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="company-business-location">Zone géographique</Label>
                    <Select
                      value={organizationPrimeSettings.businessLocation}
                      onValueChange={(value) =>
                        onOrganizationPrimeChange({ businessLocation: value as BusinessLocation })
                      }
                    >
                      <SelectTrigger
                        id="company-business-location"
                        disabled={loadingOrganizationSettings || savingOrganizationSettings}
                      >
                        <SelectValue placeholder="Sélectionnez une zone" />
                      </SelectTrigger>
                      <SelectContent>
                        {businessLocations.map((location) => (
                          <SelectItem key={location.value} value={location.value}>
                            {location.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {
                        businessLocations.find(
                          (location) => location.value === organizationPrimeSettings.businessLocation,
                        )?.description ?? "Choisissez la zone utilisée pour calculer les primes."
                      }
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prime-bonification">Bonification Prime CEE (€)</Label>
                    <Input
                      id="prime-bonification"
                      type="number"
                      step="0.01"
                      min="0"
                      value={organizationPrimeSettings.primeBonification}
                      onChange={(event) =>
                        onOrganizationPrimeChange({ primeBonification: event.target.value })
                      }
                      disabled={loadingOrganizationSettings || savingOrganizationSettings}
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">
                      Montant additionnel appliqué automatiquement lors des simulations de prime CEE.
                    </p>
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="company-description">Description publique</Label>
                  <Textarea
                    id="company-description"
                    value={companyInfo.description}
                    onChange={(event) => onCompanyInfoChange({ description: event.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={savingOrganizationSettings}
                  onClick={onCompanyCancel}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={savingOrganizationSettings}>
                  {savingOrganizationSettings ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="delegataire" className="space-y-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-base font-medium text-foreground">Gestion des délégataires</h3>
                <p className="text-sm text-muted-foreground">
                  Configurez les partenaires pour vos opérations de délégation CEE.
                </p>
              </div>
              <Button variant="secondary" className="gap-2" onClick={onAddDelegataire}>
                <Plus className="h-4 w-4" />
                Ajouter un délégataire
              </Button>
            </div>

            {delegataires.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 p-6 text-center text-sm text-muted-foreground">
                Aucun délégataire configuré. Ajoutez-en pour centraliser vos partenariats.
              </div>
            ) : (
              <div className="space-y-4">
                {delegataires.map((delegataire, index) => (
                  <div
                    key={delegataire.id}
                    className="space-y-4 rounded-2xl border border-border/60 bg-background/60 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          Délégataire #{index + 1}
                        </span>
                        <span className="text-xs text-muted-foreground">{delegataire.email || "Email à définir"}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemoveDelegataire(delegataire.id)}
                        aria-label={`Supprimer le délégataire ${delegataire.name || index + 1}`}
                        className="h-9 w-9 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`delegataire-name-${delegataire.id}`}>Nom commercial</Label>
                        <Input
                          id={`delegataire-name-${delegataire.id}`}
                          value={delegataire.name}
                          onChange={(event) =>
                            onDelegataireChange(delegataire.id, "name", event.target.value)
                          }
                          placeholder="Nom du délégataire"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`delegataire-contact-${delegataire.id}`}>
                          Contact principal
                        </Label>
                        <Input
                          id={`delegataire-contact-${delegataire.id}`}
                          value={delegataire.contactName}
                          onChange={(event) =>
                            onDelegataireChange(delegataire.id, "contactName", event.target.value)
                          }
                          placeholder="Nom et prénom du contact"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`delegataire-email-${delegataire.id}`}>Email</Label>
                        <Input
                          id={`delegataire-email-${delegataire.id}`}
                          type="email"
                          value={delegataire.email}
                          onChange={(event) =>
                            onDelegataireChange(delegataire.id, "email", event.target.value)
                          }
                          placeholder="delegataire@exemple.fr"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`delegataire-phone-${delegataire.id}`}>Téléphone</Label>
                        <Input
                          id={`delegataire-phone-${delegataire.id}`}
                          value={delegataire.phone}
                          onChange={(event) =>
                            onDelegataireChange(delegataire.id, "phone", event.target.value)
                          }
                          placeholder="+33 1 23 45 67 89"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`delegataire-price-${delegataire.id}`}>
                          Prix par MWh (€)
                        </Label>
                        <Input
                          id={`delegataire-price-${delegataire.id}`}
                          value={delegataire.pricePerMwh}
                          onChange={(event) =>
                            onDelegataireChange(delegataire.id, "pricePerMwh", event.target.value)
                          }
                          placeholder="Prix proposé"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor={`delegataire-text-${delegataire.id}`}>
                          Bloc de texte pour le devis
                        </Label>
                        <Textarea
                          id={`delegataire-text-${delegataire.id}`}
                          value={delegataire.textBlock}
                          onChange={(event) =>
                            onDelegataireChange(delegataire.id, "textBlock", event.target.value)
                          }
                          rows={3}
                          placeholder="Informations complémentaires affichées sur le devis"
                        />
                        <p className="text-xs text-muted-foreground">
                          Ce contenu sera affiché automatiquement dans la section dédiée du devis.
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {delegataires.length > 0 && (
              <div className="flex items-center justify-end">
                <Button type="button" onClick={onSaveDelegataires}>
                  Sauvegarder les délégataires
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
