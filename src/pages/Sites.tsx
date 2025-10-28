import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Hammer } from "lucide-react";

const Sites = () => {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Gestion des chantiers
            </h1>
          </div>
          <Button
            variant="secondary"
            onClick={() => navigate("/projects")}
            className="inline-flex items-center gap-2"
          >
            <Hammer className="h-4 w-4" />
            Accéder aux projets
          </Button>
        </div>

        <Card className="shadow-card bg-gradient-card border-0">
          <CardHeader>
            <CardTitle>Changement d'emplacement</CardTitle>
            <CardDescription>
              La création et la mise à jour des chantiers se font désormais depuis les fiches projets.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Rendez-vous sur un projet puis ouvrez l'onglet <strong>Chantiers</strong> pour gérer les interventions
              associées. Chaque chantier est regroupé avec les informations du projet correspondant pour un suivi
              plus fluide.
            </p>
            <Button onClick={() => navigate("/projects")} size="sm">
              Voir la liste des projets
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Sites;
