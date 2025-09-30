import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  Building2,
  Bell,
  Plug,
  ShieldCheck,
  Server,
  Mail,
  Shield,
  Database,
  Settings as SettingsIcon,
} from "lucide-react";

const sections = [
  {
    title: "Gestion des utilisateurs",
    description: "Gérez les comptes utilisateurs et leurs rôles au sein de l'entreprise.",
    items: [
      {
        title: "Utilisateurs et rôles",
        description:
          "Ajoutez des collaborateurs, définissez leurs responsabilités et attribuez des droits personnalisés.",
        icon: Users,
        actionLabel: "Gérer",
      },
    ],
  },
  {
    title: "Informations sur l'entreprise",
    description: "Mettez à jour les informations générales, telles que le nom, l'adresse et les coordonnées.",
    items: [
      {
        title: "Informations générales",
        description:
          "Personnalisez le profil public de votre entreprise, vos coordonnées et vos mentions légales.",
        icon: Building2,
        actionLabel: "Modifier",
      },
    ],
  },
  {
    title: "Préférences de notification",
    description: "Personnalisez les notifications pour les différents évènements et actions dans le CRM.",
    items: [
      {
        title: "Notifications",
        description:
          "Choisissez les canaux d'alerte, les équipes concernées et la fréquence des rappels automatiques.",
        icon: Bell,
        actionLabel: "Configurer",
      },
      {
        title: "Alertes email",
        description:
          "Définissez les modèles d'email, l'expéditeur et les destinataires pour vos communications.",
        icon: Mail,
        actionLabel: "Personnaliser",
      },
    ],
  },
  {
    title: "Intégrations",
    description: "Connectez des services tiers et automatisez vos flux de travail métier.",
    items: [
      {
        title: "Services externes",
        description:
          "Activez les synchronisations avec vos outils de prospection, de facturation ou de suivi chantier.",
        icon: Plug,
        actionLabel: "Explorer",
      },
      {
        title: "API & Webhooks",
        description:
          "Créez des clés API, configurez des webhooks entrants et suivez l'activité des intégrations.",
        icon: Server,
        actionLabel: "Gérer",
      },
    ],
  },
  {
    title: "Sécurité et sauvegarde",
    description: "Renforcez la protection de vos données et assurez-vous de leur sauvegarde régulière.",
    items: [
      {
        title: "Sécurité & conformité",
        description:
          "Activez la double authentification, configurez les politiques de mot de passe et suivez les accès.",
        icon: ShieldCheck,
        actionLabel: "Renforcer",
      },
      {
        title: "Sauvegarde des données",
        description:
          "Planifiez des sauvegardes automatiques, restaurez des versions précédentes et suivez l'historique.",
        icon: Database,
        actionLabel: "Programmer",
      },
    ],
  },
];

export default function Settings() {
  return (
    <Layout>
      <div className="space-y-8">
        <div className="rounded-3xl border bg-card/60 p-10 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
                <SettingsIcon className="h-4 w-4" />
                Centre de configuration
              </span>
              <div>
                <h1 className="text-3xl font-semibold text-foreground">Paramètres</h1>
                <p className="text-lg text-muted-foreground">
                  Personnalisez l'expérience EcoProRenov pour votre équipe et sécurisez vos données.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-4 rounded-2xl border bg-background/80 p-6 text-sm text-muted-foreground md:w-80">
              <div className="flex items-start gap-3">
                <Shield className="h-4 w-4 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Statut de sécurité</p>
                  <p>Toutes les fonctionnalités critiques sont actives et à jour.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Database className="h-4 w-4 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Sauvegardes actives</p>
                  <p>Dernière sauvegarde automatique effectuée il y a 2 heures.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {sections.map((section) => (
            <div key={section.title} className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
                <p className="text-sm text-muted-foreground">{section.description}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {section.items.map((item) => (
                  <Card key={item.title} className="border border-border/60 bg-card/70 shadow-sm transition hover:border-primary/50">
                    <CardContent className="flex gap-4 p-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <p className="text-base font-medium text-foreground">{item.title}</p>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                        <Button variant="secondary" className="self-start md:self-auto">
                          {item.actionLabel}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
