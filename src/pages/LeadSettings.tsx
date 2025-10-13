import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings2, Tags, List, Database } from "lucide-react";

const LeadSettings = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Paramètres Lead</h1>
          <p className="text-muted-foreground">Configuration et personnalisation de la gestion des leads</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tags className="h-5 w-5" />
                Sources de leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Gérez les sources d'acquisition de vos leads (Google Ads, Facebook, Référencement naturel, etc.)
              </p>
              <div className="text-center py-8 text-muted-foreground">
                <Tags className="h-8 w-8 mx-auto mb-2 opacity-50" />
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
              <p className="text-sm text-muted-foreground mb-4">
                Définissez vos propres statuts de leads selon votre workflow
              </p>
              <div className="text-center py-8 text-muted-foreground">
                <List className="h-8 w-8 mx-auto mb-2 opacity-50" />
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
              <p className="text-sm text-muted-foreground mb-4">
                Ajoutez des champs personnalisés selon vos besoins métier
              </p>
              <div className="text-center py-8 text-muted-foreground">
                <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
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
              <p className="text-sm text-muted-foreground mb-4">
                Règles d'assignation automatique, notifications, etc.
              </p>
              <div className="text-center py-8 text-muted-foreground">
                <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Configuration à venir</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default LeadSettings;
