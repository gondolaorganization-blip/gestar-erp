import { useState, useEffect } from "react";
import api from "../services/api";

const fmtBytes = (b) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Panel de adjuntos reutilizable.
 * tipo: "FACTURA" | "ORDEN_COMPRA"
 * referenciaId: id de la factura u orden
 */
export default function PanelAdjuntos({ tipo, referenciaId }) {
  const [adjuntos, setAdjuntos] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError]       = useState(null);

  const rutaBase = tipo === "FACTURA" ? "facturas" : "compras";

  useEffect(() => {
    api.get(`/${rutaBase}/${referenciaId}/adjuntos`)
      .then((r) => setAdjuntos(r.data))
      .catch(() => {});
  }, [rutaBase, referenciaId]);

  async function subirArchivo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setError(null);
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append("archivo", file);
      const { data } = await api.post(`/${rutaBase}/${referenciaId}/adjuntos`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAdjuntos((prev) => [...prev, data]);
    } catch (err) {
      setError(err.response?.data?.error || "Error al subir el archivo.");
    } finally {
      setSubiendo(false);
    }
  }

  async function descargar(adj) {
    try {
      const token = localStorage.getItem("token");
      const res   = await fetch(`/api/adjuntos/${adj.id}/descargar`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = adj.nombre; a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("No se pudo descargar el archivo.");
    }
  }

  async function eliminar(id) {
    if (!window.confirm("¿Eliminar este adjunto?")) return;
    try {
      await api.delete(`/adjuntos/${id}`);
      setAdjuntos((prev) => prev.filter((a) => a.id !== id));
    } catch {
      alert("Error al eliminar el adjunto.");
    }
  }

  return (
    <div style={{ marginTop: 16, marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#555" }}>
          Documentos adjuntos ({adjuntos.length})
        </span>
        <label style={{
          background: "#f0f0f0", color: "#333", border: "none", borderRadius: 8,
          padding: "5px 12px", cursor: "pointer", fontSize: 12, display: "inline-block",
        }}>
          {subiendo ? "Subiendo…" : "+ Adjuntar"}
          <input
            type="file"
            style={{ display: "none" }}
            onChange={subirArchivo}
            disabled={subiendo}
            accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,.xls,.xlsx"
          />
        </label>
      </div>

      {error && <p style={{ fontSize: 12, color: "#FF6B6B", margin: "0 0 8px" }}>{error}</p>}

      {adjuntos.length === 0 ? (
        <p style={{ fontSize: 12, color: "#bbb", margin: 0 }}>Sin documentos adjuntos.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {adjuntos.map((a) => (
            <div key={a.id} style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#f8f9fa", borderRadius: 7, padding: "7px 10px",
            }}>
              <span style={{ fontSize: 12, color: "#333", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                📎 {a.nombre}
              </span>
              <span style={{ fontSize: 11, color: "#aaa", whiteSpace: "nowrap" }}>{fmtBytes(a.tamano)}</span>
              <button
                onClick={() => descargar(a)}
                title="Descargar"
                style={{ background: "#f0f4ff", color: "#4E9AF1", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
              >↓</button>
              <button
                onClick={() => eliminar(a.id)}
                title="Eliminar"
                style={{ background: "none", border: "none", color: "#FF6B6B", cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1 }}
              >×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
