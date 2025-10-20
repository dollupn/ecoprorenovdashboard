import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadProductTypesManager } from "@/features/leads/LeadProductTypesManager";
import { Boxes, Database, List, Settings2, Tags } from "lucide-react";

export function LeadSettingsPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Paramètres Lead</h2>
        <p className="text-muted-foreground">
          Configuration et personnalisation de la gestion des leads.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5" />
              Types de produit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Gérez les types de produit utilisés lors de la création d'un lead. Ces catégories servent de
              base pour différencier vos offres (ex. Isolation, Led).
            </p>
            <LeadProductTypesManager />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5" />
              Sources de leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Gérez les sources d'acquisition de vos leads (Google Ads, Facebook, Référencement naturel, etc.)
            </p>
            <div className="py-8 text-center text-muted-foreground">
              <Tags className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm">Configuration à venir</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <List className="h-5 w-5" />
              Statuts personnalisés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Définissez vos propres statuts de leads selon votre workflow.
            </p>
            <div className="py-8 text-center text-muted-foreground">
              <List className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm">Configuration à venir</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Champs dynamiques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Ajoutez des champs personnalisés selon vos besoins métier.
            </p>
            <div className="py-8 text-center text-muted-foreground">
              <Database className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm">Configuration à venir</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Autres paramètres
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Règles d'assignation automatique, notifications, etc.
            </p>
            <div className="py-8 text-center text-muted-foreground">
              <Settings2 className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm">Configuration à venir</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
