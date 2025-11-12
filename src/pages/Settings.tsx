import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/features/organizations/OrgContext";
import { useMembers } from "@/features/members/api";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";
import { useProjectBuildingTypes } from "@/hooks/useProjectBuildingTypes";
import { useProjectUsages } from "@/hooks/useProjectUsages";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables } from "@/integrations/supabase/types";
import type { PostgrestError } from "@supabase/supabase-js";
import { formatDistanceToNow, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Settings as SettingsIcon,
  Settings2,
  Users,
  FileText,
  Cloud,
  Calendar,
  Target,
  Palette,
  List,
  Building2,
  Bell,
  Plug,
  ShieldCheck,
} from "lucide-react";
import {
  DEFAULT_PROJECT_STATUSES,
  getProjectStatusSettings,
  PROJECT_STATUS_UPDATED_EVENT,
  saveProjectStatuses,
  sanitizeProjectStatuses,
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
  useDriveSettingsUpdate,
  encodeDriveAuthStatePayload,
  createDriveStateToken,
  storeDriveAuthState,
} from "@/integrations/googleDrive";
import { LeadSettingsPanel } from "@/features/settings/LeadSettingsPanel";
import { QuoteSettingsPanel } from "@/features/settings/QuoteSettingsPanel";
import { SubcontractorSettingsPanel } from "@/features/settings/SubcontractorSettingsPanel";
import { AppointmentSettingsPanel } from "@/features/settings/AppointmentSettingsPanel";
import { KpiSettingsPanel } from "@/features/settings/KpiSettingsPanel";
import { BackupSettingsPanel } from "@/features/settings/BackupSettingsPanel";
import {
  ROLE_OPTIONS,
  type RoleOption,
  type BusinessLocation,
  type TeamMember,
  type Integration,
  type CompanyInfo,
  type Delegataire,
  type NotificationSettings,
  type SecuritySettings,
} from "@/features/settings/general/types";
import { TeamManagementCard } from "@/features/settings/general/TeamManagementCard";
import { ProjectStatusesCard } from "@/features/settings/general/ProjectStatusesCard";
import { BuildingReferenceCard } from "@/features/settings/general/BuildingReferenceCard";
import { CompanyInformationCard } from "@/features/settings/general/CompanyInformationCard";
import { NotificationPreferencesCard } from "@/features/settings/general/NotificationPreferencesCard";
import { IntegrationsCard } from "@/features/settings/general/IntegrationsCard";
import { SecuritySettingsCard } from "@/features/settings/general/SecuritySettingsCard";
import { GeneralOverviewCard } from "@/features/settings/general/GeneralOverviewCard";

const SETTINGS_TABLE = "settings" as keyof Database["public"]["Tables"];

const BUSINESS_LOCATIONS: { value: BusinessLocation; label: string; description: string }[] = [
  {
    value: "metropole",
    label: "France métropolitaine",
    description: "Inclut la Corse et les DROM rattachés à la métropole.",
  },
  {
    value: "guadeloupe",
    label: "Guadeloupe",
    description: "Paramètres spécifiques aux opérations réalisées en Guadeloupe.",
  },
  {
    value: "martinique",
    label: "Martinique",
    description: "Paramètres spécifiques aux opérations réalisées en Martinique.",
  },
  {
    value: "guyane",
    label: "Guyane",
    description: "Paramètres spécifiques aux opérations réalisées en Guyane.",
  },
  {
    value: "reunion",
    label: "La Réunion",
    description: "Paramètres spécifiques aux opérations réalisées à La Réunion.",
  },
  {
    value: "mayotte",
    label: "Mayotte",
    description: "Paramètres spécifiques aux opérations réalisées à Mayotte.",
  },
];

const DEFAULT_BUSINESS_LOCATION =
  BUSINESS_LOCATIONS[0]?.value ?? ("metropole" as BusinessLocation);

type ProfileRecord = Tables<"profiles">;

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

const generateDelegataireId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 11);
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

type GeneralTab =
  | "overview"
  | "team"
  | "statuses"
  | "catalog"
  | "company"
  | "notifications"
  | "integrations"
  | "security";

