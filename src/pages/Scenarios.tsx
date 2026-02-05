import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Scenarios() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/practice", { replace: true });
  }, [navigate]);

  return null;
}
