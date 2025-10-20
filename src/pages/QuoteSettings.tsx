import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const QuoteSettings = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ pathname: "/settings", search: "?section=quotes" }, { replace: true });
  }, [navigate]);

  return null;
};

export default QuoteSettings;
