import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import api from "../services/api";

const STEPS = ["Empresa", "Administrador", "Listo"];

// ── helpers ───────────────────────────────────────────────────────────────────

function Campo({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{
        fontSize: 10, fontWeight: 700, color: "#6B7A99",
        letterSpacing: "0.1em", textTransform: "uppercase",
      }}>{label}</label>
      {children}
    </div>
  );
}

// ── Step 1 — datos de la empresa ─────────────────────────────────────────────

function PasoEmpresa({ data, onChange, onNext }) {
  const [error, setError] = useState("");

  function validar(e) {
    e.preventDefault();
    if (!data.ruc.trim())    return setError("El RUC de la empresa es obligatorio");
    if (!data.nombre.trim()) return setError("El nombre legal de la empresa es obligatorio");
    setError("");
    onNext();
  }

  const inp = (k) => ({
    className: "reg-input",
    value: data[k],
    onChange: (e) => onChange(k, e.target.value),
  });

  return (
    <form onSubmit={validar} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 12, color: "#6B7A99", marginBottom: 4 }}>
        Crea tu espacio de trabajo en GESTAR ERP. Solo toma 2 minutos.
      </p>

      {error && <Alerta msg={error} />}

      <Campo label="RUC de la empresa *">
        <input {...inp("ruc")} placeholder="155-123456-2-2025 DV 51" />
      </Campo>

      <Campo label="Nombre legal *">
        <input {...inp("nombre")} placeholder="Servicios Ejemplo, S.A." />
      </Campo>

      <Campo label="Nombre comercial">
        <input {...inp("nombreComercial")} placeholder="Ejemplo Corp (opcional)" />
      </Campo>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Campo label="Teléfono">
          <input {...inp("telefono")} placeholder="507-XXXX-XXXX" />
        </Campo>
        <Campo label="Email de empresa">
          <input {...inp("email")} type="email" placeholder="info@ejemplo.com" />
        </Campo>
      </div>

      <Campo label="Dirección">
        <input {...inp("direccion")} placeholder="Ciudad de Panamá, Panamá" />
      </Campo>

      <button type="submit" className="reg-btn" style={{ marginTop: 6 }}>
        Continuar →
      </button>
    </form>
  );
}

// ── Step 2 — datos del usuario administrador ──────────────────────────────────

function PasoUsuario({ data, onChange, onBack, onSubmit, loading }) {
  const [error, setError] = useState("");

  async function enviar(e) {
    e.preventDefault();
    if (!data.nombre.trim()) return setError("Tu nombre es obligatorio");
    if (!data.email.trim())  return setError("El correo electrónico es obligatorio");
    if (data.password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres");
    if (data.password !== data.confirm) return setError("Las contraseñas no coinciden");
    setError("");
    const err = await onSubmit();
    if (err) setError(err);
  }

  const inp = (k, extra = {}) => ({
    className: "reg-input",
    value: data[k],
    onChange: (e) => onChange(k, e.target.value),
    ...extra,
  });

  return (
    <form onSubmit={enviar} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 12, color: "#6B7A99", marginBottom: 4 }}>
        Este usuario tendrá acceso total como administrador de la cuenta.
      </p>

      {error && <Alerta msg={error} />}

      <Campo label="Tu nombre completo *">
        <input {...inp("nombre")} placeholder="María Rodríguez" />
      </Campo>

      <Campo label="Correo electrónico *">
        <input {...inp("email", { type: "email" })} placeholder="maria@empresa.com" />
      </Campo>

      <Campo label="Contraseña * (mín. 8 caracteres)">
        <input {...inp("password", { type: "password" })} placeholder="••••••••" />
      </Campo>

      <Campo label="Confirmar contraseña *">
        <input {...inp("confirm", { type: "password" })} placeholder="••••••••" />
      </Campo>

      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        <button type="button" onClick={onBack} className="reg-btn-sec" style={{ flex: 1 }}>
          ← Atrás
        </button>
        <button type="submit" className="reg-btn" style={{ flex: 2 }} disabled={loading}>
          {loading ? "Creando cuenta…" : "Crear cuenta →"}
        </button>
      </div>
      <p style={{ fontSize: 11, color: "#4B5675", textAlign: "center", marginTop: 14, lineHeight: 1.6 }}>
        Al registrarte aceptas nuestros{" "}
        <Link to="/terminos" target="_blank" style={{ color: "#4E9AF1", textDecoration: "none" }}>Términos de Servicio</Link>
        {" "}y{" "}
        <Link to="/privacidad" target="_blank" style={{ color: "#4E9AF1", textDecoration: "none" }}>Política de Privacidad</Link>.
      </p>
    </form>
  );
}

// ── Step 3 — éxito ────────────────────────────────────────────────────────────

function PasoExito({ empresaNombre, navigate }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: "linear-gradient(135deg, #00C896 0%, #4E9AF1 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 28, margin: "0 auto 20px",
      }}>✓</div>
      <h2 style={{ color: "#E8EDFF", fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
        ¡Bienvenido a GESTAR!
      </h2>
      <p style={{ fontSize: 13, color: "#6B7A99", marginBottom: 4 }}>
        Tu empresa <strong style={{ color: "#E8EDFF" }}>{empresaNombre}</strong> ya está configurada.
      </p>
      <p style={{ fontSize: 12, color: "#4B5675", marginBottom: 28 }}>
        Tu próximo paso es configurar el Plan de Cuentas en Contabilidad.
      </p>
      <button className="reg-btn" onClick={() => navigate("/dashboard")}>
        Ir al dashboard →
      </button>
    </div>
  );
}

