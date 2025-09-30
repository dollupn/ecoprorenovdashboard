import { useMemo, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import {
  Users,
  Building2,
  Bell,
  Shield,
  Database,
  Mail,
  Phone,
  Settings as SettingsIcon,
  RefreshCw,
  Plug,
  ShieldCheck,
  KeyRound,
  MonitorSmartphone,
  Clock,
} from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  role: "Administrateur" | "Manager" | "Commercial" | "Technicien";
  email: string;
  phone: string;
  active: boolean;
  lastConnection: string;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  status: "connected" | "pending" | "disconnected";
  lastSync: string;
}

interface CompanyInfo {
  name: string;
  legalName: string;
  registration: string;
  address: string;
  phone: string;
  email: string;
  description: string;
}

interface NotificationSettings {
  commercialEmails: boolean;
  operationalEmails: boolean;
  smsReminders: boolean;
  pushNotifications: boolean;
  weeklyDigest: boolean;
}

interface SecuritySettings {
  twoFactor: boolean;
  passwordRotation: boolean;
  loginAlerts: boolean;
  sessionDuration: string;
}

const initialMembers: TeamMember[] = [
  {
    id: "1",
    name: "Camille Dupont",
    role: "Administrateur",
    email: "camille.dupont@ecoprorenov.fr",
    phone: "+33 6 45 89 12 34",
    active: true,
    lastConnection: "Il y a 2 heures",
  },
  {
    id: "2",
    name: "Léo Martin",
    role: "Manager",
    email: "leo.martin@ecoprorenov.fr",
    phone: "+33 6 54 23 78 90",
    active: true,
    lastConnection: "Hier",
  },
  {
    id: "3",
    name: "Sophie Bernard",
    role: "Commercial",
    email: "sophie.bernard@ecoprorenov.fr",
    phone: "+33 7 12 98 45 67",
    active: true,
    lastConnection: "Il y a 3 jours",
  },
  {
    id: "4",
    name: "Antoine Leroy",
    role: "Technicien",
    email: "antoine.leroy@ecoprorenov.fr",
    phone: "+33 6 88 76 45 12",
    active: false,
    lastConnection: "Il y a 12 jours",
  },
];

const initialIntegrations: Integration[] = [
  {
    id: "erp",
    name: "ERP BatiConnect",
    description: "Synchronisation des chantiers et du catalogue produits.",
    status: "connected",
    lastSync: "Il y a 12 minutes",
  },
  {
    id: "mailjet",
    name: "Mailjet",
    description: "Campagnes emailing clients et notifications transactionnelles.",
    status: "pending",
    lastSync: "Synchronisation en attente",
  },
  {
    id: "quickbooks",
    name: "Quickbooks",
    description: "Exports comptables automatiques des factures validées.",
    status: "disconnected",
    lastSync: "Jamais synchronisé",
  },
];

const sessionOptions = [
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 heure" },
  { value: "120", label: "2 heures" },
];

