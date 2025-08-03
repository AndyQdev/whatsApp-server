const express = require('express');
const cors = require('cors');
const path = require('path');
const { botManager } = require('../bots/botManager');
const databaseService = require('../services/databaseService');

module.exports = (app) => {
  const router = express.Router();
  
  // Middleware
  router.use(cors());
  router.use(express.json());
  router.use('/audio', express.static(path.join(__dirname, '../uploads/audio')));

  // ===== SESIONES =====

  /**
   * @swagger
   * /start-session:
   *   post:
   *     summary: Iniciar una nueva sesión de WhatsApp
   *     tags: [Sessions]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - sessionId
   *             properties:
   *               sessionId:
   *                 type: string
   *                 description: ID único para la sesión
   *               webhookUrl:
   *                 type: string
   *                 description: URL del webhook para esta sesión (opcional)
   *     responses:
   *       200:
   *         description: Sesión iniciada exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 sessionId:
   *                   type: string
   *                 status:
   *                   type: string
   *       400:
   *         description: Error en la solicitud
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.post('/start-session', async (req, res) => {
    try {
      const { sessionId, webhookUrl } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ success: false, error: 'sessionId es requerido' });
      }

      const result = await botManager.startSession(sessionId, webhookUrl);
      res.json(result);
    } catch (error) {
      console.error('Error starting session:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @swagger
   * /stop-session:
   *   post:
   *     summary: Detener una sesión de WhatsApp
   *     tags: [Sessions]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - sessionId
   *             properties:
   *               sessionId:
   *                 type: string
   *                 description: ID de la sesión a detener
   *     responses:
   *       200:
   *         description: Sesión detenida exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   */
  router.post('/stop-session', async (req, res) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ success: false, error: 'sessionId es requerido' });
      }

      const result = await botManager.stopSession(sessionId);
      res.json(result);
    } catch (error) {
      console.error('Error stopping session:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @swagger
   * /session/{sessionId}/status:
   *   get:
   *     summary: Obtener el estado de una sesión
   *     tags: [Sessions]
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID de la sesión
   *     responses:
   *       200:
   *         description: Estado de la sesión
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Session'
   *       404:
   *         description: Sesión no encontrada
   */
  router.get('/session/:sessionId/status', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const result = await botManager.getSessionStatus(sessionId);
      res.json(result);
    } catch (error) {
      console.error('Error getting session status:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @swagger
   * /session/{sessionId}/qr:
   *   get:
   *     summary: Obtener el código QR de una sesión
   *     tags: [Sessions]
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID de la sesión
   *     responses:
   *       200:
   *         description: Código QR de la sesión
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 qr:
   *                   type: string
   *                   description: Código QR en formato texto
   *       404:
   *         description: Sesión no encontrada o QR no disponible
   */
  router.get('/session/:sessionId/qr', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const result = await botManager.getSessionStatus(sessionId);
      
      if (!result.success) {
        return res.status(404).json(result);
      }

      if (result.qr) {
        res.json({ success: true, qr: result.qr });
      } else {
        res.json({ success: false, message: 'QR no disponible' });
      }
    } catch (error) {
      console.error('Error getting QR:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @swagger
   * /sessions:
   *   get:
   *     summary: Obtener todas las sesiones
   *     tags: [Sessions]
   *     responses:
   *       200:
   *         description: Lista de todas las sesiones
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Session'
   */
  router.get('/sessions', async (req, res) => {
    try {
      const sessions = await botManager.getAllSessions();
      res.json(sessions);
    } catch (error) {
      console.error('Error getting sessions:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @swagger
   * /session/{sessionId}/webhook:
   *   post:
   *     summary: Actualizar la URL del webhook de una sesión
   *     tags: [Sessions]
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID de la sesión
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - webhookUrl
   *             properties:
   *               webhookUrl:
   *                 type: string
   *                 description: Nueva URL del webhook
   *     responses:
   *       200:
   *         description: Webhook actualizado exitosamente
   */
  router.post('/session/:sessionId/webhook', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { webhookUrl } = req.body;
      
      if (!webhookUrl) {
        return res.status(400).json({ success: false, error: 'webhookUrl es requerido' });
      }

      const result = await botManager.updateWebhookUrl(sessionId, webhookUrl);
      res.json(result);
    } catch (error) {
      console.error('Error updating webhook:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ===== MENSAJES =====

  /**
   * @swagger
   * /send-message:
   *   post:
   *     summary: Enviar un mensaje desde una sesión
   *     tags: [Messages]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - sessionId
   *               - to
   *               - message
   *             properties:
   *               sessionId:
   *                 type: string
   *                 description: ID de la sesión
   *               to:
   *                 type: string
   *                 description: Número de destino
   *               message:
   *                 type: string
   *                 description: Mensaje a enviar
   *     responses:
   *       200:
   *         description: Mensaje enviado exitosamente
   */
  router.post('/send-message', async (req, res) => {
    try {
      const { sessionId, to, message } = req.body;
      
      if (!sessionId || !to || !message) {
        return res.status(400).json({ 
          success: false, 
          error: 'sessionId, to y message son requeridos' 
        });
      }

      const result = await botManager.sendMessage(sessionId, to, message);
      res.json(result);
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @swagger
   * /session/{sessionId}/messages:
   *   get:
   *     summary: Obtener mensajes de una sesión
   *     tags: [Messages]
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID de la sesión
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 50
   *         description: Número máximo de mensajes
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           default: 0
   *         description: Número de mensajes a saltar
   *     responses:
   *       200:
   *         description: Lista de mensajes
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Message'
   */
  router.get('/session/:sessionId/messages', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { limit = 50, offset = 0 } = req.query;
      
      const messages = await databaseService.getMessages(sessionId, parseInt(limit), parseInt(offset));
      res.json(messages);
    } catch (error) {
      console.error('Error getting messages:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ===== WEBHOOK RESPONSE =====

  /**
   * @swagger
   * /webhook-response:
   *   post:
   *     summary: Recibir respuesta del webhook (n8n)
   *     tags: [Webhooks]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - sessionId
   *               - to
   *               - reply
   *             properties:
   *               sessionId:
   *                 type: string
   *                 description: ID de la sesión
   *               to:
   *                 type: string
   *                 description: Número de destino
   *               reply:
   *                 type: string
   *                 description: Respuesta a enviar
   *     responses:
   *       200:
   *         description: Respuesta enviada exitosamente
   */
  router.post('/webhook-response', async (req, res) => {
    try {
      const { sessionId, to, reply } = req.body;
      
      if (!sessionId || !to || !reply) {
        return res.status(400).json({ 
          success: false, 
          error: 'sessionId, to y reply son requeridos' 
        });
      }

      const result = await botManager.sendMessage(sessionId, to, reply);
      res.json(result);
    } catch (error) {
      console.error('Error sending webhook response:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ===== ESTADÍSTICAS =====

  /**
   * @swagger
   * /stats:
   *   get:
   *     summary: Obtener estadísticas del sistema
   *     tags: [Stats]
   *     responses:
   *       200:
   *         description: Estadísticas del sistema
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Stats'
   */
  router.get('/stats', async (req, res) => {
    try {
      const stats = await botManager.getStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ===== CONFIGURACIÓN =====

  /**
   * @swagger
   * /config/{key}:
   *   get:
   *     summary: Obtener configuración
   *     tags: [Config]
   *     parameters:
   *       - in: path
   *         name: key
   *         required: true
   *         schema:
   *           type: string
   *         description: Clave de configuración
   *     responses:
   *       200:
   *         description: Valor de configuración
   */
  router.get('/config/:key', async (req, res) => {
    try {
      const { key } = req.params;
      const config = await databaseService.getConfig(key);
      
      if (!config) {
        return res.status(404).json({ success: false, error: 'Configuración no encontrada' });
      }
      
      res.json(config);
    } catch (error) {
      console.error('Error getting config:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * @swagger
   * /config/{key}:
   *   post:
   *     summary: Actualizar configuración
   *     tags: [Config]
   *     parameters:
   *       - in: path
   *         name: key
   *         required: true
   *         schema:
   *           type: string
   *         description: Clave de configuración
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - value
   *             properties:
   *               value:
   *                 type: string
   *                 description: Nuevo valor
   *               description:
   *                 type: string
   *                 description: Descripción (opcional)
   *     responses:
   *       200:
   *         description: Configuración actualizada
   */
  router.post('/config/:key', async (req, res) => {
    try {
      const { key } = req.params;
      const { value, description } = req.body;
      
      if (!value) {
        return res.status(400).json({ success: false, error: 'value es requerido' });
      }

      const config = await databaseService.setConfig(key, value, description);
      res.json(config);
    } catch (error) {
      console.error('Error setting config:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ===== UTILIDADES =====

  /**
   * @swagger
   * /info:
   *   get:
   *     summary: Información del sistema
   *     tags: [System]
   *     responses:
   *       200:
   *         description: Información del sistema
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 name:
   *                   type: string
   *                 version:
   *                   type: string
   *                 status:
   *                   type: string
   *                 uptime:
   *                   type: number
   */
  router.get('/info', (req, res) => {
    res.json({
      name: 'WA Gateway API',
      version: '1.0.0',
      status: 'running',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  /**
   * @swagger
   * /health:
   *   get:
   *     summary: Verificar salud del sistema
   *     tags: [System]
   *     responses:
   *       200:
   *         description: Sistema saludable
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: "ok"
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   */
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  });

  // 404 handler
  router.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint no encontrado',
      path: req.originalUrl,
      method: req.method
    });
  });

  app.use('/api', router);
};
