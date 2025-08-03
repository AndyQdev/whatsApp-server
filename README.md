# WA Gateway - Servidor de WhatsApp Personalizado

Un servidor de WhatsApp personalizado con auto-reconexión, persistencia en base de datos PostgreSQL y documentación Swagger completa.

## 🚀 Características

- ✅ **Múltiples sesiones de WhatsApp** - Maneja varios números simultáneamente
- ✅ **Auto-reconexión** - Las sesiones se reconectan automáticamente al reiniciar
- ✅ **Persistencia en PostgreSQL** - Todos los datos se guardan en base de datos
- ✅ **Documentación Swagger** - API completamente documentada
- ✅ **Webhooks dinámicos** - Cada sesión puede tener su propio webhook
- ✅ **Manejo de audio** - Descarga y sirve archivos de audio
- ✅ **Estadísticas en tiempo real** - Monitoreo completo del sistema
- ✅ **Configuración flexible** - Sistema de configuración por clave/valor

## 📋 Requisitos

- Node.js 16+
- PostgreSQL 12+
- npm o yarn

## 🛠️ Instalación

### 1. Clonar y instalar dependencias

```bash
git clone <tu-repositorio>
cd wa-gateway
npm install
```

### 2. Configurar base de datos PostgreSQL

```sql
-- Crear base de datos
CREATE DATABASE wa_gateway;

-- Crear usuario (opcional)
CREATE USER wagateway WITH PASSWORD 'tu_password';
GRANT ALL PRIVILEGES ON DATABASE wa_gateway TO wagateway;
```

### 3. Configurar variables de entorno

```bash
cp env.example .env
```

Editar `.env` con tus configuraciones:

```env
# Configuración del servidor
PORT=3000

# URL del webhook de n8n (por defecto)
WEBHOOK_URL=http://localhost:5678/webhook/f5b0365d-ee2e-4901-8b8b-7f9ab737c06f

# Configuración de WhatsApp
WHATSAPP_DATA_PATH=./sessions

# Configuración de archivos de audio
AUDIO_UPLOAD_PATH=./uploads/audio
AUDIO_BASE_URL=http://localhost:3000/audio

# Configuración de PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wa_gateway
DB_USER=postgres
DB_PASSWORD=tu_password
DB_SSL=false

# Configuración de entorno
NODE_ENV=development
```

### 4. Inicializar base de datos

```bash
npm run init-db
```

### 5. Iniciar el servidor

```bash
# Desarrollo (con auto-reload)
npm run dev

# Producción
npm start
```

## 📚 Documentación de la API

Una vez iniciado el servidor, accede a la documentación Swagger:

```
http://localhost:3000/api-docs
```

## 🔧 Endpoints Principales

### Sesiones

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/start-session` | Iniciar nueva sesión |
| `POST` | `/api/stop-session` | Detener sesión |
| `GET` | `/api/sessions` | Listar todas las sesiones |
| `GET` | `/api/session/{id}/status` | Estado de una sesión |
| `GET` | `/api/session/{id}/qr` | Obtener código QR |
| `POST` | `/api/session/{id}/webhook` | Configurar webhook |

### Mensajes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/send-message` | Enviar mensaje |
| `GET` | `/api/session/{id}/messages` | Historial de mensajes |
| `POST` | `/api/webhook-response` | Respuesta desde n8n |

### Sistema

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/stats` | Estadísticas del sistema |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/info` | Información del sistema |
| `GET` | `/api/config/{key}` | Obtener configuración |
| `POST` | `/api/config/{key}` | Actualizar configuración |

## 🔄 Auto-reconexión

El sistema automáticamente:

1. **Guarda el estado** de todas las sesiones en PostgreSQL
2. **Detecta sesiones activas** al iniciar
3. **Reconecta automáticamente** las sesiones que estaban funcionando
4. **Mantiene la configuración** de webhooks por sesión

### Configuración de auto-reconexión

```bash
# Habilitar/deshabilitar auto-reconexión
curl -X POST http://localhost:3000/api/config/auto_reconnect \
  -H "Content-Type: application/json" \
  -d '{"value": "true"}'
```

## 📊 Base de Datos

### Tablas principales

#### `sessions`
- `id` - ID único de la sesión
- `phone_number` - Número de teléfono
- `status` - Estado actual (ready, disconnected, error, etc.)
- `webhook_url` - URL del webhook específico
- `created_at` - Fecha de creación
- `last_activity` - Última actividad