const GENERAL_TABS: Array<{ id: GeneralTab; label: string; icon: typeof Users }> = [
  { id: "overview", label: "Résumé", icon: SettingsIcon },
  { id: "team", label: "Équipe", icon: Users },
  { id: "statuses", label: "Statuts", icon: Palette },
  { id: "catalog", label: "Référentiel", icon: List },
  { id: "company", label: "Entreprise", icon: Building2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "integrations", label: "Intégrations", icon: Plug },
  { id: "security", label: "Sécurité", icon: ShieldCheck },
];

type SettingsSection =
  | "general"
  | "lead"
  | "quotes"
  | "subcontractors"
  | "calendar"
  | "kpi"
  | "backups";

const SETTINGS_SECTIONS: Array<{
  id: SettingsSection;
  label: string;
  icon: typeof SettingsIcon;
}> = [
  { id: "general", label: "Paramètres généraux", icon: SettingsIcon },
  { id: "lead", label: "Paramètres Lead", icon: Settings2 },
  { id: "quotes", label: "Paramètres Devis", icon: FileText },
  { id: "subcontractors", label: "Paramètres sous-traitant", icon: Users },
  { id: "kpi", label: "Paramètres KPI", icon: Target },
  { id: "calendar", label: "Types de RDV", icon: Calendar },
  { id: "backups", label: "Sauvegardes", icon: Cloud },
];

