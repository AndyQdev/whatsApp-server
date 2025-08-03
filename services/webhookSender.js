const { botManager } = require('../bots/botManager');

class WebhookSender {
  constructor() {
    this.botManager = botManager;
  }

  async sendReply(sessionId, to, message) {
    try {
      console.log(`📤 Enviando respuesta desde ${sessionId} a ${to}`);
      
      const result = await this.botManager.sendMessage(sessionId, to, message);
      
      if (result.success) {
        console.log(`✅ Respuesta enviada exitosamente a ${to}`);
        return { success: true, messageId: result.messageId };
      } else {
        console.error(`❌ Error enviando respuesta a ${to}:`, result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error(`Error en WebhookSender para ${sessionId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async sendReplyToAll(sessionId, message) {
    try {
      // Esta función podría usarse para enviar mensajes a todos los contactos
      // Por ahora solo es un placeholder
      console.log(`📢 Enviando mensaje a todos desde ${sessionId}`);
      return { success: true, message: 'Función no implementada aún' };
    } catch (error) {
      console.error(`Error enviando mensaje a todos desde ${sessionId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async sendMedia(sessionId, to, mediaPath, caption = '') {
    try {
      const bot = this.botManager.getBot(sessionId);
      if (!bot || !bot.client) {
        throw new Error('Sesión no disponible');
      }

      const media = MessageMedia.fromFilePath(mediaPath);
      const result = await bot.client.sendMessage(to, media, { caption });
      
      console.log(`✅ Media enviado exitosamente a ${to}`);
      return { success: true, messageId: result.id._serialized };
    } catch (error) {
      console.error(`Error enviando media desde ${sessionId}:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new WebhookSender(); 