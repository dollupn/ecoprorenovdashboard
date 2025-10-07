import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Organization {
  id: string;
  name: string;
  siret?: string;
  tva?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  country?: string;
}

interface OrgContextType {
  currentOrgId: string | null;
  setCurrentOrgId: (id: string) => void;
  organizations: Organization[];
  currentOrg: Organization | null;
  isLoading: boolean;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export const OrgProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);

  // Fetch user's organizations
  const { data: organizations = [], isLoading } = useQuery({
    queryKey: ["organizations", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data: memberships, error } = await supabase
        .from("memberships")
        .select("org_id, organizations(*)")
        .eq("user_id", user.id);

      if (error) throw error;
      
      return memberships
        .map((m: any) => m.organizations)
        .filter(Boolean);
    },
    enabled: !!user,
  });

  // Set first organization as default
  useEffect(() => {
    if (organizations.length > 0 && !currentOrgId) {
      const savedOrgId = localStorage.getItem("currentOrgId");
      const validOrgId = organizations.find(org => org.id === savedOrgId);
      setCurrentOrgId(validOrgId ? savedOrgId : organizations[0].id);
    }
  }, [organizations, currentOrgId]);

  // Save to localStorage when changed
  useEffect(() => {
    if (currentOrgId) {
      localStorage.setItem("currentOrgId", currentOrgId);
    }
  }, [currentOrgId]);

  const currentOrg = organizations.find(org => org.id === currentOrgId) || null;

  return (
    <OrgContext.Provider
      value={{
        currentOrgId,
        setCurrentOrgId,
        organizations,
        currentOrg,
        isLoading,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
};

export const useOrg = () => {
  const context = useContext(OrgContext);
  if (context === undefined) {
    throw new Error("useOrg must be used within an OrgProvider");
  }
  return context;
};
