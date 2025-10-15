import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AddressAutocomplete } from "@/components/address/AddressAutocomplete";
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
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/features/organizations/OrgContext";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";
import { useProjectBuildingTypes } from "@/hooks/useProjectBuildingTypes";
import { useProjectUsages } from "@/hooks/useProjectUsages";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatDistanceToNow, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
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
  AlertCircle,
  Palette,
  Plus,
  Trash2,
  Loader2,
  List,
} from "lucide-react";
import {
  DEFAULT_PROJECT_STATUSES,
  getProjectStatusBadgeStyle,
  getProjectStatusSettings,
  resetProjectStatuses,
  saveProjectStatuses,
  type ProjectStatusSetting,
} from "@/lib/projects";
import {
  DEFAULT_BUILDING_TYPES,
  DEFAULT_BUILDING_USAGES,
  getProjectBuildingTypes,
  getProjectUsages,
  resetProjectBuildingTypes,
  resetProjectUsages,
  saveProjectBuildingTypes,
  saveProjectUsages,
} from "@/lib/buildings";
import {
  useDriveAuthUrl,
  useDriveConnectionRefresh,
  useDriveConnectionStatus,
  useDriveDisconnect,
} from "@/integrations/googleDrive";

const ROLE_OPTIONS = ["Administrateur", "Manager", "Commercial", "Technicien"] as const;
type RoleOption = (typeof ROLE_OPTIONS)[number];

type ProfileRecord = Tables<"profiles">;

