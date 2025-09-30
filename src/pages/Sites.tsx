import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SiteDialog, type SiteFormValues } from "@/components/sites/SiteDialog";
import { useToast } from "@/components/ui/use-toast";
import { mockProjects } from "@/data/projects";
import {
  Plus,
  Search,
  Filter,
  Calendar,
  MapPin,
  Euro,
  Users,
  Clock,
  Pencil,
  CheckCircle2,
  RefreshCcw,
  TrendingUp,
  ShieldCheck,
  Ruler,
  HandCoins,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type SiteStatus = "PLANIFIE" | "EN_PREPARATION" | "EN_COURS" | "SUSPENDU" | "TERMINE" | "LIVRE";
type CofracStatus = "EN_ATTENTE" | "CONFORME" | "NON_CONFORME" | "A_PLANIFIER";

interface AdditionalCost {
  label: string;
  amount: number;
}

interface Site {
  id: string;
  site_ref: string;
  project_ref: string;
  client_name: string;
  product_name: string;
  address: string;
  city: string;
  postal_code: string;
  status: SiteStatus;
  cofrac_status: CofracStatus;
  team_members: string[];
  date_debut: string;
  date_fin_prevue?: string;
  progress_percentage: number;
  revenue: number;
  profit_margin: number;
  surface_facturee: number;
  cout_main_oeuvre_m2_ht: number;
  cout_isolation_m2: number;
  isolation_utilisee_m2: number;
  montant_commission: number;
  valorisation_cee: number;
  additional_costs: AdditionalCost[];
  notes?: string;
  created_at: string;
}

const mockSites: Site[] = [
  {
    id: "1",
    site_ref: "SITE-2024-0034",
    project_ref: "PRJ-2024-0089",
    client_name: "Sophie Bernard",
    product_name: "Isolation Façade",
    address: "45 Avenue de la République",
    city: "Toulouse",
    postal_code: "31000",
    status: "EN_COURS",
    cofrac_status: "EN_ATTENTE",
    team_members: ["Marc Technicien", "Paul Ouvrier"],
    date_debut: "2024-04-01",
    date_fin_prevue: "2024-04-15",
    progress_percentage: 65,
    revenue: 24800,
    profit_margin: 28,
    surface_facturee: 180,
    cout_main_oeuvre_m2_ht: 45,
    cout_isolation_m2: 32,
    isolation_utilisee_m2: 180,
    montant_commission: 1200,
    valorisation_cee: 5200,
    additional_costs: [
      { label: "Location nacelle", amount: 650 },
      { label: "Gestion des déchets", amount: 280 },
    ],
    notes: "Suivi rapproché avec le bureau de contrôle.",
    created_at: "2024-03-25T10:00:00Z",
  },
  {
    id: "2",
    site_ref: "SITE-2024-0035",
    project_ref: "PRJ-2024-0091",
    client_name: "Jean Martin",
    product_name: "Panneaux Solaires",
    address: "12 Rue de la Paix",
    city: "Lyon",
    postal_code: "69003",
    status: "TERMINE",
    cofrac_status: "CONFORME",
    team_members: ["Marc Technicien"],
    date_debut: "2024-03-20",
    date_fin_prevue: "2024-03-25",
    progress_percentage: 100,
    revenue: 31200,
    profit_margin: 33,
    surface_facturee: 96,
    cout_main_oeuvre_m2_ht: 38,
    cout_isolation_m2: 0,
    isolation_utilisee_m2: 0,
    montant_commission: 1500,
    valorisation_cee: 4100,
    additional_costs: [{ label: "Renforcement charpente", amount: 950 }],
    created_at: "2024-03-18T09:30:00Z",
  },
  {
    id: "3",
    site_ref: "SITE-2024-0036",
    project_ref: "PRJ-2024-0087",
    client_name: "Pierre Dubois",
    product_name: "Pompe à Chaleur",
    address: "78 Boulevard Voltaire",
    city: "Paris",
    postal_code: "75011",
    status: "PLANIFIE",
    cofrac_status: "A_PLANIFIER",
    team_members: ["Sophie Technicien", "Luc Ouvrier"],
    date_debut: "2024-04-20",
    date_fin_prevue: "2024-04-22",
    progress_percentage: 0,
    revenue: 18400,
    profit_margin: 24,
    surface_facturee: 65,
    cout_main_oeuvre_m2_ht: 42,
    cout_isolation_m2: 18,
    isolation_utilisee_m2: 65,
    montant_commission: 980,
    valorisation_cee: 3600,
    additional_costs: [{ label: "Déplacement longue distance", amount: 320 }],
    created_at: "2024-04-10T14:20:00Z",
  },
];

const getStatusLabel = (status: SiteStatus) => {
  const labels: Record<SiteStatus, string> = {
    PLANIFIE: "Planifié",
    EN_PREPARATION: "En préparation",
    EN_COURS: "En cours",
    SUSPENDU: "Suspendu",
    TERMINE: "Terminé",
    LIVRE: "Livré",
  };
  return labels[status];
};

const getStatusColor = (status: SiteStatus) => {
  const colors: Record<SiteStatus, string> = {
    PLANIFIE: "bg-blue-500/10 text-blue-700 border-blue-200",
    EN_PREPARATION: "bg-orange-500/10 text-orange-700 border-orange-200",
    EN_COURS: "bg-primary/10 text-primary border-primary/20",
    SUSPENDU: "bg-red-500/10 text-red-700 border-red-200",
    TERMINE: "bg-green-500/10 text-green-700 border-green-200",
    LIVRE: "bg-teal-500/10 text-teal-700 border-teal-200",
  };
  return colors[status];
};

const getProgressColor = (percentage: number) => {
  if (percentage === 0) return "bg-gray-200";
  if (percentage < 50) return "bg-orange-500";
  if (percentage < 100) return "bg-primary";
  return "bg-green-500";
};

const getCofracStatusLabel = (status: CofracStatus) => {
  const labels: Record<CofracStatus, string> = {
    EN_ATTENTE: "En attente",
    CONFORME: "Conforme",
    NON_CONFORME: "Non conforme",
    A_PLANIFIER: "Audit à planifier",
  };
  return labels[status];
};

const getCofracStatusColor = (status: CofracStatus) => {
  const colors: Record<CofracStatus, string> = {
    EN_ATTENTE: "bg-amber-500/10 text-amber-700 border-amber-200",
    CONFORME: "bg-green-500/10 text-green-700 border-green-200",
    NON_CONFORME: "bg-red-500/10 text-red-700 border-red-200",
    A_PLANIFIER: "bg-blue-500/10 text-blue-700 border-blue-200",
  };
  return colors[status];
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

const formatPercent = (value: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} %`;

const createFormValuesFromSite = (site: Site): SiteFormValues => ({
  site_ref: site.site_ref,
  project_ref: site.project_ref,
  client_name: site.client_name,
  product_name: site.product_name,
  address: site.address,
  city: site.city,
  postal_code: site.postal_code,
  status: site.status,
  cofrac_status: site.cofrac_status,
  date_debut: site.date_debut,
  date_fin_prevue: site.date_fin_prevue ?? "",
  progress_percentage: site.progress_percentage,
  revenue: site.revenue,
  profit_margin: site.profit_margin,
  surface_facturee: site.surface_facturee,
  cout_main_oeuvre_m2_ht: site.cout_main_oeuvre_m2_ht,
  cout_isolation_m2: site.cout_isolation_m2,
  isolation_utilisee_m2: site.isolation_utilisee_m2,
  montant_commission: site.montant_commission,
  valorisation_cee: site.valorisation_cee,
  notes: site.notes ?? "",
  team_members: site.team_members.map((member) => ({ name: member })),
  additional_costs: site.additional_costs.map((cost) => ({ ...cost })),
});

const siteStatuses: SiteStatus[] = [
  "PLANIFIE",
  "EN_PREPARATION",
  "EN_COURS",
  "SUSPENDU",
  "TERMINE",
  "LIVRE",
];

type SitesLocationState = {
  createSite?: {
    projectId: string;
  };
};

const Sites = () => {
  const [sites, setSites] = useState<Site[]>(mockSites);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [dialogInitialValues, setDialogInitialValues] =
    useState<Partial<SiteFormValues>>();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setActiveSiteId(null);
      setDialogInitialValues(undefined);
    }
  };

  const handleOpenCreate = useCallback(
    (initial?: Partial<SiteFormValues>) => {
      const baseDefaults: Partial<SiteFormValues> = {
        site_ref: `SITE-${new Date().getFullYear()}-${String(sites.length + 1).padStart(4, "0")}`,
        date_debut: new Date().toISOString().slice(0, 10),
        status: "PLANIFIE",
        cofrac_status: "EN_ATTENTE",
        progress_percentage: 0,
        revenue: 0,
        profit_margin: 0,
        surface_facturee: 0,
        cout_main_oeuvre_m2_ht: 0,
        cout_isolation_m2: 0,
        isolation_utilisee_m2: 0,
        montant_commission: 0,
        valorisation_cee: 0,
        team_members: [{ name: "" }],
        additional_costs: [{ label: "", amount: 0 }],
      };

      setDialogMode("create");
      setActiveSiteId(null);
      setDialogInitialValues({ ...baseDefaults, ...initial });
      setDialogOpen(true);
    },
    [sites.length],
  );

  const handleEditSite = (site: Site) => {
    setDialogMode("edit");
    setActiveSiteId(site.id);
    setDialogInitialValues(createFormValuesFromSite(site));
    setDialogOpen(true);
  };

  const handleSubmitSite = (values: SiteFormValues) => {
    const sanitizedTeam = values.team_members.map((member) => member.name.trim()).filter(Boolean);
    const sanitizedCosts = values.additional_costs
      .filter((cost) => cost.label.trim().length > 0)
      .map((cost) => ({ label: cost.label.trim(), amount: cost.amount }));

    const updatedFields = {
      site_ref: values.site_ref,
      project_ref: values.project_ref,
      client_name: values.client_name,
      product_name: values.product_name,
      address: values.address,
      city: values.city,
      postal_code: values.postal_code,
      status: values.status,
      cofrac_status: values.cofrac_status,
      date_debut: values.date_debut,
      date_fin_prevue: values.date_fin_prevue || undefined,
      progress_percentage: values.progress_percentage,
      revenue: values.revenue,
      profit_margin: values.profit_margin,
      surface_facturee: values.surface_facturee,
      cout_main_oeuvre_m2_ht: values.cout_main_oeuvre_m2_ht,
      cout_isolation_m2: values.cout_isolation_m2,
      isolation_utilisee_m2: values.isolation_utilisee_m2,
      montant_commission: values.montant_commission,
      valorisation_cee: values.valorisation_cee,
      notes: values.notes?.trim() ? values.notes.trim() : undefined,
      team_members: sanitizedTeam,
      additional_costs: sanitizedCosts,
    };

    if (dialogMode === "create") {
      const newSite: Site = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
        ...updatedFields,
        team_members: updatedFields.team_members.length > 0 ? updatedFields.team_members : ["Équipe chantier"],
        created_at: new Date().toISOString(),
      };
      setSites((prev) => [...prev, newSite]);
      toast({
        title: "Chantier créé",
        description: `${newSite.site_ref} a été ajouté à la liste des chantiers.`,
      });
    } else if (dialogMode === "edit" && activeSiteId) {
      setSites((prev) =>
        prev.map((site) =>
          site.id === activeSiteId
            ? {
                ...site,
                ...updatedFields,
                team_members:
                  updatedFields.team_members.length > 0
                    ? updatedFields.team_members
                    : site.team_members,
                additional_costs: updatedFields.additional_costs,
              }
            : site,
        ),
      );
      toast({
        title: "Chantier mis à jour",
        description: `${values.site_ref} a été mis à jour avec succès.`,
      });
    }

    setDialogOpen(false);
  };

  const handleStatusChange = (siteId: string, status: SiteStatus) => {
    setSites((prev) =>
      prev.map((site) => (site.id === siteId ? { ...site, status } : site)),
    );
    toast({
      title: "Statut mis à jour",
      description: `Le chantier est maintenant ${getStatusLabel(status)}.`,
    });
  };

  const handleMarkAsDone = (siteId: string) => {
    setSites((prev) =>
      prev.map((site) =>
        site.id === siteId
          ? { ...site, status: "TERMINE", progress_percentage: 100 }
          : site,
      ),
    );
    toast({
      title: "Chantier terminé",
      description: "Le chantier est marqué comme terminé.",
    });
  };

  const locationState = (location.state as SitesLocationState | undefined) ?? undefined;

  useEffect(() => {
    if (locationState?.createSite?.projectId) {
      const project = mockProjects.find((item) => item.id === locationState.createSite?.projectId);

      if (project) {
        handleOpenCreate({
          project_ref: project.project_ref,
          client_name: project.client_name,
          product_name: project.product_name,
          city: project.city,
          postal_code: project.postal_code,
        });
        toast({
          title: "Préparation du chantier",
          description: `Chantier pré-rempli à partir de ${project.project_ref}.`,
        });
      } else {
        toast({
          title: "Projet introuvable",
          description: "Impossible de pré-remplir le chantier avec ce projet.",
          variant: "destructive",
        });
      }

      navigate(location.pathname, { replace: true });
    }
  }, [locationState, handleOpenCreate, navigate, location.pathname, toast]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Gestion des Chantiers
            </h1>
            <p className="text-muted-foreground mt-1">
              Suivi en temps réel de vos chantiers de rénovation énergétique
            </p>
          </div>
          <Button onClick={() => handleOpenCreate()}>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau chantier
          </Button>
        </div>

        <Card className="shadow-card bg-gradient-card border-0">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par référence, client, adresse..."
                  className="pl-10"
                />
              </div>
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                Filtres
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {sites.map((site) => (
            <Card
              key={site.id}
              className="shadow-card bg-gradient-card border-0 hover:shadow-elevated transition-all duration-300"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-primary">
                      {site.site_ref}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Projet : {site.project_ref}
                    </p>
                    <p className="text-sm font-medium">{site.client_name}</p>
                  </div>
                  <Badge className={getStatusColor(site.status)}>
                    {getStatusLabel(site.status)}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-foreground mb-1">{site.product_name}</h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    {site.address ? `${site.address} · ` : null}
                    {site.city} ({site.postal_code})
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Euro className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">CA</p>
                      <p className="font-semibold">{formatCurrency(site.revenue)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Marge</p>
                      <p className="font-semibold">{formatPercent(site.profit_margin)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-sky-600" />
                    <Badge className={getCofracStatusColor(site.cofrac_status)}>
                      {getCofracStatusLabel(site.cofrac_status)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-amber-600" />
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Surface facturée</p>
                      <p className="font-semibold">{site.surface_facturee} m²</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <HandCoins className="w-4 h-4 text-purple-600" />
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Commission</p>
                      <p className="font-semibold">{formatCurrency(site.montant_commission)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Euro className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Valorisation CEE</p>
                      <p className="font-semibold">{formatCurrency(site.valorisation_cee)}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Début :</span>
                    <span className="font-medium">
                      {new Date(site.date_debut).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  {site.date_fin_prevue && (
                    <div className="flex items-center gap-2 text-sm ml-6">
                      <span className="text-muted-foreground">Fin prévue :</span>
                      <span className="font-medium">
                        {new Date(site.date_fin_prevue).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avancement :</span>
                    <span className="font-medium">{site.progress_percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(site.progress_percentage)}`}
                      style={{ width: `${site.progress_percentage}%` }}
                    ></div>
                  </div>
                </div>

                <div className="pt-2 border-t space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Équipe :</span>
                  </div>
                  <div className="flex flex-wrap gap-1 ml-6">
                    {site.team_members.map((member, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {member}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEditSite(site)}>
                    <Pencil className="w-4 h-4 mr-1" /> Modifier
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">
                        <RefreshCcw className="w-4 h-4 mr-1" /> Statut
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {siteStatuses.map((status) => (
                        <DropdownMenuItem
                          key={status}
                          onClick={() => handleStatusChange(site.id, status)}
                        >
                          {getStatusLabel(status)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => handleMarkAsDone(site.id)}
                    disabled={site.status === "TERMINE"}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Terminer
                  </Button>
                  <Button size="sm" variant="ghost" className="flex-1" disabled>
                    <Clock className="w-4 h-4 mr-1" /> Planning
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <SiteDialog
        open={dialogOpen}
        mode={dialogMode}
        onOpenChange={handleDialogOpenChange}
        onSubmit={handleSubmitSite}
        initialValues={dialogInitialValues}
      />
    </Layout>
  );
};

export default Sites;