export default function Settings() {
  const { toast } = useToast();
  const [teamMembers, setTeamMembers] = useState(initialMembers);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    name: "EcoProRenov",
    legalName: "EcoProRenov SAS",
    registration: "SIRET 897 654 321 00018",
    address: "42 rue des Artisans, 69007 Lyon",
    phone: "+33 4 78 12 45 90",
    email: "contact@ecoprorenov.fr",
    description:
      "Entreprise spécialisée dans les rénovations énergétiques globales pour les particuliers et les copropriétés.",
  });
  const [notifications, setNotifications] = useState<NotificationSettings>({
    commercialEmails: true,
    operationalEmails: true,
    smsReminders: true,
    pushNotifications: false,
    weeklyDigest: true,
  });
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    twoFactor: true,
    passwordRotation: true,
    loginAlerts: false,
    sessionDuration: "60",
  });
  const [integrations, setIntegrations] = useState(initialIntegrations);

  const activeMembers = useMemo(() => teamMembers.filter((member) => member.active).length, [teamMembers]);

  const handleRoleChange = (id: string, role: TeamMember["role"]) => {
    setTeamMembers((prev) =>
      prev.map((member) => (member.id === id ? { ...member, role } : member))
    );
    toast({
      title: "Rôle mis à jour",
      description: "Le rôle du collaborateur a été modifié avec succès.",
    });
  };

  const handleToggleMember = (id: string, active: boolean) => {
    setTeamMembers((prev) =>
      prev.map((member) => (member.id === id ? { ...member, active } : member))
    );
    toast({
      title: active ? "Collaborateur activé" : "Collaborateur désactivé",
      description: active
        ? "Le collaborateur aura accès à la plateforme dès maintenant."
        : "Le collaborateur ne pourra plus se connecter tant qu'il n'est pas réactivé.",
    });
  };

  const handleInviteMember = () => {
    toast({
      title: "Invitation envoyée",
      description: "Un email d'invitation a été envoyé au collaborateur.",
    });
  };

  const handleCompanySubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    toast({
      title: "Informations enregistrées",
      description: "Les informations de l'entreprise ont été mises à jour.",
    });
  };

  const toggleNotification = (key: keyof NotificationSettings) => {
    setNotifications((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      return updated;
    });
  };

  const handleSaveNotifications = () => {
    toast({
      title: "Préférences sauvegardées",
      description: "Les notifications seront appliquées pour toute l'équipe.",
    });
  };

  const handleIntegrationAction = (integration: Integration) => {
    setIntegrations((prev) =>
      prev.map((item) =>
        item.id === integration.id
          ? {
              ...item,
              status: item.status === "connected" ? "disconnected" : "connected",
              lastSync: item.status === "connected" ? "Connexion interrompue" : "Synchronisation programmée",
            }
          : item
      )
    );
    toast({
      title:
        integration.status === "connected"
          ? "Intégration désactivée"
          : "Intégration activée",
      description:
        integration.status === "connected"
          ? "La connexion a été coupée. Vous pourrez la réactiver à tout moment."
          : "La connexion est en cours d'initialisation.",
    });
  };

  const handleSecuritySave = () => {
    toast({
      title: "Paramètres de sécurité enregistrés",
      description: "Les nouvelles règles de sécurité sont effectives immédiatement.",
    });
  };

  const handleSessionDurationChange = (value: string) => {
    setSecuritySettings((prev) => ({ ...prev, sessionDuration: value }));
  };

  const activeSessions = [
    {
      device: "MacBook Pro • Lyon",
      lastActive: "Il y a 8 minutes",
      browser: "Chrome 122",
      secure: true,
    },
    {
      device: "iPhone 15 • Mobile",
      lastActive: "Il y a 2 heures",
      browser: "Safari iOS",
      secure: true,
    },
  ];

  const integrationStatusStyles: Record<Integration["status"], string> = {
    connected: "border-emerald-200/60 bg-emerald-500/10 text-emerald-700",
    pending: "border-amber-200/60 bg-amber-500/10 text-amber-700",
    disconnected: "border-red-200/60 bg-red-500/10 text-red-700",
  };

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
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold text-foreground">Paramètres</h1>
                <p className="text-lg text-muted-foreground">
                  Centralisez les préférences de votre organisation et pilotez les accès en toute sérénité.
                </p>
              </div>
            </div>
            <Card className="w-full max-w-sm border border-primary/10 bg-background/80 shadow-none">
              <CardContent className="space-y-4 p-6 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <Shield className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Sécurité renforcée</p>
                    <p>{activeMembers} collaborateurs actifs avec authentification sécurisée.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Database className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Sauvegardes automatiques</p>
                    <p>Dernière sauvegarde complète effectuée il y a 2 heures.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.65fr,1fr]">
          <div className="space-y-6">
            <Card className="border border-border/60 bg-card/70 shadow-sm">
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <Users className="h-5 w-5 text-primary" />
                    Gestion des utilisateurs
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Administrez les accès, les rôles et le statut d&apos;activité de vos collaborateurs.
                  </p>
                </div>
                <Button onClick={handleInviteMember} variant="secondary">
                  Inviter un membre
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/60 p-4 transition hover:border-primary/40 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {member.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{member.name}</p>
                        <div className="flex flex-wrap items-center gap-x-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            {member.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5" />
                            {member.phone}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
                      <div className="space-y-1">
                        <Label htmlFor={`role-${member.id}`} className="text-xs uppercase tracking-wide text-muted-foreground">
                          Rôle
                        </Label>
                        <Select
                          value={member.role}
                          onValueChange={(value: TeamMember["role"]) => handleRoleChange(member.id, value)}
                        >
                          <SelectTrigger id={`role-${member.id}`} className="w-[180px]">
                            <SelectValue placeholder="Sélectionner" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Administrateur">Administrateur</SelectItem>
                            <SelectItem value="Manager">Manager</SelectItem>
                            <SelectItem value="Commercial">Commercial</SelectItem>
                            <SelectItem value="Technicien">Technicien</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                          Dernière connexion
                        </Label>
                        <p className="text-sm text-foreground">{member.lastConnection}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Label htmlFor={`active-${member.id}`} className="text-sm text-muted-foreground">
                          {member.active ? "Actif" : "Inactif"}
                        </Label>
                        <Switch
                          id={`active-${member.id}`}
                          checked={member.active}
                          onCheckedChange={(checked) => handleToggleMember(member.id, checked)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

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
                <form className="space-y-6" onSubmit={handleCompanySubmit}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="company-name">Nom d&apos;usage</Label>
                      <Input
                        id="company-name"
                        value={companyInfo.name}
                        onChange={(event) => setCompanyInfo((prev) => ({ ...prev, name: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-legal">Raison sociale</Label>
                      <Input
                        id="company-legal"
                        value={companyInfo.legalName}
                        onChange={(event) => setCompanyInfo((prev) => ({ ...prev, legalName: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-registration">Enregistrement</Label>
                      <Input
                        id="company-registration"
                        value={companyInfo.registration}
                        onChange={(event) => setCompanyInfo((prev) => ({ ...prev, registration: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-phone">Téléphone</Label>
                      <Input
                        id="company-phone"
                        value={companyInfo.phone}
                        onChange={(event) => setCompanyInfo((prev) => ({ ...prev, phone: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-email">Email principal</Label>
                      <Input
                        id="company-email"
                        type="email"
                        value={companyInfo.email}
                        onChange={(event) => setCompanyInfo((prev) => ({ ...prev, email: event.target.value }))}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="company-address">Adresse</Label>
                      <Textarea
                        id="company-address"
                        value={companyInfo.address}
                        onChange={(event) => setCompanyInfo((prev) => ({ ...prev, address: event.target.value }))}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="company-description">Description publique</Label>
                      <Textarea
                        id="company-description"
                        value={companyInfo.description}
                        onChange={(event) => setCompanyInfo((prev) => ({ ...prev, description: event.target.value }))}
                        rows={3}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <Button type="button" variant="ghost">
                      Annuler
                    </Button>
                    <Button type="submit">Enregistrer les modifications</Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="border border-border/60 bg-card/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Bell className="h-5 w-5 text-primary" />
                  Préférences de notifications
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Personnalisez les canaux de communication pour chaque événement métier important.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {[{
                    key: "commercialEmails" as const,
                    title: "Suivi commercial",
                    description: "Alertes sur les nouveaux leads, rappels de relance et devis en attente.",
                  }, {
                    key: "operationalEmails" as const,
                    title: "Opérations & chantiers",
                    description: "Notifications de planification, pointages d'équipes et suivi de chantier.",
                  }, {
                    key: "smsReminders" as const,
                    title: "SMS automatiques",
                    description: "Rappels de rendez-vous clients et confirmations d'interventions.",
                  }, {
                    key: "pushNotifications" as const,
                    title: "Notifications mobiles",
                    description: "Alertes en temps réel sur mobile pour les demandes critiques.",
                  }, {
                    key: "weeklyDigest" as const,
                    title: "Rapport hebdomadaire",
                    description: "Synthèse des indicateurs clés envoyée chaque lundi matin.",
                  }].map((item) => (
                    <div
                      key={item.key}
                      className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/60 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-medium text-foreground">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <Switch
                        checked={notifications[item.key]}
                        onCheckedChange={() => toggleNotification(item.key)}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-end">
                  <Button onClick={handleSaveNotifications}>Sauvegarder les préférences</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border border-border/60 bg-card/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Plug className="h-5 w-5 text-primary" />
                  Intégrations & API
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Connectez vos outils métiers pour fluidifier vos process commerciaux et opérationnels.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {integrations.map((integration) => (
                  <div
                    key={integration.id}
                    className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{integration.name}</p>
                          <Badge className={integrationStatusStyles[integration.status]} variant="outline">
                            {integration.status === "connected"
                              ? "Connecté"
                              : integration.status === "pending"
                                ? "En attente"
                                : "Déconnecté"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{integration.description}</p>
                      </div>
                      <Button
                        variant={integration.status === "connected" ? "ghost" : "secondary"}
                        onClick={() => handleIntegrationAction(integration)}
                        className="gap-2"
                      >
                        <RefreshCw className="h-4 w-4" />
                        {integration.status === "connected" ? "Désactiver" : "Connecter"}
                      </Button>
                    </div>
                    <Separator className="bg-border/60" />
                    <p className="text-xs text-muted-foreground">Dernière synchronisation : {integration.lastSync}</p>
                  </div>
                ))}
                <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground">
                  Besoin d&apos;une intégration personnalisée ? Contactez notre équipe pour accéder à l&apos;API et aux webhooks sécurisés.
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/60 bg-card/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Sécurité & conformité
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Définissez des politiques de sécurité avancées pour protéger vos données sensibles.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-4">
                  {[{
                    key: "twoFactor" as const,
                    title: "Double authentification",
                    description: "Obliger l&apos;activation de la double authentification pour tous les comptes.",
                    icon: KeyRound,
                  }, {
                    key: "passwordRotation" as const,
                    title: "Rotation des mots de passe",
                    description: "Demander un renouvellement de mot de passe tous les 90 jours.",
                    icon: RefreshCw,
                  }, {
                    key: "loginAlerts" as const,
                    title: "Alertes de connexion",
                    description: "Notifier l&apos;équipe sécurité des connexions depuis de nouveaux appareils.",
                    icon: MonitorSmartphone,
                  }].map((setting) => (
                    <div
                      key={setting.key}
                      className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/60 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <setting.icon className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium text-foreground">{setting.title}</p>
                          <p className="text-sm text-muted-foreground">{setting.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={securitySettings[setting.key]}
                        onCheckedChange={(checked) =>
                          setSecuritySettings((prev) => ({ ...prev, [setting.key]: checked }))
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">Durée des sessions</p>
                        <p className="text-sm text-muted-foreground">
                          Limitez la durée des sessions inactives avant déconnexion automatique.
                        </p>
                      </div>
                    </div>
                    <Select value={securitySettings.sessionDuration} onValueChange={handleSessionDurationChange}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Durée" />
                      </SelectTrigger>
                      <SelectContent>
                        {sessionOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4">
                  <p className="text-sm font-medium text-foreground">Sessions actives</p>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    {activeSessions.map((session) => (
                      <div
                        key={session.device}
                        className="flex flex-col gap-1 rounded-xl border border-border/50 bg-background p-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="font-medium text-foreground">{session.device}</p>
                          <p>{session.browser}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="border-emerald-200/60 bg-emerald-500/10 text-emerald-700">
                            Sécurisé
                          </Badge>
                          <span>{session.lastActive}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <Button onClick={handleSecuritySave}>Appliquer les règles de sécurité</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
