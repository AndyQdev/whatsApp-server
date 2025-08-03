const pool = require('../config/database');

class DatabaseService {
  // ===== SESIONES =====
  
  async createSession(sessionId, phoneNumber = null, webhookUrl = null) {
    try {
      const query = `
        INSERT INTO sessions (id, phone_number, webhook_url, status)
        VALUES ($1, $2, $3, 'initializing')
        ON CONFLICT (id) 
        DO UPDATE SET 
          phone_number = COALESCE($2, sessions.phone_number),
          webhook_url = COALESCE($3, sessions.webhook_url),
          status = 'initializing',
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      
      const result = await pool.query(query, [sessionId, phoneNumber, webhookUrl]);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  async updateSessionStatus(sessionId, status, phoneNumber = null, qrCode = null) {
    try {
      const query = `
        UPDATE sessions 
        SET status = $2, 
            phone_number = COALESCE($3, phone_number),
            qr_code = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await pool.query(query, [sessionId, status, phoneNumber, qrCode]);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating session status:', error);
      throw error;
    }
  }

  async updateSessionWebhook(sessionId, webhookUrl) {
    try {
      const query = `
        UPDATE sessions 
        SET webhook_url = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await pool.query(query, [sessionId, webhookUrl]);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating session webhook:', error);
      throw error;
    }
  }

  async getSession(sessionId) {
    try {
      const query = 'SELECT * FROM sessions WHERE id = $1';
      const result = await pool.query(query, [sessionId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting session:', error);
      throw error;
    }
  }

  async getAllSessions() {
    try {
      const query = 'SELECT * FROM sessions ORDER BY created_at DESC';
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error getting all sessions:', error);
      throw error;
    }
  }

  async getActiveSessions() {
    try {
      const query = "SELECT * FROM sessions WHERE status = 'ready' ORDER BY last_activity DESC";
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error getting active sessions:', error);
      throw error;
    }
  }

  async deleteSession(sessionId) {
    try {
      const query = 'DELETE FROM sessions WHERE id = $1 RETURNING *';
      const result = await pool.query(query, [sessionId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }

  // ===== MENSAJES =====

  async saveMessage(sessionId, fromNumber, toNumber, messageType, content, audioUrl = null, audioDuration = null, direction = 'incoming') {
    try {
      const query = `
        INSERT INTO messages (session_id, from_number, to_number, message_type, content, audio_url, audio_duration, direction)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      
      const result = await pool.query(query, [
        sessionId, fromNumber, toNumber, messageType, content, audioUrl, audioDuration, direction
      ]);
      
      // Actualizar última actividad de la sesión
      await this.updateSessionActivity(sessionId);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  }

  async getMessages(sessionId, limit = 50, offset = 0) {
    try {
      const query = `
        SELECT * FROM messages 
        WHERE session_id = $1 
        ORDER BY timestamp DESC 
        LIMIT $2 OFFSET $3
      `;
      
      const result = await pool.query(query, [sessionId, limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('Error getting messages:', error);
      throw error;
    }
  }

  // ===== CONFIGURACIÓN =====

  async getConfig(key) {
    try {
      const query = 'SELECT * FROM config WHERE key = $1';
      const result = await pool.query(query, [key]);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting config:', error);
      throw error;
    }
  }

  async setConfig(key, value, description = null) {
    try {
      const query = `
        INSERT INTO config (key, value, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (key) 
        DO UPDATE SET 
          value = $2,
          description = COALESCE($3, config.description),
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      
      const result = await pool.query(query, [key, value, description]);
      return result.rows[0];
    } catch (error) {
      console.error('Error setting config:', error);
      throw error;
    }
  }

  // ===== UTILIDADES =====

  async updateSessionActivity(sessionId) {
    try {
      const query = `
        UPDATE sessions 
        SET last_activity = CURRENT_TIMESTAMP
        WHERE id = $1
      `;
      
      await pool.query(query, [sessionId]);
    } catch (error) {
      console.error('Error updating session activity:', error);
    }
  }

  async getStats() {
    try {
      const stats = {};
      
      // Total de sesiones
      const sessionsResult = await pool.query('SELECT COUNT(*) as total FROM sessions');
      stats.totalSessions = parseInt(sessionsResult.rows[0].total);
      
      // Sesiones activas
      const activeResult = await pool.query("SELECT COUNT(*) as active FROM sessions WHERE status = 'ready'");
      stats.activeSessions = parseInt(activeResult.rows[0].active);
      
      // Total de mensajes
      const messagesResult = await pool.query('SELECT COUNT(*) as total FROM messages');
      stats.totalMessages = parseInt(messagesResult.rows[0].total);
      
      // Mensajes hoy
      const todayResult = await pool.query(`
        SELECT COUNT(*) as today FROM messages 
        WHERE DATE(timestamp) = CURRENT_DATE
      `);
      stats.messagesToday = parseInt(todayResult.rows[0].today);
      
      return stats;
    } catch (error) {
      console.error('Error getting stats:', error);
      throw error;
    }
  }
}

module.exports = new DatabaseService(); 