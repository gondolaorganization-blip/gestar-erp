# GESTAR ERP — Guía de Despliegue en Producción

## Requisitos del servidor
- Node.js >= 18
- PostgreSQL >= 14
- PM2 (`npm install -g pm2`)

## 1. Clonar y configurar

```bash
git clone <repo>
cd gestar-erp
npm install --omit=dev
cp .env.example .env
```

Edita `.env` con los valores reales de producción.

### Generar JWT_SECRET seguro
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 2. Base de datos

```bash
# Crear base de datos (si no existe)
createdb gestar_erp

# Aplicar migraciones
npm run db:migrate

# Generar cliente Prisma
npm run db:generate
```

## 3. Arrancar con PM2

```bash
npm run pm2:start

# Ver estado
pm2 status

# Ver logs en tiempo real
npm run pm2:logs

# Configurar arranque automático al reiniciar el servidor
pm2 startup
pm2 save
```

## 4. Nginx como reverse proxy (recomendado)

```nginx
server {
    listen 80;
    server_name api.gestar-erp.com;

    # Redirigir HTTP → HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name api.gestar-erp.com;

    ssl_certificate     /etc/letsencrypt/live/api.gestar-erp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.gestar-erp.com/privkey.pem;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 5. Variables de entorno requeridas

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DATABASE_URL` | Cadena de conexión PostgreSQL | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Secreto para firmar tokens (≥ 32 chars) | `<hex aleatorio de 96 chars>` |
| `PORT` | Puerto del servidor | `3000` |
| `NODE_ENV` | Entorno de ejecución | `production` |
| `CORS_ORIGIN` | Dominio del frontend | `https://app.gestarsoft.com` |
| `ANTHROPIC_API_KEY` | API key de Anthropic (IA y banco import) | `sk-ant-api03-...` |
| `SMTP_HOST` | Host SMTP (Resend) | `smtp.resend.com` |
| `SMTP_PORT` | Puerto SMTP | `465` |
| `SMTP_USER` | Usuario SMTP (literal `resend` para Resend) | `resend` |
| `SMTP_PASS` | API key de Resend | `re_...` |
| `EMAIL_FROM` | Remitente de los correos | `GESTAR ERP <noreply@gestarsoft.com>` |
| `FRONTEND_URL` | URL pública del frontend (links en emails) | `https://app.gestarsoft.com` |
| `ADMIN_SECRET` | Clave del endpoint admin (≥ 24 chars) | `<hex aleatorio>` |
| `R2_ACCOUNT_ID` | *(Opcional)* ID de cuenta Cloudflare para R2 | `abc123...` |
| `R2_ACCESS_KEY_ID` | *(Opcional)* Access Key del token R2 | `...` |
| `R2_SECRET_ACCESS_KEY` | *(Opcional)* Secret del token R2 | `...` |
| `R2_BUCKET` | *(Opcional)* Nombre del bucket R2 | `gestar-erp-adjuntos` |

> **Adjuntos / R2:** sin las 4 variables `R2_*`, los adjuntos se guardan como binario en
> Postgres (modo por defecto, funciona sin configuración). Si defines las 4, los archivos
> se suben a Cloudflare R2 y en la DB solo se guarda la llave. El cambio es automático.

> **Nota Resend:** sin verificar el dominio en https://resend.com/domains solo puedes
> enviar desde `onboarding@resend.dev`. Para usar `noreply@gestarsoft.com` añade los
> registros DNS (SPF/DKIM) que indica Resend en el panel DNS de GoDaddy.

## 6. Health check

```
GET /health
```

Respuesta esperada en producción:
```json
{
  "estado": "ok",
  "db": "conectada",
  "entorno": "production",
  "uptime": 3600,
  "memoria": "45 MB"
}
```

Puedes configurar este endpoint en tu balanceador de carga o monitoreo (UptimeRobot, etc.).

## 7. Límites de seguridad configurados

| Capa | Límite |
|---|---|
| Auth (`/api/auth`) | 20 intentos por IP cada 15 min |
| API general | 300 peticiones por IP por minuto |
| Body size | 1 MB máximo |
| Cabeceras | Helmet (CSP, HSTS, X-Frame, XSS protection) |
| Compresión | gzip automático en respuestas > 1 KB |