export default function Settings() {
  const { toast } = useToast();
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentOrgId } = useOrg();
  const { data: members = [] } = useMembers(currentOrgId);

  const currentMember = useMemo(
    () => members.find((member) => member.user_id === user?.id) ?? null,
    [members, user?.id],
  );

  const isAdmin = currentMember?.role === "owner" || currentMember?.role === "admin";

  const availableSections = useMemo(
    () =>
      SETTINGS_SECTIONS.filter((section) =>
        section.id === "kpi" ? isAdmin : true,
      ),
    [isAdmin],
  );

  const activeSection = useMemo<SettingsSection>(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get("section");
    const fallback = (availableSections[0]?.id ?? "general") as SettingsSection;

    if (section && availableSections.some(({ id }) => id === section)) {
      return section as SettingsSection;
    }

    return fallback;
  }, [location.search, availableSections]);

  const activeGeneralTab = useMemo<GeneralTab>(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("generalTab");

    if (tab && GENERAL_TABS.some(({ id }) => id === tab)) {
      return tab as GeneralTab;
    }

    return "overview";
  }, [location.search]);

  const handleSectionSelect = (section: SettingsSection) => {
    if (!availableSections.some(({ id }) => id === section)) {
      return;
    }

    const params = new URLSearchParams(location.search);
    if (section === "general") {
      params.delete("section");
    } else {
      params.set("section", section);
    }

    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : "",
      },
      { replace: true },
    );
  };

  const handleGeneralTabSelect = (tab: GeneralTab) => {
    if (!GENERAL_TABS.some(({ id }) => id === tab)) {
      return;
    }

    const params = new URLSearchParams(location.search);
    if (tab === "overview") {
      params.delete("generalTab");
    } else {
      params.set("generalTab", tab);
    }

    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : "",
      },
      { replace: true },
    );
  };
  const isMounted = useRef(true);

  const {
    data: driveConnection,
    isLoading: driveStatusLoading,
    isFetching: driveStatusFetching,
    error: driveStatusError,
  } = useDriveConnectionStatus(currentOrgId);
  const driveAuthUrlMutation = useDriveAuthUrl();
  const driveRefreshMutation = useDriveConnectionRefresh(session?.access_token);
  const driveDisconnectMutation = useDriveDisconnect(session?.access_token);
  const driveSettingsMutation = useDriveSettingsUpdate();

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [memberError, setMemberError] = useState<string | null>(null);

  const [driveClientId, setDriveClientId] = useState("");
  const [driveClientSecret, setDriveClientSecret] = useState("");
  const [driveRedirectUri, setDriveRedirectUri] = useState("");
  const [driveRootFolderId, setDriveRootFolderId] = useState("");
  const [driveSharedDriveId, setDriveSharedDriveId] = useState("");
  const [driveRootFolderTouched, setDriveRootFolderTouched] = useState(false);
  const [driveSharedDriveTouched, setDriveSharedDriveTouched] = useState(false);

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
  const [isManualCompanyAddress, setIsManualCompanyAddress] = useState(false);
  const [organizationPrimeSettings, setOrganizationPrimeSettings] = useState<{
    businessLocation: BusinessLocation;
    primeBonification: string;
  }>({
    businessLocation: DEFAULT_BUSINESS_LOCATION,
    primeBonification: "0",
  });
  const [loadingOrganizationSettings, setLoadingOrganizationSettings] = useState(false);
  const [savingOrganizationSettings, setSavingOrganizationSettings] = useState(false);

  const handleCompanyInfoChange = useCallback((changes: Partial<CompanyInfo>) => {
    setCompanyInfo((prev) => ({ ...prev, ...changes }));
  }, []);

  const handleCompanyAddressChange = useCallback(
    (
      address: string,
      city: string,
      postalCode: string,
      options?: { manual?: boolean },
    ) => {
      const isManual = options?.manual ?? false;
      setIsManualCompanyAddress(isManual);
      setCompanyInfo((prev) => ({
        ...prev,
        address,
        city,
        postalCode,
      }));
    },
    [],
  );

  const handleOrganizationPrimeChange = useCallback(
    (changes: Partial<{ businessLocation: BusinessLocation; primeBonification: string }>) => {
      setOrganizationPrimeSettings((prev) => ({ ...prev, ...changes }));
    },
    [],
  );

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
    let isCancelled = false;

    if (!currentOrgId) {
      setOrganizationPrimeSettings({
        businessLocation: DEFAULT_BUSINESS_LOCATION,
        primeBonification: "0",
      });
      setLoadingOrganizationSettings(false);
      return () => {
        isCancelled = true;
      };
    }

    setLoadingOrganizationSettings(true);

    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("organizations")
          .select("business_location, prime_bonification")
          .eq("id", currentOrgId)
          .single();

        if (isCancelled) return;

        if (error) {
          console.error("Erreur lors du chargement des paramètres organisationnels", error);
          toast({
            title: "Chargement impossible",
            description:
              "La localisation et la bonification de l'organisation n'ont pas pu être chargées.",
            variant: "destructive",
          });
          setOrganizationPrimeSettings({
            businessLocation: DEFAULT_BUSINESS_LOCATION,
            primeBonification: "0",
          });
          return;
        }

        const locationValue =
          (data?.business_location as BusinessLocation | null) ?? DEFAULT_BUSINESS_LOCATION;
        const bonusValue =
          typeof data?.prime_bonification === "number" &&
          Number.isFinite(data.prime_bonification)
            ? data.prime_bonification
            : 0;

        setOrganizationPrimeSettings({
          businessLocation: locationValue,
          primeBonification: String(bonusValue),
        });
      } finally {
        if (!isCancelled) {
          setLoadingOrganizationSettings(false);
        }
      }
    };

    fetchSettings();

    return () => {
      isCancelled = true;
    };
  }, [currentOrgId, toast]);

  useEffect(() => {
    if (!companyInfo.address) {
      setIsManualCompanyAddress(false);
      return;
    }

    if (!companyInfo.city || !companyInfo.postalCode) {
      setIsManualCompanyAddress(true);
    }
  }, [companyInfo.address, companyInfo.city, companyInfo.postalCode]);
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

  useEffect(() => {
    setDriveClientId("");
    setDriveClientSecret("");
    setDriveRedirectUri("");
    setDriveRootFolderId("");
    setDriveSharedDriveId("");
    setDriveRootFolderTouched(false);
    setDriveSharedDriveTouched(false);
  }, [currentOrgId]);

  useEffect(() => {
    if (!driveRootFolderTouched) {
      setDriveRootFolderId(driveConnection?.rootFolderId ?? "");
    }

    if (!driveSharedDriveTouched) {
      setDriveSharedDriveId(driveConnection?.sharedDriveId ?? "");
    }
  }, [
    driveConnection?.rootFolderId,
    driveConnection?.sharedDriveId,
    driveRootFolderTouched,
    driveSharedDriveTouched,
  ]);
  const {
    statuses: syncedProjectStatuses,
    isLoading: projectStatusesLoading,
    isFetching: projectStatusesFetching,
    error: projectStatusesError,
    refresh: refreshProjectStatuses,
  } = useProjectStatuses();
  const [projectStatuses, setProjectStatuses] = useState<ProjectStatusSetting[]>(() =>
    getProjectStatusSettings(),
  );
  const [savingProjectStatuses, setSavingProjectStatuses] = useState(false);
  const [delegataires, setDelegataires] = useState<Delegataire[]>([]);
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

  const connectedIntegrationsCount = useMemo(
    () => displayedIntegrations.filter((integration) => integration.status === "connected").length,
    [displayedIntegrations],
  );

  const driveConnectLoading = driveAuthUrlMutation.isPending;
  const driveRefreshLoading = driveRefreshMutation.isPending;
  const driveDisconnectLoading = driveDisconnectMutation.isPending;
  const driveSettingsSaving = driveSettingsMutation.isPending;

  const handleDriveSettingsSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!currentOrgId) {
        toast({
          title: "Organisation requise",
          description: "Sélectionnez une organisation avant de configurer Google Drive.",
          variant: "destructive",
        });
        return;
      }

      if (!session?.access_token) {
        toast({
          title: "Authentification requise",
          description: "Connectez-vous à nouveau pour modifier la configuration Drive.",
          variant: "destructive",
        });
        return;
      }

      const trimmedClientId = driveClientId.trim();
      const trimmedClientSecret = driveClientSecret.trim();
      const trimmedRedirectUri = driveRedirectUri.trim();
      const trimmedRootFolder = driveRootFolderId.trim();
      const trimmedSharedDrive = driveSharedDriveId.trim();

      if (!trimmedClientId || !trimmedClientSecret) {
        toast({
          title: "Champs requis",
          description: "Renseignez le client ID et le client secret Google Drive.",
          variant: "destructive",
        });
        return;
      }

      setDriveClientId(trimmedClientId);
      setDriveRedirectUri(trimmedRedirectUri);
      setDriveRootFolderId(trimmedRootFolder);
      setDriveSharedDriveId(trimmedSharedDrive);

      void driveSettingsMutation
        .mutateAsync({
          orgId: currentOrgId,
          clientId: trimmedClientId,
          clientSecret: trimmedClientSecret,
          redirectUri: trimmedRedirectUri || undefined,
          rootFolderId: trimmedRootFolder || undefined,
          sharedDriveId: trimmedSharedDrive || undefined,
          accessToken: session.access_token,
        })
        .then((summary) => {
          toast({
            title: "Configuration Google Drive enregistrée",
            description: "Les paramètres OAuth ont été mis à jour pour cette organisation.",
          });
          setDriveClientSecret("");
          setDriveRootFolderTouched(false);
          setDriveSharedDriveTouched(false);
          setDriveRootFolderId(summary.rootFolderId ?? "");
          setDriveSharedDriveId(summary.sharedDriveId ?? "");
        })
        .catch((error) => {
          const message =
            error instanceof Error
              ? error.message
              : "Impossible d'enregistrer les paramètres Google Drive.";
          toast({
            title: "Enregistrement impossible",
            description: message,
            variant: "destructive",
          });
        });
    },
    [
      currentOrgId,
      driveClientId,
      driveClientSecret,
      driveRedirectUri,
      driveRootFolderId,
      driveSettingsMutation,
      driveSharedDriveId,
      session?.access_token,
      toast,
    ],
  );

  const handleDriveClientIdChange = (value: string) => {
    setDriveClientId(value);
  };

  const handleDriveClientSecretChange = (value: string) => {
    setDriveClientSecret(value);
  };

  const handleDriveRedirectUriChange = (value: string) => {
    setDriveRedirectUri(value);
  };

  const handleDriveRootFolderChange = (value: string) => {
    setDriveRootFolderTouched(true);
    setDriveRootFolderId(value);
  };

  const handleDriveSharedDriveChange = (value: string) => {
    setDriveSharedDriveTouched(true);
    setDriveSharedDriveId(value);
  };

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
        const nonce = createDriveStateToken();
        const statePayload = encodeDriveAuthStatePayload({
          nonce,
          orgId: currentOrgId,
        });

        const { url, redirectUri } = await driveAuthUrlMutation.mutateAsync({
          orgId: currentOrgId,
          state: statePayload,
        });

        storeDriveAuthState(nonce, currentOrgId, redirectUri ?? undefined);

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

  const GeneralSection = () => {
    const catalogCount = buildingTypes.length + buildingUsages.length;

    return (
      <Tabs
        value={activeGeneralTab}
        onValueChange={(value) => handleGeneralTabSelect(value as GeneralTab)}
        className="space-y-6"
      >
        <TabsList className="flex w-full flex-wrap gap-2 overflow-x-auto rounded-xl bg-muted/40 p-1">
          {GENERAL_TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm data-[state=active]:bg-background/80"
            >
              <Icon className="h-4 w-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" className="space-y-6">
          <GeneralOverviewCard
            organizationName={companyInfo.name}
            totalMembers={teamMembers.length}
            activeMembers={activeMembers}
            statusCount={projectStatuses.length}
            catalogCount={catalogCount}
            connectedIntegrations={connectedIntegrationsCount}
            onSelectTab={handleGeneralTabSelect}
          />
        </TabsContent>
        <TabsContent value="team">
          <TeamManagementCard
            members={teamMembers}
            loading={loadingMembers}
            error={memberError}
            onRefresh={handleManualRefresh}
            onInvite={handleInviteMember}
            onRetry={() => {
              void fetchTeamMembers();
            }}
            onRoleChange={(id, role) => {
              void handleRoleChange(id, role);
            }}
            formatIdentifier={formatIdentifier}
          />
        </TabsContent>
        <TabsContent value="statuses">
          <ProjectStatusesCard
            statuses={projectStatuses}
            busy={projectStatusesBusy}
            disableReset={isDefaultProjectStatuses}
            onReset={handleResetStatuses}
            onAdd={handleAddStatus}
            onRemove={handleRemoveStatus}
            onLabelChange={handleStatusLabelChange}
            onValueChange={handleStatusValueChange}
            onColorChange={handleStatusColorChange}
          />
        </TabsContent>
        <TabsContent value="catalog">
          <BuildingReferenceCard
            buildingTypes={buildingTypes}
            buildingUsages={buildingUsages}
            disableResetTypes={isDefaultBuildingTypes}
            disableResetUsages={isDefaultBuildingUsages}
            onTypeChange={handleBuildingTypeChange}
            onAddType={handleAddBuildingType}
            onRemoveType={handleRemoveBuildingType}
            onResetTypes={handleResetBuildingTypes}
            onUsageChange={handleUsageChange}
            onAddUsage={handleAddUsage}
            onRemoveUsage={handleRemoveUsage}
            onResetUsages={handleResetUsages}
          />
        </TabsContent>
        <TabsContent value="company">
          <CompanyInformationCard
            companyInfo={companyInfo}
            isManualAddress={isManualCompanyAddress}
            onCompanyInfoChange={handleCompanyInfoChange}
            onCompanySubmit={handleCompanySubmit}
            businessLocations={BUSINESS_LOCATIONS}
            organizationPrimeSettings={organizationPrimeSettings}
            onOrganizationPrimeChange={handleOrganizationPrimeChange}
            loadingOrganizationSettings={loadingOrganizationSettings}
            savingOrganizationSettings={savingOrganizationSettings}
            onAddressChange={handleCompanyAddressChange}
            delegataires={delegataires}
            onAddDelegataire={handleAddDelegataire}
            onRemoveDelegataire={handleRemoveDelegataire}
            onDelegataireChange={handleDelegataireChange}
            onSaveDelegataires={handleSaveDelegataires}
          />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationPreferencesCard
            settings={notifications}
            onToggle={toggleNotification}
            onSave={handleSaveNotifications}
          />
        </TabsContent>
        <TabsContent value="integrations">
          <IntegrationsCard
            integrations={displayedIntegrations}
            driveConnection={driveConnection}
            driveConnectionLoading={driveConnectionLoading}
            driveErrorMessage={driveErrorMessage}
            isAdmin={Boolean(isAdmin)}
            hasActiveOrg={Boolean(currentOrgId)}
            driveClientId={driveClientId}
            driveClientSecret={driveClientSecret}
            driveRedirectUri={driveRedirectUri}
            driveRootFolderId={driveRootFolderId}
            driveSharedDriveId={driveSharedDriveId}
            onDriveClientIdChange={handleDriveClientIdChange}
            onDriveClientSecretChange={handleDriveClientSecretChange}
            onDriveRedirectUriChange={handleDriveRedirectUriChange}
            onDriveRootFolderChange={handleDriveRootFolderChange}
            onDriveSharedDriveChange={handleDriveSharedDriveChange}
            onDriveSettingsSubmit={handleDriveSettingsSubmit}
            driveSettingsSaving={driveSettingsSaving}
            driveConnectLoading={driveConnectLoading}
            driveRefreshLoading={driveRefreshLoading}
            driveDisconnectLoading={driveDisconnectLoading}
            onDriveConnect={handleDriveConnectClick}
            onDriveRefresh={handleDriveRefreshClick}
            onDriveDisconnect={handleDriveDisconnectClick}
            onIntegrationAction={handleIntegrationAction}
          />
        </TabsContent>
        <TabsContent value="security">
          <SecuritySettingsCard
            settings={securitySettings}
            onToggleSetting={handleSecuritySettingToggle}
            sessionOptions={sessionOptions}
            onSessionDurationChange={handleSessionDurationChange}
            activeSessions={activeSessions}
            onSave={handleSecuritySave}
          />
        </TabsContent>
      </Tabs>
    );
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

  const handleCompanySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentOrgId) {
      toast({
        title: "Organisation requise",
        description: "Sélectionnez une organisation avant de modifier ses paramètres.",
        variant: "destructive",
      });
      return;
    }

    setSavingOrganizationSettings(true);

    const normalizedValue = organizationPrimeSettings.primeBonification.replace(",", ".").trim();
    const parsedValue = Number.parseFloat(normalizedValue);
    const sanitizedPrimeBonification = Number.isFinite(parsedValue)
      ? Math.max(0, parsedValue)
      : 0;

    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          business_location: organizationPrimeSettings.businessLocation,
          prime_bonification: sanitizedPrimeBonification,
        })
        .eq("id", currentOrgId);

      if (error) {
        throw error;
      }

      setOrganizationPrimeSettings((prev) => ({
        ...prev,
        primeBonification: String(sanitizedPrimeBonification),
      }));

      toast({
        title: "Paramètres enregistrés",
        description: "La localisation et la bonification Prime CEE ont été mises à jour.",
      });

      void queryClient.invalidateQueries({ queryKey: ["organizations", user?.id] });
    } catch (error) {
      console.error("Erreur lors de l'enregistrement des paramètres organisationnels", error);
      toast({
        title: "Enregistrement impossible",
        description:
          "La mise à jour des paramètres Prime CEE de l'organisation a échoué. Réessayez plus tard.",
        variant: "destructive",
      });
    } finally {
      setSavingOrganizationSettings(false);
    }
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

  const handleSecuritySettingToggle = useCallback(
    (key: keyof SecuritySettings, value: boolean) => {
      setSecuritySettings((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

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

  useEffect(() => {
    if (!projectStatusesError) return;

    console.error("Erreur lors du chargement des statuts projets", projectStatusesError);
    toast({
      variant: "destructive",
      title: "Chargement des statuts impossible",
      description: "Les statuts projets n'ont pas pu être chargés depuis Supabase.",
    });
  }, [projectStatusesError, toast]);

  const persistProjectStatuses = useCallback(
    async (
      updater: (prev: ProjectStatusSetting[]) => ProjectStatusSetting[],
      toastOptions?: { title: string; description?: string },
    ) => {
      let previousStatuses: ProjectStatusSetting[] = [];
      let sanitizedResult: ProjectStatusSetting[] = [];

      setProjectStatuses((prev) => {
        previousStatuses = prev;
        const next = updater(prev);
        sanitizedResult = sanitizeProjectStatuses(next);
        return sanitizedResult;
      });

      if (!currentOrgId) {
        setProjectStatuses(previousStatuses);
        toast({
          variant: "destructive",
          title: "Organisation requise",
          description: "Sélectionnez une organisation avant de modifier les statuts projets.",
        });
        return previousStatuses;
      }

      try {
        setSavingProjectStatuses(true);
        const payload = {
          org_id: currentOrgId,
          statuts_projets: sanitizedResult,
          updated_at: new Date().toISOString(),
        };

        const { error } = (await supabase
          .from(SETTINGS_TABLE)
          .upsert(payload, { onConflict: "org_id" })
          .select("statuts_projets, backup_webhook_url, backup_daily_enabled, backup_time")
          .single()) as { error: PostgrestError | null };

        if (error) {
          throw error;
        }

        saveProjectStatuses(sanitizedResult);
        queryClient.setQueryData(["project-statuses", currentOrgId], sanitizedResult);
        window.dispatchEvent(new CustomEvent(PROJECT_STATUS_UPDATED_EVENT));
        await refreshProjectStatuses();

        if (toastOptions) {
          toast(toastOptions);
        }

        return sanitizedResult;
      } catch (error) {
        console.error("Erreur lors de l'enregistrement des statuts projets", error);
        setProjectStatuses(previousStatuses);
        saveProjectStatuses(previousStatuses);
        toast({
          variant: "destructive",
          title: "Enregistrement impossible",
          description:
            "Les statuts projets n'ont pas pu être sauvegardés. Veuillez réessayer dans quelques instants.",
        });
        await refreshProjectStatuses();
        return previousStatuses;
      } finally {
        setSavingProjectStatuses(false);
      }
    },
    [currentOrgId, queryClient, refreshProjectStatuses, toast],
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
      void persistProjectStatuses((prev) =>
        prev.map((status) => (status.id === id ? { ...status, label } : status)),
      );
    },
    [persistProjectStatuses],
  );

  const handleStatusValueChange = useCallback(
    (id: string, value: string) => {
      void persistProjectStatuses((prev) =>
        prev.map((status) => (status.id === id ? { ...status, value } : status)),
      );
    },
    [persistProjectStatuses],
  );

  const handleStatusColorChange = useCallback(
    (id: string, color: string) => {
      void persistProjectStatuses((prev) =>
        prev.map((status) => (status.id === id ? { ...status, color } : status)),
      );
    },
    [persistProjectStatuses],
  );

  const handleAddStatus = useCallback(() => {
    void persistProjectStatuses(
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

  const projectStatusesBusy = projectStatusesLoading || projectStatusesFetching || savingProjectStatuses;

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

      void persistProjectStatuses(
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
    void persistProjectStatuses(
      () => DEFAULT_PROJECT_STATUSES.map((status) => ({ ...status })),
      {
        title: "Statuts réinitialisés",
        description: "Retour aux statuts standards d'EcoProRenov.",
      },
    );
  }, [persistProjectStatuses]);

  const handleAddDelegataire = useCallback(() => {
    setDelegataires((prev) => [
      ...prev,
      {
        id: generateDelegataireId(),
        name: "",
        contactName: "",
        email: "",
        phone: "",
        textBlock: "",
        pricePerMwh: "",
      },
    ]);
  }, []);

  const handleRemoveDelegataire = useCallback((id: string) => {
    setDelegataires((prev) => prev.filter((delegataire) => delegataire.id !== id));
  }, []);

  const handleDelegataireChange = useCallback(
    (id: string, field: keyof Delegataire, value: string) => {
      setDelegataires((prev) =>
        prev.map((delegataire) =>
          delegataire.id === id ? { ...delegataire, [field]: value } : delegataire,
        ),
      );
    },
    [],
  );

  const handleSaveDelegataires = useCallback(() => {
    toast({
      title: "Délégataires sauvegardés",
      description: "Les informations seront utilisées lors de la génération des devis.",
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
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your account settings and preferences.
            </p>
          </div>

          <div className="mb-6 border-b border-border">
            <nav className="flex gap-6">
              {availableSections.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => handleSectionSelect(id)}
                  className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                    activeSection === id
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          <div className="space-y-6">
            {activeSection === "general" && <GeneralSection />}
            {activeSection === "lead" && <LeadSettingsPanel />}
            {activeSection === "quotes" && <QuoteSettingsPanel />}
            {activeSection === "subcontractors" && <SubcontractorSettingsPanel />}
            {activeSection === "kpi" && <KpiSettingsPanel />}
            {activeSection === "calendar" && <AppointmentSettingsPanel />}
            {activeSection === "backups" && <BackupSettingsPanel />}
          </div>
        </div>
      </div>
    </Layout>
  );
}