interface TeamMember {
  id: string;
  name: string;
  role: RoleOption;
  identifier: string;
  email: string | null;
  phone: string | null;
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
  city: string;
  postalCode: string;
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

const INACTIVE_KEYWORDS = new Set(["inactif", "inactive", "désactivé", "desactive", "disabled"]);

const ROLE_NORMALIZATION_MAP: Record<string, RoleOption> = {
  admin: "Administrateur",
  administrator: "Administrateur",
  administrateur: "Administrateur",
  manager: "Manager",
  responsable: "Manager",
  commercial: "Commercial",
  sales: "Commercial",
  technicien: "Technicien",
  technician: "Technicien",
};

const normalizeRole = (role: string | null): RoleOption => {
  if (!role) return "Commercial";
  const lowerRole = role.toLowerCase();
  const directMatch = ROLE_OPTIONS.find((o) => o.toLowerCase() === lowerRole);
  return directMatch ?? ROLE_NORMALIZATION_MAP[lowerRole] ?? "Commercial";
};

const isProfileActive = (role: string | null) => {
  if (!role) return true;
  return !INACTIVE_KEYWORDS.has(role.toLowerCase());
};

const formatRelativeExpiry = (iso?: string | null) => {
  if (!iso) return null;

  try {
    const formatted = formatDistanceToNow(parseISO(iso), {
      addSuffix: true,
      locale: fr,
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch (error) {
    console.warn("Unable to format Drive expiry date", error);
    return null;
  }
};

const DRIVE_AUTH_STORAGE_PREFIX = "drive-auth:";
const buildDriveAuthStateKey = (state: string) => `${DRIVE_AUTH_STORAGE_PREFIX}${state}`;

const createDriveStateToken = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

type SettingsLocationState = {
  driveAuth?: "connected" | "error";
  driveOrgId?: string;
};

const formatLastActivity = (timestamp: string | null) => {
  if (!timestamp) return "Activité inconnue";
  try {
    const formatted = formatDistanceToNow(parseISO(timestamp), {
      addSuffix: true,
      locale: fr,
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return "Activité récente";
  }
};

const mapProfileToMember = (profile: ProfileRecord): TeamMember => {
  const extendedProfile = profile as ProfileRecord & {
    email?: string | null;
    phone?: string | null;
    last_sign_in_at?: string | null;
  };

  const identifier = profile.user_id ?? profile.id;
  const lastActivity = extendedProfile.last_sign_in_at ?? profile.updated_at ?? profile.created_at;

  return {
    id: profile.id,
    name: profile.full_name ?? "Utilisateur sans nom",
    role: normalizeRole(profile.role),
    identifier,
    email: extendedProfile.email ?? null,
    phone: extendedProfile.phone ?? null,
    active: isProfileActive(profile.role),
    lastConnection: formatLastActivity(lastActivity),
  };
};

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
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentOrgId } = useOrg();
  const isMounted = useRef(true);

  const {
    data: driveConnection,
    isLoading: driveStatusLoading,
    isFetching: driveStatusFetching,
    error: driveStatusError,
  } = useDriveConnectionStatus(currentOrgId);
  const driveAuthUrlMutation = useDriveAuthUrl();
  const driveRefreshMutation = useDriveConnectionRefresh();
  const driveDisconnectMutation = useDriveDisconnect();

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [memberError, setMemberError] = useState<string | null>(null);

  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    name: "EcoProRenov",
    legalName: "EcoProRenov SAS",
    registration: "SIRET 897 654 321 00018",
    address: "42 rue des Artisans, 69007 Lyon",
    city: "Lyon",
    postalCode: "69007",
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
  useEffect(() => {
    const state = location.state as SettingsLocationState | null;
    if (!state?.driveAuth) return;

    if (state.driveAuth === "connected") {
      toast({
        title: "Google Drive connecté",
        description: "La connexion Drive de l'organisation est désormais active.",
      });
    } else if (state.driveAuth === "error") {
      toast({
        title: "Erreur Google Drive",
        description: "La connexion Drive n'a pas pu être finalisée.",
        variant: "destructive",
      });
    }

    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate, toast]);
  const syncedProjectStatuses = useProjectStatuses();
  const [projectStatuses, setProjectStatuses] = useState<ProjectStatusSetting[]>(() =>
    getProjectStatusSettings(),
  );
  const syncedBuildingTypes = useProjectBuildingTypes();
  const [buildingTypes, setBuildingTypes] = useState<string[]>(() => getProjectBuildingTypes());
  const syncedBuildingUsages = useProjectUsages();
  const [buildingUsages, setBuildingUsages] = useState<string[]>(() => getProjectUsages());

  const driveConnectionLoading = driveStatusLoading || driveStatusFetching;
  const driveErrorMessage = driveConnection?.errorMessage ?? driveStatusError?.message ?? null;
  const driveIntegration = useMemo<Integration>(() => {
    const status: Integration["status"] = !currentOrgId
      ? "pending"
      : driveConnectionLoading
      ? "pending"
      : driveConnection?.status === "connected"
      ? "connected"
      : driveConnection?.status === "pending"
      ? "pending"
      : "disconnected";

    let lastSync = "Jamais connecté";
    if (driveConnectionLoading) {
      lastSync = "Vérification de la connexion...";
    } else if (driveErrorMessage) {
      lastSync = "Erreur lors de la connexion";
    } else if (driveConnection?.expiresAt) {
      lastSync = formatRelativeExpiry(driveConnection.expiresAt) ?? "Expiration inconnue";
    } else if (driveConnection?.connected) {
      lastSync = "Connexion active";
    } else if (driveConnection?.status === "pending") {
      lastSync = "Configuration requise";
    }

    const description = driveConnection?.connected
      ? "Stockez automatiquement devis, factures et documents chantiers dans Drive."
      : "Activez Google Drive pour centraliser les documents clients et projets.";

    return {
      id: "google-drive",
      name: "Google Drive",
      description,
      status,
      lastSync,
    } satisfies Integration;
  }, [currentOrgId, driveConnection, driveConnectionLoading, driveErrorMessage]);

  const displayedIntegrations = useMemo(
    () => [driveIntegration, ...integrations],
    [driveIntegration, integrations],
  );

  const driveConnectLoading = driveAuthUrlMutation.isPending;
  const driveRefreshLoading = driveRefreshMutation.isPending;
  const driveDisconnectLoading = driveDisconnectMutation.isPending;

  const handleDriveConnectClick = () => {
    if (!currentOrgId) {
      toast({
        title: "Organisation requise",
        description: "Sélectionnez une organisation avant d'activer Google Drive.",
        variant: "destructive",
      });
      return;
    }

    void (async () => {
      try {
        const stateToken = createDriveStateToken();
        if (typeof window !== "undefined") {
          sessionStorage.setItem(
            buildDriveAuthStateKey(stateToken),
            JSON.stringify({ orgId: currentOrgId }),
          );
        }
        const { url } = await driveAuthUrlMutation.mutateAsync({
          orgId: currentOrgId,
          state: stateToken,
        });
        if (typeof window !== "undefined") {
          window.location.href = url;
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Impossible de démarrer l'authentification Google Drive.";
        toast({
          title: "Connexion Google Drive",
          description: message,
          variant: "destructive",
        });
      }
    })();
  };

  const handleDriveRefreshClick = () => {
    if (!currentOrgId) {
      toast({
        title: "Organisation requise",
        description: "Impossible d'actualiser le token sans organisation active.",
        variant: "destructive",
      });
      return;
    }

    void driveRefreshMutation
      .mutateAsync(currentOrgId)
      .then((summary) => {
        const expiry = formatRelativeExpiry(summary.expiresAt);
        toast({
          title: "Jeton Google Drive actualisé",
          description:
            expiry ?? "Le token d'accès Google Drive a été renouvelé avec succès.",
        });
      })
      .catch((error) => {
        const message =
          error instanceof Error
            ? error.message
            : "Le renouvellement du token Google Drive a échoué.";
        toast({
          title: "Actualisation impossible",
          description: message,
          variant: "destructive",
        });
      });
  };

  const handleDriveDisconnectClick = () => {
    if (!currentOrgId) {
      toast({
        title: "Organisation requise",
        description: "Sélectionnez une organisation avant de déconnecter Drive.",
        variant: "destructive",
      });
      return;
    }

    void driveDisconnectMutation
      .mutateAsync(currentOrgId)
      .then(() => {
        toast({
          title: "Google Drive déconnecté",
          description: "Les identifiants ont été supprimés pour cette organisation.",
        });
      })
      .catch((error) => {
        const message =
          error instanceof Error
            ? error.message
            : "Impossible de déconnecter l'intégration Google Drive.";
        toast({
          title: "Erreur lors de la déconnexion",
          description: message,
          variant: "destructive",
        });
      });
  };

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    setProjectStatuses(syncedProjectStatuses);
  }, [syncedProjectStatuses]);

  useEffect(() => {
    setBuildingTypes(syncedBuildingTypes);
  }, [syncedBuildingTypes]);

  useEffect(() => {
    setBuildingUsages(syncedBuildingUsages);
  }, [syncedBuildingUsages]);

  const fetchTeamMembers = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!isMounted.current) return false;

      if (!user) {
        if (isMounted.current) {
          setTeamMembers([]);
          setMemberError(null);
          setLoadingMembers(false);
        }
        return false;
      }

      if (!options?.silent && isMounted.current) setLoadingMembers(true);

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, role, user_id, updated_at, created_at")
          .order("full_name", { ascending: true });

        if (error) throw error;
        if (!isMounted.current) return false;

        const members = (data ?? []).map((p) => mapProfileToMember(p as ProfileRecord));
        setTeamMembers(members);
        setMemberError(null);
        return true;
      } catch (err) {
        console.error("Erreur lors du chargement des membres", err);
        if (isMounted.current) {
          setMemberError("Impossible de charger les membres depuis Supabase.");
          if (!options?.silent) {
            toast({
              variant: "destructive",
              title: "Erreur lors du chargement des utilisateurs",
              description: "Veuillez réessayer dans quelques instants.",
            });
          }
        }
        return false;
      } finally {
        if (!options?.silent && isMounted.current) setLoadingMembers(false);
      }
    },
    [toast, user]
  );

  useEffect(() => {
    if (!user) {
      setLoadingMembers(false);
      return;
    }

    void fetchTeamMembers();

    const channel = supabase
      .channel("public:profiles_settings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          void fetchTeamMembers({ silent: true });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchTeamMembers]);

  const formatIdentifier = useCallback((identifier: string) => {
    if (identifier.length <= 12) return identifier;
    return `${identifier.slice(0, 8)}…${identifier.slice(-4)}`;
  }, []);

  const activeMembers = useMemo(
    () => teamMembers.filter((member) => member.active).length,
    [teamMembers]
  );

  const handleRoleChange = async (id: string, role: RoleOption) => {
    const previousMembers = teamMembers.map((m) => ({ ...m }));
    setTeamMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)));

    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    if (error) {
      console.error("Erreur lors de la mise à jour du rôle", error);
      setTeamMembers(previousMembers);
      toast({
        variant: "destructive",
        title: "Impossible de mettre à jour le rôle",
        description: "Supabase n'a pas accepté la modification. Réessayez plus tard.",
      });
      return;
    }

    toast({
      title: "Rôle mis à jour",
      description: "Le profil Supabase a été synchronisé.",
    });

    void fetchTeamMembers({ silent: true });
  };

  const handleManualRefresh = async () => {
    const success = await fetchTeamMembers();
    if (success) {
      toast({
        title: "Membres synchronisés",
        description: "La liste a été mise à jour avec les dernières données Supabase.",
      });
    }
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
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveNotifications = () => {
    toast({
      title: "Préférences sauvegardées",
      description: "Les notifications seront appliquées pour toute l'équipe.",
    });
  };

  const handleIntegrationAction = (integration: Integration) => {
    if (integration.id === "google-drive") {
      return;
    }

    setIntegrations((prev) =>
      prev.map((item) =>
        item.id === integration.id
          ? {
              ...item,
              status: item.status === "connected" ? "disconnected" : "connected",
              lastSync:
                item.status === "connected"
                  ? "Connexion interrompue"
                  : "Synchronisation programmée",
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

  const renderTeamMembers = () => {
    if (loadingMembers) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-[116px] rounded-2xl border border-dashed border-border/60 bg-muted/20"
            />
          ))}
        </div>
      );
    }

    if (memberError) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-center text-sm text-destructive">
          <AlertCircle className="h-6 w-6" />
          <p>{memberError}</p>
          <Button size="sm" variant="outline" onClick={() => void fetchTeamMembers()}>
            Réessayer
          </Button>
        </div>
      );
    }

    if (teamMembers.length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-background/40 p-6 text-center text-sm text-muted-foreground">
          <Users className="h-6 w-6 text-muted-foreground" />
          <p>Aucun collaborateur trouvé dans Supabase.</p>
          <Button variant="secondary" size="sm" onClick={handleInviteMember}>
            Inviter votre premier membre
          </Button>
        </div>
      );
    }

    return teamMembers.map((member) => (
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
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">{member.name}</p>
              <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                ID {formatIdentifier(member.identifier)}
              </Badge>
              {!member.active && (
                <Badge variant="destructive" className="text-xs font-normal">
                  Désactivé
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {member.email ?? "Email non renseigné"}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {member.phone ?? "Téléphone non renseigné"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
          <div className="space-y-1">
            <Label
              htmlFor={`role-${member.id}`}
              className="text-xs uppercase tracking-wide text-muted-foreground"
            >
              Rôle
            </Label>
            <Select
              value={member.role}
              onValueChange={(value: RoleOption) => {
                void handleRoleChange(member.id, value);
              }}
            >
              <SelectTrigger id={`role-${member.id}`} className="w-[180px]">
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Dernière activité
            </Label>
            <p className="text-sm text-foreground">{member.lastConnection}</p>
          </div>
          <div className="flex items-center gap-3">
            <Label
              htmlFor={`active-${member.id}`}
              className="text-sm text-muted-foreground"
              title="Statut synchronisé automatiquement depuis Supabase"
            >
              {member.active ? "Actif" : "Inactif"}
            </Label>
            <Switch id={`active-${member.id}`} checked={member.active} disabled />
          </div>
        </div>
      </div>
    ));
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

  const isDefaultProjectStatuses = useMemo(() => {
    if (projectStatuses.length !== DEFAULT_PROJECT_STATUSES.length) {
      return false;
    }

    const sortedCurrent = [...projectStatuses].sort((a, b) =>
      a.value.localeCompare(b.value),
    );
    const sortedDefaults = [...DEFAULT_PROJECT_STATUSES].sort((a, b) =>
      a.value.localeCompare(b.value),
    );

    return sortedCurrent.every((status, index) => {
      const reference = sortedDefaults[index];
      return (
        status.value === reference.value &&
        status.label === reference.label &&
        status.color.toUpperCase() === reference.color.toUpperCase()
      );
    });
  }, [projectStatuses]);

  const isDefaultBuildingTypes = useMemo(() => {
    if (buildingTypes.length !== DEFAULT_BUILDING_TYPES.length) {
      return false;
    }

    return buildingTypes.every(
      (type, index) => type === DEFAULT_BUILDING_TYPES[index],
    );
  }, [buildingTypes]);

  const isDefaultBuildingUsages = useMemo(() => {
    if (buildingUsages.length !== DEFAULT_BUILDING_USAGES.length) {
      return false;
    }

    return buildingUsages.every(
      (usage, index) => usage === DEFAULT_BUILDING_USAGES[index],
    );
  }, [buildingUsages]);

  const persistProjectStatuses = useCallback(
    (
      updater: (prev: ProjectStatusSetting[]) => ProjectStatusSetting[],
      toastOptions?: { title: string; description?: string },
    ) => {
      let sanitizedResult: ProjectStatusSetting[] = [];
      setProjectStatuses((prev) => {
        const next = updater(prev);
        sanitizedResult = saveProjectStatuses(next);
        return sanitizedResult;
      });

      if (toastOptions) {
        toast(toastOptions);
      }

      return sanitizedResult;
    },
    [toast],
  );

  const persistBuildingTypes = useCallback(
    (updater: (prev: string[]) => string[], toastOptions?: { title: string; description?: string }) => {
      let sanitizedResult: string[] = [];
      setBuildingTypes((prev) => {
        const next = updater(prev);
        sanitizedResult = saveProjectBuildingTypes(next);
        return sanitizedResult;
      });

      if (toastOptions) {
        toast(toastOptions);
      }

      return sanitizedResult;
    },
    [toast],
  );

  const persistBuildingUsages = useCallback(
    (updater: (prev: string[]) => string[], toastOptions?: { title: string; description?: string }) => {
      let sanitizedResult: string[] = [];
      setBuildingUsages((prev) => {
        const next = updater(prev);
        sanitizedResult = saveProjectUsages(next);
        return sanitizedResult;
      });

      if (toastOptions) {
        toast(toastOptions);
      }

      return sanitizedResult;
    },
    [toast],
  );

  const handleStatusLabelChange = useCallback(
    (id: string, label: string) => {
      persistProjectStatuses((prev) =>
        prev.map((status) => (status.id === id ? { ...status, label } : status)),
      );
    },
    [persistProjectStatuses],
  );

  const handleStatusValueChange = useCallback(
    (id: string, value: string) => {
      persistProjectStatuses((prev) =>
        prev.map((status) => (status.id === id ? { ...status, value } : status)),
      );
    },
    [persistProjectStatuses],
  );

  const handleStatusColorChange = useCallback(
    (id: string, color: string) => {
      persistProjectStatuses((prev) =>
        prev.map((status) => (status.id === id ? { ...status, color } : status)),
      );
    },
    [persistProjectStatuses],
  );

  const handleAddStatus = useCallback(() => {
    persistProjectStatuses(
      (prev) => [
        ...prev,
        {
          id: `custom-${Date.now()}`,
          value: `NOUVEAU_STATUT_${prev.length + 1}`,
          label: `Nouveau statut ${prev.length + 1}`,
          color: DEFAULT_PROJECT_STATUSES[0]?.color ?? "#6B7280",
        },
      ],
      {
        title: "Statut ajouté",
        description: "Personnalisez le libellé et la couleur pour l'utiliser immédiatement.",
      },
    );
  }, [persistProjectStatuses]);

  const handleRemoveStatus = useCallback(
    (id: string) => {
      if (projectStatuses.length <= 1) {
        toast({
          variant: "destructive",
          title: "Au moins un statut requis",
          description: "Ajoutez un nouveau statut avant de supprimer celui-ci.",
        });
        return;
      }

      persistProjectStatuses(
        (prev) => prev.filter((status) => status.id !== id),
        {
          title: "Statut supprimé",
          description: "Le statut ne sera plus proposé dans les projets.",
        },
      );
    },
    [persistProjectStatuses, projectStatuses.length, toast],
  );

  const handleResetStatuses = useCallback(() => {
    const sanitized = resetProjectStatuses();
    setProjectStatuses(sanitized);
    toast({
      title: "Statuts réinitialisés",
      description: "Retour aux statuts standards d'EcoProRenov.",
    });
  }, [toast]);

  const handleBuildingTypeChange = useCallback(
    (index: number, value: string) => {
      persistBuildingTypes((prev) =>
        prev.map((type, currentIndex) => (currentIndex === index ? value : type)),
      );
    },
    [persistBuildingTypes],
  );

  const handleAddBuildingType = useCallback(() => {
    persistBuildingTypes(
      (prev) => [...prev, `Nouveau type ${prev.length + 1}`],
      {
        title: "Type de bâtiment ajouté",
        description: "Modifiez le libellé pour l'utiliser immédiatement.",
      },
    );
  }, [persistBuildingTypes]);

  const handleRemoveBuildingType = useCallback(
    (index: number) => {
      if (buildingTypes.length <= 1) {
        toast({
          variant: "destructive",
          title: "Au moins un type requis",
          description: "Ajoutez un nouveau type avant de supprimer celui-ci.",
        });
        return;
      }

      persistBuildingTypes(
        (prev) => prev.filter((_, currentIndex) => currentIndex !== index),
        {
          title: "Type de bâtiment supprimé",
          description: "Ce type ne sera plus proposé dans les projets.",
        },
      );
    },
    [buildingTypes.length, persistBuildingTypes, toast],
  );

  const handleResetBuildingTypes = useCallback(() => {
    const sanitized = resetProjectBuildingTypes();
    setBuildingTypes(sanitized);
    toast({
      title: "Types de bâtiment réinitialisés",
      description: "Retour à la liste standard proposée par EcoProRenov.",
    });
  }, [toast]);

  const handleUsageChange = useCallback(
    (index: number, value: string) => {
      persistBuildingUsages((prev) =>
        prev.map((usage, currentIndex) => (currentIndex === index ? value : usage)),
      );
    },
    [persistBuildingUsages],
  );

  const handleAddUsage = useCallback(() => {
    persistBuildingUsages(
      (prev) => [...prev, `Nouvel usage ${prev.length + 1}`],
      {
        title: "Usage ajouté",
        description: "Personnalisez le libellé pour qu'il apparaisse dans les formulaires.",
      },
    );
  }, [persistBuildingUsages]);

  const handleRemoveUsage = useCallback(
    (index: number) => {
      if (buildingUsages.length <= 1) {
        toast({
          variant: "destructive",
          title: "Au moins un usage requis",
          description: "Ajoutez un nouvel usage avant de supprimer celui-ci.",
        });
        return;
      }

      persistBuildingUsages(
        (prev) => prev.filter((_, currentIndex) => currentIndex !== index),
        {
          title: "Usage supprimé",
          description: "Cet usage ne sera plus proposé lors de la création d'un projet.",
        },
      );
    },
    [buildingUsages.length, persistBuildingUsages, toast],
  );

  const handleResetUsages = useCallback(() => {
    const sanitized = resetProjectUsages();
    setBuildingUsages(sanitized);
    toast({
      title: "Usages réinitialisés",
      description: "Retour aux usages standards proposés par EcoProRenov.",
    });
  }, [toast]);

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
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleManualRefresh}
                    disabled={loadingMembers}
                    className="h-9 w-9 border-border/60"
                    aria-label="Rafraîchir la liste des membres"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingMembers ? "animate-spin" : ""}`} />
                  </Button>
                  <Button onClick={handleInviteMember} variant="secondary">
                    Inviter un membre
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">{renderTeamMembers()}</CardContent>
            </Card>

            <Card className="border border-border/60 bg-card/70 shadow-sm">
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                    <Palette className="h-5 w-5 text-primary" />
                    Statuts des projets
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Personnalisez les libellés et les couleurs utilisés sur l&apos;ensemble du tableau de bord.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetStatuses}
                    disabled={isDefaultProjectStatuses}
                  >
                    Réinitialiser
                  </Button>
                  <Button size="sm" variant="secondary" className="gap-2" onClick={handleAddStatus}>
                    <Plus className="h-4 w-4" />
                    Ajouter un statut
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {projectStatuses.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 p-6 text-center text-sm text-muted-foreground">
                    Aucun statut n&apos;est configuré. Ajoutez un statut pour commencer.
                  </div>
                ) : (
                  projectStatuses.map((status) => {
                    const badgeStyle = getProjectStatusBadgeStyle(status.color);
                    return (
                      <div
                        key={status.id}
                        className="space-y-4 rounded-2xl border border-border/60 bg-background/60 p-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" style={badgeStyle} className="px-3 py-1">
                              {status.label || status.value}
                            </Badge>
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {status.value}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveStatus(status.id)}
                            disabled={projectStatuses.length <= 1}
                            aria-label={`Supprimer le statut ${status.label || status.value}`}
                            className="h-9 w-9 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <div className="space-y-2">
                            <Label>Nom affiché</Label>
                            <Input
                              value={status.label}
                              placeholder="Nom du statut"
                              onChange={(event) => handleStatusLabelChange(status.id, event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Code interne</Label>
                            <Input
                              value={status.value}
                              onChange={(event) => handleStatusValueChange(status.id, event.target.value)}
                              placeholder="PROSPECTION"
                            />
                            <p className="text-xs text-muted-foreground">
                              Identifiant synchronisé avec vos exports et intégrations.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Couleur du badge</Label>
                            <div className="flex items-center gap-3">
                              <input
                                type="color"
                                value={status.color}
                                onChange={(event) => handleStatusColorChange(status.id, event.target.value)}
                                className="h-10 w-16 cursor-pointer rounded-md border border-border/60 bg-background p-1"
                                aria-label={`Couleur du statut ${status.label || status.value}`}
                              />
                              <span className="text-sm text-muted-foreground">{status.color}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground">
                  Les modifications sont appliquées instantanément aux listes, aux filtres et aux formulaires de création
                  de projet.
                </div>
              </CardContent>
            </Card>

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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetBuildingTypes}
                        disabled={isDefaultBuildingTypes}
                      >
                        Réinitialiser
                      </Button>
                      <Button size="sm" variant="secondary" className="gap-2" onClick={handleAddBuildingType}>
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
                            onChange={(event) => handleBuildingTypeChange(index, event.target.value)}
                            placeholder="Type de bâtiment"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveBuildingType(index)}
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetUsages}
                        disabled={isDefaultBuildingUsages}
                      >
                        Réinitialiser
                      </Button>
                      <Button size="sm" variant="secondary" className="gap-2" onClick={handleAddUsage}>
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
                            onChange={(event) => handleUsageChange(index, event.target.value)}
                            placeholder="Usage"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveUsage(index)}
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
                        onChange={(e) => setCompanyInfo((p) => ({ ...p, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-legal">Raison sociale</Label>
                      <Input
                        id="company-legal"
                        value={companyInfo.legalName}
                        onChange={(e) => setCompanyInfo((p) => ({ ...p, legalName: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-registration">Enregistrement</Label>
                      <Input
                        id="company-registration"
                        value={companyInfo.registration}
                        onChange={(e) =>
                          setCompanyInfo((p) => ({ ...p, registration: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-phone">Téléphone</Label>
                      <Input
                        id="company-phone"
                        value={companyInfo.phone}
                        onChange={(e) => setCompanyInfo((p) => ({ ...p, phone: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-email">Email principal</Label>
                      <Input
                        id="company-email"
                        type="email"
                        value={companyInfo.email}
                        onChange={(e) => setCompanyInfo((p) => ({ ...p, email: e.target.value }))}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="company-address">Adresse</Label>
                      <AddressAutocomplete
                        value={companyInfo.address}
                        onChange={(address, city, postalCode) =>
                          setCompanyInfo((p) => ({
                            ...p,
                            address,
                            city,
                            postalCode,
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 md:col-span-2">
                      <div className="space-y-2">
                        <Label htmlFor="company-city">Ville</Label>
                        <Input
                          id="company-city"
                          value={companyInfo.city}
                          readOnly
                          placeholder="Sélectionnez une adresse"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company-postal">Code postal</Label>
                        <Input
                          id="company-postal"
                          value={companyInfo.postalCode}
                          readOnly
                          placeholder="Sélectionnez une adresse"
                        />
                      </div>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="company-description">Description publique</Label>
                      <Textarea
                        id="company-description"
                        value={companyInfo.description}
                        onChange={(e) =>
                          setCompanyInfo((p) => ({ ...p, description: e.target.value }))
                        }
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
                  {[
                    {
                      key: "commercialEmails" as const,
                      title: "Suivi commercial",
                      description:
                        "Alertes sur les nouveaux leads, rappels de relance et devis en attente.",
                    },
                    {
                      key: "operationalEmails" as const,
                      title: "Opérations & chantiers",
                      description:
                        "Notifications de planification, pointages d'équipes et suivi de chantier.",
                    },
                    {
                      key: "smsReminders" as const,
                      title: "SMS automatiques",
                      description:
                        "Rappels de rendez-vous clients et confirmations d'interventions.",
                    },
                    {
                      key: "pushNotifications" as const,
                      title: "Notifications mobiles",
                      description:
                        "Alertes en temps réel sur mobile pour les demandes critiques.",
                    },
                    {
                      key: "weeklyDigest" as const,
                      title: "Rapport hebdomadaire",
                      description:
                        "Synthèse des indicateurs clés envoyée chaque lundi matin.",
                    },
                  ].map((item) => (
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
                {displayedIntegrations.map((integration) => {
                  const isDrive = integration.id === "google-drive";
                  const badgeLabel = isDrive && driveConnectionLoading
                    ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Vérification
                        </span>
                      )
                    : integration.status === "connected"
                    ? "Connecté"
                    : integration.status === "pending"
                    ? "En attente"
                    : "Déconnecté";

                  return (
                    <div
                      key={integration.id}
                      className="space-y-3 rounded-2xl border border-border/60 bg-background/60 p-4"
                    >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{integration.name}</p>
                          <Badge
                            className={integrationStatusStyles[integration.status]}
                            variant="outline"
                          >
                            {badgeLabel}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{integration.description}</p>
                      </div>
                      {isDrive ? (
                        <div className="flex flex-col gap-2 md:items-end">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant={driveConnection?.connected ? "outline" : "secondary"}
                              onClick={() =>
                                driveConnection?.connected
                                  ? handleDriveRefreshClick()
                                  : handleDriveConnectClick()
                              }
                              disabled={
                                driveConnectLoading ||
                                driveRefreshLoading ||
                                (!currentOrgId && !driveConnection?.connected)
                              }
                              className="gap-2"
                            >
                              {driveConnectLoading || driveRefreshLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : driveConnection?.connected ? (
                                <RefreshCw className="h-4 w-4" />
                              ) : (
                                <Plug className="h-4 w-4" />
                              )}
                              {driveConnection?.connected ? "Actualiser l'accès" : "Connecter"}
                            </Button>
                            {driveConnection?.connected ? (
                              <Button
                                variant="ghost"
                                onClick={handleDriveDisconnectClick}
                                disabled={driveDisconnectLoading}
                                className="gap-2"
                              >
                                {driveDisconnectLoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                                Déconnecter
                              </Button>
                            ) : null}
                          </div>
                          {driveConnection?.rootFolderId ? (
                            <p className="text-xs text-muted-foreground">
                              Dossier racine : {driveConnection.rootFolderId}
                            </p>
                          ) : null}
                          {driveConnection?.sharedDriveId ? (
                            <p className="text-xs text-muted-foreground">
                              Drive partagé : {driveConnection.sharedDriveId}
                            </p>
                          ) : null}
                          {driveErrorMessage ? (
                            <p className="flex items-center gap-2 text-xs text-destructive">
                              <AlertCircle className="h-3.5 w-3.5" />
                              {driveErrorMessage}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <Button
                          variant={integration.status === "connected" ? "ghost" : "secondary"}
                          onClick={() => handleIntegrationAction(integration)}
                          className="gap-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                          {integration.status === "connected" ? "Désactiver" : "Connecter"}
                        </Button>
                      )}
                    </div>
                    <Separator className="bg-border/60" />
                    <p className="text-xs text-muted-foreground">
                      Dernière synchronisation : {integration.lastSync}
                    </p>
                  </div>
                );
                })}
                <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground">
                  Besoin d&apos;une intégration personnalisée ? Contactez notre équipe pour accéder à l&apos;API et aux
                  webhooks sécurisés.
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
                  {[
                    {
                      key: "twoFactor" as const,
                      title: "Double authentification",
                      description:
                        "Obliger l&apos;activation de la double authentification pour tous les comptes.",
                      icon: KeyRound,
                    },
                    {
                      key: "passwordRotation" as const,
                      title: "Rotation des mots de passe",
                      description: "Demander un renouvellement de mot de passe tous les 90 jours.",
                      icon: RefreshCw,
                    },
                    {
                      key: "loginAlerts" as const,
                      title: "Alertes de connexion",
                      description:
                        "Notifier l&apos;équipe sécurité des connexions depuis de nouveaux appareils.",
                      icon: MonitorSmartphone,
                    },
                  ].map((setting) => (
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
                    <Select
                      value={securitySettings.sessionDuration}
                      onValueChange={handleSessionDurationChange}
                    >
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
                          <Badge
                            variant="outline"
                            className="border-emerald-200/60 bg-emerald-500/10 text-emerald-700"
                          >
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
