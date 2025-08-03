const pool = require('../config/database');

const createTables = async () => {
  try {
    console.log('🗄️ Creating database tables...');

    // Tabla de sesiones
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(255) PRIMARY KEY,
        phone_number VARCHAR(50),
        status VARCHAR(50) DEFAULT 'disconnected',
        webhook_url TEXT,
        qr_code TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de mensajes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) REFERENCES sessions(id) ON DELETE CASCADE,
        from_number VARCHAR(50),
        to_number VARCHAR(50),
        message_type VARCHAR(20),
        content TEXT,
        audio_url TEXT,
        audio_duration INTEGER,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        direction VARCHAR(10) DEFAULT 'incoming'
      )
    `);

    // Tabla de configuración
    await pool.query(`
      CREATE TABLE IF NOT EXISTS config (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insertar configuración por defecto
    await pool.query(`
      INSERT INTO config (key, value, description) 
      VALUES 
        ('default_webhook_url', '', 'URL por defecto para webhooks'),
        ('max_sessions', '10', 'Número máximo de sesiones permitidas'),
        ('auto_reconnect', 'true', 'Auto-reconectar sesiones al iniciar')
      ON CONFLICT (key) DO NOTHING
    `);

    console.log('✅ Database tables created successfully!');
    
    // Crear índices para mejor rendimiento
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
      CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    `);

    console.log('✅ Database indexes created successfully!');

  } catch (error) {
    console.error('❌ Error creating database tables:', error);
    throw error;
  }
};

const initDatabase = async () => {
  try {
    await createTables();
    console.log('🎉 Database initialization completed!');
    process.exit(0);
  } catch (error) {
    console.error('💥 Database initialization failed:', error);
    process.exit(1);
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  initDatabase();
}

module.exports = { createTables }; 