#### `messages`
- `id` - ID del mensaje
- `session_id` - ID de la sesión
- `from_number` - Número de origen
- `to_number` - Número de destino
- `message_type` - Tipo de mensaje
- `content` - Contenido del mensaje
- `audio_url` - URL del audio (si aplica)
- `direction` - Dirección (incoming/outgoing)
- `timestamp` - Fecha y hora

#### `config`
- `key` - Clave de configuración
- `value` - Valor
- `description` - Descripción
- `updated_at` - Última actualización

## 🔗 Integración con n8n

### Formato de mensaje enviado a n8n

```json
{
  "body": {
    "data": {
      "messages": {
        "key": {
          "remoteJid": "59176814386@c.us"
        },
        "message": {
          "extendedTextMessage": {
            "text": "Hola, ¿cómo estás?"
          },
          "audioMessage": null
        }
      }
    }
  }
}
```

### Formato de respuesta desde n8n

```json
{
  "reply": "¡Hola! Estoy bien, ¿en qué puedo ayudarte?"
}
```

## 📱 Uso Básico

### 1. Iniciar una sesión

```bash
curl -X POST http://localhost:3000/api/start-session \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "mi_numero_59176814386",
    "webhookUrl": "https://tu-n8n.com/webhook/mi-webhook"
  }'
```

### 2. Escanear QR

El código QR aparecerá en la terminal. Escanéalo con WhatsApp.

### 3. Verificar estado

```bash
curl http://localhost:3000/api/session/mi_numero_59176814386/status
```

### 4. Enviar mensaje

```bash
curl -X POST http://localhost:3000/api/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "mi_numero_59176814386",
    "to": "59176814386",
    "message": "Hola desde WA Gateway!"
  }'
```

## 🚀 Despliegue en Producción

### 1. Configurar PostgreSQL en producción

```bash
# Instalar PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Crear base de datos
sudo -u postgres createdb wa_gateway
sudo -u postgres createuser wagateway
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE wa_gateway TO wagateway;"
```

### 2. Configurar variables de entorno de producción

```env
NODE_ENV=production
DB_HOST=tu-servidor-postgresql
DB_PASSWORD=password_seguro
WEBHOOK_URL=https://tu-n8n-produccion.com/webhook
AUDIO_BASE_URL=https://tu-dominio.com/audio
```

### 3. Usar PM2 para gestión de procesos

```bash
npm install -g pm2
pm2 start server.js --name "wa-gateway"
pm2 startup
pm2 save
```

## 🔧 Configuración Avanzada

### Límites de sesiones

```bash
curl -X POST http://localhost:3000/api/config/max_sessions \
  -H "Content-Type: application/json" \
  -d '{"value": "20"}'
```

### Webhook por defecto

```bash
curl -X POST http://localhost:3000/api/config/default_webhook_url \
  -H "Content-Type: application/json" \
  -d '{"value": "https://tu-n8n.com/webhook/default"}'
```

## 📊 Monitoreo

### Estadísticas en tiempo real

```bash
curl http://localhost:3000/api/stats
```

Respuesta:
```json
{
  "totalSessions": 5,
  "activeSessions": 3,
  "totalMessages": 1250,
  "messagesToday": 45,
  "activeBots": 3
}
```

### Health Check

```bash
curl http://localhost:3000/api/health
```

## 🐛 Troubleshooting

### Problemas comunes

1. **Error de conexión a PostgreSQL**
   - Verificar credenciales en `.env`
   - Asegurar que PostgreSQL esté corriendo

2. **Sesiones no se reconectan**
   - Verificar configuración `auto_reconnect`
   - Revisar logs del servidor

3. **QR no aparece**
   - Verificar que la sesión esté en estado `qr_ready`
   - Revisar logs de WhatsApp Web

4. **Mensajes no llegan a n8n**
   - Verificar URL del webhook
   - Revisar logs de red

### Logs útiles

```bash
# Ver logs en tiempo real
pm2 logs wa-gateway

# Ver logs específicos
pm2 logs wa-gateway --lines 100
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crear una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abrir un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.

## 🆘 Soporte

- 📧 Email: support@wagateway.com
- 📚 Documentación: `/api-docs`
- 🐛 Issues: GitHub Issues

---

**¡Disfruta usando WA Gateway! 🚀** 