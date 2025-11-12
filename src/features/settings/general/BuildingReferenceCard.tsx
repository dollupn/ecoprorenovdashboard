import { List, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

interface BuildingReferenceCardProps {
  buildingTypes: string[];
  buildingUsages: string[];
  disableResetTypes: boolean;
  disableResetUsages: boolean;
  onTypeChange: (index: number, value: string) => void;
  onAddType: () => void;
  onRemoveType: (index: number) => void;
  onResetTypes: () => void;
  onUsageChange: (index: number, value: string) => void;
  onAddUsage: () => void;
  onRemoveUsage: (index: number) => void;
  onResetUsages: () => void;
}

export const BuildingReferenceCard = ({
  buildingTypes,
  buildingUsages,
  disableResetTypes,
  disableResetUsages,
  onTypeChange,
  onAddType,
  onRemoveType,
  onResetTypes,
  onUsageChange,
  onAddUsage,
  onRemoveUsage,
  onResetUsages,
}: BuildingReferenceCardProps) => {
  return (
    <Card className="border border-border/60 bg-card/70 shadow-sm">
      <CardHeader className="flex flex-col gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <List className="h-5 w-5 text-primary" />
            Référentiel bâtiments
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Personnalisez les types de bâtiment et les usages proposés lors de la création de projet.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-base font-medium text-foreground">Types de bâtiment</h3>
              <p className="text-sm text-muted-foreground">
                Ces valeurs alimentent les formulaires de projets et les documents commerciaux.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={onResetTypes} disabled={disableResetTypes}>
                Réinitialiser
              </Button>
              <Button size="sm" variant="secondary" className="gap-2" onClick={onAddType}>
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            {buildingTypes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
                Aucun type de bâtiment n&apos;est configuré. Ajoutez-en pour les proposer dans vos projets.
              </div>
            ) : (
              buildingTypes.map((type, index) => (
                <div key={`${type}-${index}`} className="flex items-center gap-2">
                  <Input
                    value={type}
                    onChange={(event) => onTypeChange(index, event.target.value)}
                    placeholder="Type de bâtiment"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveType(index)}
                    aria-label={`Supprimer le type ${type || index + 1}`}
                    className="h-9 w-9 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <Separator className="bg-border/60" />

        <div className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-base font-medium text-foreground">Usages</h3>
              <p className="text-sm text-muted-foreground">
                Gérez les usages disponibles lors de la qualification des projets.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={onResetUsages} disabled={disableResetUsages}>
                Réinitialiser
              </Button>
              <Button size="sm" variant="secondary" className="gap-2" onClick={onAddUsage}>
                <Plus className="h-4 w-4" />
                Ajouter
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            {buildingUsages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
                Aucun usage n&apos;est configuré. Ajoutez un usage pour le rendre disponible.
              </div>
            ) : (
              buildingUsages.map((usage, index) => (
                <div key={`${usage}-${index}`} className="flex items-center gap-2">
                  <Input
                    value={usage}
                    onChange={(event) => onUsageChange(index, event.target.value)}
                    placeholder="Usage"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveUsage(index)}
                    aria-label={`Supprimer l'usage ${usage || index + 1}`}
                    className="h-9 w-9 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
