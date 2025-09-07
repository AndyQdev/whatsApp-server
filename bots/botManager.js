const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs-extra');
const createBot = require('./createBot');
const databaseService = require('../services/databaseService');

class BotManager {
  constructor() {
    this.bots = new Map(); // sessionId -> { client, status, qr, webhookUrl }
    this.sessionsPath = process.env.WHATSAPP_DATA_PATH || './sessions';
    this.socketManager = null; // Se inyectará después de la inicialización
  }

  async initialize() {
    try {
      console.log('🚀 Initializing BotManager...');
      
      // Crear directorio de sesiones si no existe
      await fs.ensureDir(this.sessionsPath);
      
      // Auto-reconectar sesiones activas
      await this.autoReconnectSessions();
      
      console.log('✅ BotManager initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing BotManager:', error);
      throw error;
    }
  }

  async autoReconnectSessions() {
    try {
      console.log('🔄 Auto-reconnecting sessions...');
      
      // Obtener configuración de auto-reconexión
      const autoReconnectConfig = await databaseService.getConfig('auto_reconnect');
      if (autoReconnectConfig && autoReconnectConfig.value === 'false') {
        console.log('⚠️ Auto-reconnect disabled in config');
        return;
      }

      // Obtener sesiones que estaban activas
      const activeSessions = await databaseService.getActiveSessions();
      
      if (activeSessions.length === 0) {
        console.log('ℹ️ No active sessions to reconnect');
        return;
      }

      console.log(`🔄 Found ${activeSessions.length} sessions to reconnect`);

      for (const session of activeSessions) {
        try {
          console.log(`🔄 Reconnecting session: ${session.id}`);
          
          // Verificar si el archivo de sesión existe
          const sessionFile = path.join(this.sessionsPath, `${session.id}.json`);
          if (!await fs.pathExists(sessionFile)) {
            console.log(`⚠️ Session file not found for ${session.id}, skipping...`);
            await databaseService.updateSessionStatus(session.id, 'disconnected');
            continue;
          }

          // Intentar reconectar
          await this.startSession(session.id, session.webhook_url);
          
          console.log(`✅ Successfully reconnected session: ${session.id}`);
        } catch (error) {
          console.error(`❌ Failed to reconnect session ${session.id}:`, error);
          await databaseService.updateSessionStatus(session.id, 'error');
        }
      }
    } catch (error) {
      console.error('❌ Error in auto-reconnect:', error);
    }
  }

  async startSession(sessionId, webhookUrl = null) {
    try {
      console.log(`🚀 Starting session: ${sessionId}`);
      
      // Crear sesión en la base de datos
      await databaseService.createSession(sessionId, null, webhookUrl);
      
      // Crear el bot y esperar el QR
      const botData = await createBot(sessionId, this, webhookUrl);
      this.bots.set(sessionId, botData);
      
      // Esperar hasta 30 segundos por el QR o hasta que esté listo
      const qrCode = await this.waitForQR(sessionId, 30000);
      
      console.log(`✅ Session started: ${sessionId}`);
      
      return { 
        success: true, 
        sessionId, 
        status: qrCode ? 'qr_ready' : 'initializing',
        qr: qrCode,
        message: qrCode ? 'QR generado exitosamente' : 'Sesión iniciada, generando QR...'
      };
    } catch (error) {
      console.error(`❌ Error starting session ${sessionId}:`, error);
      await databaseService.updateSessionStatus(sessionId, 'error');
      return { success: false, error: error.message };
    }
  }