function Alerta({ msg }) {
  return (
    <div style={{
      background: "#FF6B6B0A", border: "1px solid #FF6B6B33",
      borderRadius: 8, padding: "10px 14px",
      fontSize: 12, color: "#FF6B6B",
    }}>
      {msg}
    </div>
  );
}

// ── StepBar ───────────────────────────────────────────────────────────────────

function StepBar({ step }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28 }}>
      {STEPS.map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 800,
            background: i <= step ? "linear-gradient(135deg,#4E9AF1,#00C896)" : "rgba(255,255,255,0.06)",
            color: i <= step ? "#fff" : "#4B5675",
            border: i <= step ? "none" : "1px solid rgba(255,255,255,0.1)",
          }}>
            {i < step ? "✓" : i + 1}
          </div>
          <span style={{
            fontSize: 10, fontWeight: 700, marginLeft: 6, marginRight: 6, whiteSpace: "nowrap",
            color: i === step ? "#E8EDFF" : "#4B5675",
            display: i === STEPS.length - 1 ? "block" : "none",
          }}>{s}</span>
          {i < STEPS.length - 1 && (
            <div style={{
              flex: 1, height: 1, margin: "0 6px",
              background: i < step ? "#4E9AF1" : "rgba(255,255,255,0.08)",
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function RegistroPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get("plan");

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [empresaCreada, setEmpresaCreada] = useState("");

  const [empresa, setEmpresa] = useState({
    ruc: "", nombre: "", nombreComercial: "", telefono: "", email: "", direccion: "",
  });
  const [usuario, setUsuario] = useState({
    nombre: "", email: "", password: "", confirm: "",
  });

  function cambiarEmpresa(k, v) { setEmpresa((p) => ({ ...p, [k]: v })); }
  function cambiarUsuario(k, v) { setUsuario((p) => ({ ...p, [k]: v })); }

  async function submitRegistro() {
    setLoading(true);
    try {
      const payload = {
        empresa: {
          ruc: empresa.ruc.trim(),
          nombre: empresa.nombre.trim(),
          nombreComercial: empresa.nombreComercial.trim() || undefined,
          telefono: empresa.telefono.trim() || undefined,
          email: empresa.email.trim() || undefined,
          direccion: empresa.direccion.trim() || undefined,
        },
        usuario: {
          nombre: usuario.nombre.trim(),
          email: usuario.email.trim(),
          password: usuario.password,
        },
      };

      const { data } = await api.post("/auth/registro", payload);
      localStorage.setItem("token", data.token);
      localStorage.setItem("usuario", JSON.stringify(data.usuario));
      setEmpresaCreada(data.empresa.nombre);
      setStep(2);
      return null;
    } catch (e) {
      return e.response?.data?.error || "Error al crear la cuenta. Intenta de nuevo.";
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(160deg, #0D1117 0%, #0F2744 50%, #0D1B2A 100%)",
      fontFamily: "'Syne', 'Outfit', sans-serif",
      padding: 16,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .reg-input {
          width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; padding: 12px 14px; font-size: 13px; color: #E8EDFF;
          font-family: 'Syne', sans-serif; transition: border-color 0.2s; outline: none;
        }
        .reg-input:focus { border-color: rgba(78,154,241,0.6); }
        .reg-input::placeholder { color: #4B5675; }
        .reg-btn {
          width: 100%; background: #4E9AF1; border: none; border-radius: 10px;
          padding: 13px; font-size: 14px; font-weight: 700; color: #fff;
          cursor: pointer; font-family: 'Syne', sans-serif; transition: background 0.18s;
        }
        .reg-btn:hover:not(:disabled) { background: #3D7FD8; }
        .reg-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .reg-btn-sec {
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; padding: 13px; font-size: 14px; font-weight: 600; color: #6B7A99;
          cursor: pointer; font-family: 'Syne', sans-serif; transition: background 0.18s;
        }
        .reg-btn-sec:hover { background: rgba(255,255,255,0.1); color: #E8EDFF; }
      `}</style>

      <div style={{
        background: "#111620", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 20, padding: "40px 36px", width: "100%", maxWidth: 480,
        boxShadow: "0 40px 100px rgba(0,0,0,0.5)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28, justifyContent: "center" }}>
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

        {step < 2 && (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#E8EDFF", textAlign: "center", marginBottom: 4 }}>
              {step === 0 ? "Crear cuenta" : "Tu usuario administrador"}
            </h1>
            {planParam && step === 0 && (
              <p style={{ textAlign: "center", fontSize: 11, color: "#00C896", marginBottom: 16 }}>
                Plan seleccionado: <strong>{planParam.toUpperCase()}</strong>
              </p>
            )}
            <p style={{ fontSize: 11, color: "#4B5675", textAlign: "center", marginBottom: 24 }}>
              Paso {step + 1} de 2
            </p>
          </>
        )}

        <StepBar step={step} />

        {step === 0 && (
          <PasoEmpresa
            data={empresa}
            onChange={cambiarEmpresa}
            onNext={() => setStep(1)}
          />
        )}

        {step === 1 && (
          <PasoUsuario
            data={usuario}
            onChange={cambiarUsuario}
            onBack={() => setStep(0)}
            onSubmit={submitRegistro}
            loading={loading}
          />
        )}

        {step === 2 && (
          <PasoExito empresaNombre={empresaCreada} navigate={navigate} />
        )}

        {step < 2 && (
          <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#4B5675" }}>
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" style={{ color: "#4E9AF1", textDecoration: "none", fontWeight: 600 }}>
              Iniciar sesión →
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
