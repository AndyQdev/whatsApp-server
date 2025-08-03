const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
const { setupBotManager, botManager } = require('./bots/botManager');
const { createTables } = require('./scripts/init-database');

// Cargar variables de entorno
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir archivos estáticos
app.use('/audio', express.static(path.join(__dirname, 'uploads/audio')));

// Documentación Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'WA Gateway API Documentation'
}));

// Configurar rutas de la API
require('./api')(app);

// Ruta principal
app.get('/', (req, res) => {
  res.json({
    name: 'WA Gateway',
    version: '1.0.0',
    description: 'Servidor de WhatsApp personalizado con auto-reconexión y persistencia',
    documentation: '/api-docs',
    endpoints: {
      api: '/api',
      health: '/api/health',
      info: '/api/info',
      stats: '/api/stats'
    }
  });
});

// Manejo global de errores
app.use((error, req, res, next) => {
  console.error('❌ Global error handler:', error);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    message: error.message
  });
});

// Función para iniciar el servidor
async function startServer() {
  try {
    console.log('🚀 Starting WA Gateway server...');
    
    // Inicializar base de datos
    console.log('🗄️ Initializing database...');
    await createTables();
    console.log('✅ Database initialized');
    
    // Inicializar BotManager
    console.log('🤖 Initializing BotManager...');
    await setupBotManager();
    console.log('✅ BotManager initialized');
    
    // Iniciar servidor
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log('🎉 WA Gateway server is running!');
      console.log(`📍 Server URL: http://localhost:${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
      console.log(`💚 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`📊 Statistics: http://localhost:${PORT}/api/stats`);
    });
    
  } catch (error) {
    console.error('💥 Failed to start server:', error);
    process.exit(1);
  }
}

// Manejo de señales para cierre graceful
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  try {
    await botManager.cleanup();
    console.log('✅ Cleanup completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  try {
    await botManager.cleanup();
    console.log('✅ Cleanup completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Iniciar el servidor
startServer();