  /**
   * Esperar a que se genere el código QR para una sesión
   */
  async waitForQR(sessionId, timeout = 30000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkForQR = async () => {
        try {
          const bot = this.bots.get(sessionId);
          const dbSession = await databaseService.getSession(sessionId);
          
          // Verificar si ya tenemos QR
          if (bot && bot.qr) {
            resolve(bot.qr);
            return;
          }
          
          if (dbSession && dbSession.qr_code) {
            resolve(dbSession.qr_code);
            return;
          }
          
          // Verificar si ya está autenticado (sin QR)
          if (bot && bot.status === 'ready') {
            resolve(null);
            return;
          }
          
          if (dbSession && dbSession.status === 'ready') {
            resolve(null);
            return;
          }
          
          // Verificar timeout
          if (Date.now() - startTime >= timeout) {
            console.log(`⏰ Timeout waiting for QR for session: ${sessionId}`);
            resolve(null);
            return;
          }
          
          // Continuar verificando cada 500ms
          setTimeout(checkForQR, 500);
          
        } catch (error) {
          console.error(`❌ Error checking QR for session ${sessionId}:`, error);
          resolve(null);
        }
      };
      
      checkForQR();
    });
  }

  async stopSession(sessionId) {
    try {
      console.log(`🛑 Stopping session: ${sessionId}`);
      
      const bot = this.bots.get(sessionId);
      if (bot && bot.client) {
        await bot.client.destroy();
      }
      
      this.bots.delete(sessionId);
      await databaseService.updateSessionStatus(sessionId, 'disconnected');
      
      console.log(`✅ Session stopped: ${sessionId}`);
      return { success: true, message: 'Session stopped successfully' };
    } catch (error) {
      console.error(`❌ Error stopping session ${sessionId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async getSessionStatus(sessionId) {
    try {
      const bot = this.bots.get(sessionId);
      const dbSession = await databaseService.getSession(sessionId);
      
      if (!dbSession) {
        return { success: false, message: 'Session not found' };
      }

      return {
        success: true,
        sessionId,
        status: bot ? bot.status : dbSession.status,
        phoneNumber: dbSession.phone_number,
        webhookUrl: dbSession.webhook_url,
        qr: bot ? bot.qr : dbSession.qr_code,
        createdAt: dbSession.created_at,
        lastActivity: dbSession.last_activity
      };
    } catch (error) {
      console.error(`❌ Error getting session status for ${sessionId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async getAllSessions() {
    try {
      const dbSessions = await databaseService.getAllSessions();
      
      return dbSessions.map(session => ({
        sessionId: session.id,
        status: session.status,
        phoneNumber: session.phone_number,
        webhookUrl: session.webhook_url,
        createdAt: session.created_at,
        lastActivity: session.last_activity,
        isActive: this.bots.has(session.id)
      }));
    } catch (error) {
      console.error('❌ Error getting all sessions:', error);
      return [];
    }
  }

  async updateBotStatus(sessionId, status, phoneNumber = null, qr = null) {
    try {
      // Actualizar en memoria
      const bot = this.bots.get(sessionId);
      if (bot) {
        bot.status = status;
        if (phoneNumber) bot.phoneNumber = phoneNumber;
        if (qr) bot.qr = qr;
      }

      // Actualizar en base de datos
      await databaseService.updateSessionStatus(sessionId, status, phoneNumber, qr);
      
      // Emitir evento Socket.IO en tiempo real
      if (this.socketManager) {
        this.socketManager.emitToSession(sessionId, 'status_changed', {
          status,
          phoneNumber,
          qr,
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`📊 Session ${sessionId} status updated to: ${status}`);
    } catch (error) {
      console.error(`❌ Error updating bot status for ${sessionId}:`, error);
    }
  }

  async updateWebhookUrl(sessionId, webhookUrl) {
    try {
      // Actualizar en memoria
      const bot = this.bots.get(sessionId);
      if (bot) {
        bot.webhookUrl = webhookUrl;
      }

      // Actualizar en base de datos
      await databaseService.updateSessionWebhook(sessionId, webhookUrl);
      
      console.log(`🔗 Webhook URL updated for ${sessionId}: ${webhookUrl}`);
      return { success: true, message: 'Webhook URL updated' };
    } catch (error) {
      console.error(`❌ Error updating webhook URL for ${sessionId}:`, error);
      return { success: false, message: error.message };
    }
  }

  async sendMessage(sessionId, to, message) {
    try {
      const bot = this.bots.get(sessionId);
      if (!bot || !bot.client) {
        throw new Error('Session not available');
      }

      const isReady = bot.client.isReady || bot.status === 'ready';
      if (!isReady) {
        console.log(`⚠️ Client ${sessionId} not ready:`, {
          isReady: bot.client.isReady,
          status: bot.status,
          clientExists: !!bot.client
        });
        throw new Error('Client not ready');
      }

      // Formatear número de teléfono
      let formattedNumber = to;
      if (!formattedNumber.includes('@s.whatsapp.net')) {
        const cleanNumber = formattedNumber.replace(/\D/g, '');
        if (!cleanNumber.startsWith('591')) {
          formattedNumber = `591${cleanNumber}@s.whatsapp.net`;
        } else {
          formattedNumber = `${cleanNumber}@s.whatsapp.net`;
        }
      }

      console.log(`📤 Sending message from ${sessionId} to ${formattedNumber}: ${message}`);
      
      const result = await bot.client.sendMessage(formattedNumber, message);
      
      // Guardar mensaje en base de datos
      await databaseService.saveMessage(
        sessionId, 
        'me', 
        formattedNumber, 
        'text', 
        message, 
        null, 
        null, 
        'outgoing'
      );

      return { success: true, messageId: result.id._serialized };
    } catch (error) {
      console.error(`❌ Error sending message from ${sessionId}:`, error);
      return { success: false, error: error.message };
    }
  }

  getBot(sessionId) {
    return this.bots.get(sessionId);
  }

  async getStats() {
    try {
      const dbStats = await databaseService.getStats();
      return {
        ...dbStats,
        activeBots: this.bots.size
      };
    } catch (error) {
      console.error('❌ Error getting stats:', error);
      return { error: error.message };
    }
  }

  async cleanup() {
    try {
      console.log('🧹 Cleaning up BotManager...');
      
      // Detener todos los bots
      for (const [sessionId, bot] of this.bots) {
        try {
          if (bot.client) {
            await bot.client.destroy();
          }
        } catch (error) {
          console.error(`❌ Error destroying bot ${sessionId}:`, error);
        }
      }
      
      this.bots.clear();
      console.log('✅ BotManager cleanup completed');
    } catch (error) {
      console.error('❌ Error in BotManager cleanup:', error);
    }
  }

  // Método para inyectar el socketManager
  setSocketManager(socketManager) {
    this.socketManager = socketManager;
    console.log('✅ SocketManager injected into BotManager');
  }
}

// Instancia global
const botManager = new BotManager();

// Función de setup
async function setupBotManager() {
  await botManager.initialize();
}

module.exports = { botManager, setupBotManager };
