const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WA Gateway API',
      version: '1.0.0',
      description: 'API para gestionar múltiples sesiones de WhatsApp con auto-reconexión y persistencia en base de datos',
      contact: {
        name: 'WA Gateway Support',
        email: 'support@wagateway.com'
      }
    },
    servers: [
      {
        url: 'https://whatapi.premiumshop.shop/api',
        description: 'Servidor de producción'
      },
      {
        url: 'http://localhost:3000/api',
        description: 'Servidor de desarrollo'
      }
    ],
    components: {
      schemas: {
        Session: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'ID único de la sesión'
            },
            status: {
              type: 'string',
              enum: ['initializing', 'qr_ready', 'ready', 'disconnected', 'error'],
              description: 'Estado actual de la sesión'
            },
            phoneNumber: {
              type: 'string',
              description: 'Número de teléfono asociado'
            },
            webhookUrl: {
              type: 'string',
              description: 'URL del webhook para esta sesión'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha de creación'
            },
            lastActivity: {
              type: 'string',
              format: 'date-time',
              description: 'Última actividad'
            }
          }
        },
        Message: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'ID del mensaje'
            },
            sessionId: {
              type: 'string',
              description: 'ID de la sesión'
            },
            fromNumber: {
              type: 'string',
              description: 'Número de origen'
            },
            toNumber: {
              type: 'string',
              description: 'Número de destino'
            },
            messageType: {
              type: 'string',
              description: 'Tipo de mensaje'
            },
            content: {
              type: 'string',
              description: 'Contenido del mensaje'
            },
            audioUrl: {
              type: 'string',
              description: 'URL del audio (si aplica)'
            },
            direction: {
              type: 'string',
              enum: ['incoming', 'outgoing', 'system'],
              description: 'Dirección del mensaje'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Fecha y hora del mensaje'
            }
          }
        },
        Stats: {
          type: 'object',
          properties: {
            totalSessions: {
              type: 'integer',
              description: 'Total de sesiones'
            },
            activeSessions: {
              type: 'integer',
              description: 'Sesiones activas'
            },
            totalMessages: {
              type: 'integer',
              description: 'Total de mensajes'
            },
            messagesToday: {
              type: 'integer',
              description: 'Mensajes de hoy'
            },
            activeBots: {
              type: 'integer',
              description: 'Bots activos en memoria'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              description: 'Mensaje de error'
            }
          }
        }
      }
    }
  },
  apis: ['./api/*.js', './api/**/*.js']
};

const specs = swaggerJsdoc(options);

module.exports = specs; 