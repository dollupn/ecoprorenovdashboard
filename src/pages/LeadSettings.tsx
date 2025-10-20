import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const LeadSettings = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ pathname: "/settings", search: "?section=lead" }, { replace: true });
  }, [navigate]);

  return null;
};

export default LeadSettings;
