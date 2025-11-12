import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface GeneralOverviewCardProps {
  organizationName: string;
  totalMembers: number;
  activeMembers: number;
  statusCount: number;
  catalogCount: number;
  connectedIntegrations: number;
  onSelectTab: (tab: string) => void;
}

export const GeneralOverviewCard = ({
  organizationName,
  totalMembers,
  activeMembers,
  statusCount,
  catalogCount,
  connectedIntegrations,
  onSelectTab,
}: GeneralOverviewCardProps) => {
  const quickStats = [
    {
      label: "Collaborateurs",
      value: `${activeMembers}/${totalMembers}`,
      description: "membres actifs",
      tab: "team",
    },
    {
      label: "Statuts projets",
      value: statusCount.toString(),
      description: "libellés disponibles",
      tab: "statuses",
    },
    {
      label: "Référentiel",
      value: catalogCount.toString(),
      description: "entrées configurées",
      tab: "catalog",
    },
    {
      label: "Intégrations",
      value: connectedIntegrations.toString(),
      description: "connectées",
      tab: "integrations",
    },
  ];

  const actions = [
    {
      label: "Inviter un collaborateur",
      description: "Ajoutez rapidement un nouveau membre dans l'équipe.",
      tab: "team",
    },
    {
      label: "Personnaliser les statuts",
      description: "Adaptez votre tunnel de traitement aux étapes internes.",
      tab: "statuses",
    },
    {
      label: "Configurer l'entreprise",
      description: "Mettez à jour les informations visibles sur vos documents.",
      tab: "company",
    },
  ];

  return (
    <Card className="border border-border/60 bg-card/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          Bienvenue sur les paramètres, {organizationName || "votre organisation"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Choisissez un thème dans le menu pour ajuster précisément vos préférences. Commencez par un
          aperçu rapide des éléments clés de votre espace.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          {quickStats.map((stat) => (
            <button
              key={stat.label}
              type="button"
              onClick={() => onSelectTab(stat.tab)}
              className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/70 p-4 text-left transition hover:border-primary/40"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{stat.label}</p>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </div>
              <Badge variant="outline" className="text-base font-semibold">
                {stat.value}
              </Badge>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Actions suggérées</p>
          <div className="grid gap-3 md:grid-cols-3">
            {actions.map((action) => (
              <div
                key={action.tab}
                className="flex h-full flex-col justify-between rounded-2xl border border-border/60 bg-background/70 p-4"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
                <Button
                  variant="link"
                  className="self-start px-0 text-primary"
                  onClick={() => onSelectTab(action.tab)}
                >
                  Ouvrir
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
