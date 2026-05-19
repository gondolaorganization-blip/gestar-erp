import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";

export default function ResetPasswordPage() {
  const [searchParams]       = useSearchParams();
  const navigate             = useNavigate();
  const token                = searchParams.get("token") ?? "";
  const [password, setPass]  = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]    = useState("");
  const [exito, setExito]    = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8)    return setError("La contraseña debe tener al menos 8 caracteres");
    if (password !== confirm)   return setError("Las contraseñas no coinciden");
    if (!token)                 return setError("Enlace inválido. Solicita uno nuevo.");
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setExito(true);
    } catch (err) {
      setError(err.response?.data?.error || "Error al actualizar la contraseña");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(160deg,#0D1117 0%,#0F2744 50%,#0D1B2A 100%)",
      fontFamily: "'Syne','Outfit',sans-serif", padding: 16,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .rp-input {
          width: 100%; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1);
          border-radius: 10px; padding: 12px 14px; font-size: 13px; color: #E8EDFF;
          font-family: 'Syne',sans-serif; outline: none; transition: border-color .2s;
        }
        .rp-input:focus { border-color: rgba(78,154,241,.6); }
        .rp-input::placeholder { color: #4B5675; }
        .rp-btn {
          width: 100%; background: #00C896; border: none; border-radius: 10px;
          padding: 13px; font-size: 14px; font-weight: 700; color: #fff;
          cursor: pointer; font-family: 'Syne',sans-serif; transition: background .18s;
        }
        .rp-btn:hover:not(:disabled) { background: #00A87E; }
        .rp-btn:disabled { opacity: .6; cursor: not-allowed; }
      `}</style>

      <div style={{
        background: "#111620", border: "1px solid rgba(255,255,255,.07)", borderRadius: 20,
        padding: "40px 36px", width: "100%", maxWidth: 420,
        boxShadow: "0 40px 100px rgba(0,0,0,.5)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28, justifyContent: "center" }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg,#4E9AF1,#00C896)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 900, color: "#fff",
          }}>G</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#E8EDFF" }}>GESTAR ERP</div>
            <div style={{ fontSize: 9, color: "#4E9AF1", letterSpacing: ".12em", textTransform: "uppercase" }}>Panamá</div>
          </div>
        </div>

        {!token ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "#FF6B6B", fontSize: 14, marginBottom: 20 }}>Enlace inválido o expirado.</p>
            <Link to="/recuperar-password" style={{ color: "#4E9AF1", fontWeight: 600, textDecoration: "none" }}>
              Solicitar nuevo enlace →
            </Link>
          </div>
        ) : exito ? (
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "linear-gradient(135deg,#00C896,#4E9AF1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, margin: "0 auto 20px",
            }}>✓</div>
            <h2 style={{ color: "#E8EDFF", fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
              Contraseña actualizada
            </h2>
            <p style={{ fontSize: 13, color: "#6B7A99", marginBottom: 24 }}>
              Ya puedes iniciar sesión con tu nueva contraseña.
            </p>
            <button className="rp-btn" onClick={() => navigate("/login")}>
              Ir al inicio de sesión →
            </button>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#E8EDFF", textAlign: "center", marginBottom: 6 }}>
              Nueva contraseña
            </h1>
            <p style={{ fontSize: 12, color: "#4B5675", textAlign: "center", marginBottom: 24 }}>
              Elige una contraseña segura de al menos 8 caracteres.
            </p>

            {error && (
              <div style={{
                background: "#FF6B6B0A", border: "1px solid #FF6B6B33",
                borderRadius: 8, padding: "10px 14px", marginBottom: 16,
                fontSize: 12, color: "#FF6B6B",
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: "#6B7A99", letterSpacing: ".1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                  Nueva contraseña *
                </label>
                <input className="rp-input" type="password" placeholder="••••••••" value={password}
                  onChange={(e) => setPass(e.target.value)} required />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: "#6B7A99", letterSpacing: ".1em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                  Confirmar contraseña *
                </label>
                <input className="rp-input" type="password" placeholder="••••••••" value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} required />
              </div>
              <button className="rp-btn" type="submit" disabled={loading} style={{ marginTop: 4 }}>
                {loading ? "Actualizando…" : "Guardar nueva contraseña →"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
