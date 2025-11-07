import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/features/organizations/OrgContext";
import { useMembers } from "@/features/members/api";

const KpiSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrgId } = useOrg();
  const { data: members = [], isLoading } = useMembers(currentOrgId);

  const isAdmin = useMemo(() => {
    const currentMember = members.find((member) => member.user_id === user?.id);
    return currentMember?.role === "owner" || currentMember?.role === "admin";
  }, [members, user?.id]);

  useEffect(() => {
    if (isLoading) return;

    navigate(
      {
        pathname: "/settings",
        search: isAdmin ? "?section=kpi" : "",
      },
      { replace: true },
    );
  }, [navigate, isAdmin, isLoading]);

  return null;
};

export default KpiSettings;
