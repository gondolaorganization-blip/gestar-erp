import { useNavigate } from "react-router-dom";

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div style={{
      fontFamily: "system-ui, sans-serif", minHeight: "100vh",
      background: "#f7f8fc", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 72, fontWeight: 800, color: "#e0e4ef", lineHeight: 1 }}>404</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e", margin: "16px 0 8px" }}>
          Página no encontrada
        </div>
        <p style={{ color: "#888", fontSize: 14, maxWidth: 320, margin: "0 auto 28px" }}>
          La ruta que buscas no existe o fue movida. Vuelve al dashboard para continuar.
        </p>
        <button
          onClick={() => navigate("/dashboard")}
          style={{
            background: "#4E9AF1", color: "#fff", border: "none", borderRadius: 10,
            padding: "10px 28px", fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}
        >
          Ir al Dashboard
        </button>
      </div>
    </div>
  );
}
