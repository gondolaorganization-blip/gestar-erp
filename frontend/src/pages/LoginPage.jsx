import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";

export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", form);
      localStorage.setItem("token", data.token);
      localStorage.setItem("usuario", JSON.stringify(data.usuario));
      localStorage.setItem("empresa", JSON.stringify(data.empresa));
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Credenciales incorrectas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(160deg, #0D1117 0%, #0F2744 50%, #0D1B2A 100%)",
      fontFamily: "'Syne', 'Outfit', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .login-input {
          width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; padding: 13px 16px; font-size: 14px; color: #E8EDFF;
          font-family: 'Syne', sans-serif; transition: border-color 0.2s; outline: none;
        }
        .login-input:focus { border-color: rgba(78,154,241,0.6); }
        .login-input::placeholder { color: #4B5675; }
        .login-btn {
          width: 100%; background: #4E9AF1; border: none; border-radius: 10px;
          padding: 14px; font-size: 15px; font-weight: 700; color: #fff;
          cursor: pointer; font-family: 'Syne', sans-serif; transition: background 0.18s;
        }
        .login-btn:hover:not(:disabled) { background: #3D7FD8; }
        .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      <div style={{
        background: "#111620", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 20, padding: "44px 40px", width: "100%", maxWidth: 420, margin: 16,
        boxShadow: "0 40px 100px rgba(0,0,0,0.5)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32, justifyContent: "center" }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #4E9AF1 0%, #00C896 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 900, color: "#fff",
          }}>G</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#E8EDFF" }}>GESTAR ERP</div>
            <div style={{ fontSize: 9, color: "#4E9AF1", letterSpacing: "0.12em", textTransform: "uppercase" }}>Panamá</div>
          </div>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#E8EDFF", marginBottom: 6, textAlign: "center" }}>
          Bienvenido de vuelta
        </h1>
        <p style={{ fontSize: 12, color: "#4B5675", textAlign: "center", marginBottom: 28 }}>
          Ingresa tus credenciales para acceder al sistema
        </p>

        {error && (
          <div style={{
            background: "#FF6B6B0A", border: "1px solid #FF6B6B33",
            borderRadius: 8, padding: "10px 14px", marginBottom: 20,
            fontSize: 12, color: "#FF6B6B",
          }}>
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, color: "#6B7A99", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Correo electrónico
            </label>
            <input
              className="login-input"
              type="email"
              placeholder="usuario@empresa.com"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: "#6B7A99", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Contraseña
            </label>
            <input
              className="login-input"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              required
            />
          </div>

          <div style={{ textAlign: "right", marginTop: -8 }}>
            <Link to="/recuperar-password" style={{ fontSize: 11, color: "#4B5675", textDecoration: "none" }}>
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <button className="login-btn" type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? "Verificando..." : "Ingresar →"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: "#4B5675" }}>
          ¿No tienes cuenta?{" "}
          <Link to="/registro" style={{ color: "#4E9AF1", textDecoration: "none", fontWeight: 600 }}>
            Crear cuenta →
          </Link>
        </p>
      </div>
    </div>
  );
}
