import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AppointmentSettings = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ pathname: "/settings", search: "?section=calendar" }, { replace: true });
  }, [navigate]);

  return null;
};

export default AppointmentSettings;
