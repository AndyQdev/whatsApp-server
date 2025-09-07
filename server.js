const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
const { setupBotManager, botManager } = require('./bots/botManager');
const { createTables } = require('./scripts/init-database');
const http = require('http');
const { socketManager } = require('./websocket/socketManager');

// Cargar variables de entorno
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir archivos estáticos
app.use('/audio', express.static(path.join(__dirname, 'uploads/audio')));

// Configurar Swagger dinámicamente según el entorno
const isProduction = process.env.NODE_ENV === 'production';
const baseUrl = isProduction ? 'https://whatapi.premiumshop.shop' : `http://localhost:${process.env.PORT || 3000}`;

// Documentación Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'WA Gateway API Documentation',
  swaggerOptions: {
    url: `${baseUrl}/api-docs/swagger.json`,
    defaultModelsExpandDepth: -1
  }
}));

// Endpoint para obtener la especificación Swagger
app.get('/api-docs/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpecs);
});

// Configurar rutas de la API
require('./api')(app);

// Ruta principal
app.get('/', (req, res) => {
  res.json({
    name: 'WA Gateway',
    version: '1.0.0',
    description: 'Servidor de WhatsApp personalizado con auto-reconexión y persistencia',
    environment: isProduction ? 'production' : 'development',
    documentation: '/api-docs',
    endpoints: {
      api: '/api',
      health: '/api/health',
      info: '/api/info',
      stats: '/api/stats'
    },
    servers: {
      production: 'https://whatapi.premiumshop.shop',
      development: `http://localhost:${process.env.PORT || 3000}`
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
    console.log(`🌍 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`🔗 Base URL: ${baseUrl}`);
    
    // Inicializar base de datos
    console.log('🗄️ Initializing database...');
    await createTables();
    console.log('✅ Database initialized');
    
    // Inicializar BotManager
    console.log('🤖 Initializing BotManager...');
    await setupBotManager();
    console.log('✅ BotManager initialized');
    
    // Inicializar Socket.IO
    console.log('📡 Initializing Socket.IO...');
    socketManager.initialize(server);
    console.log('✅ Socket.IO initialized');
    
    // Inyectar socketManager en botManager
    botManager.setSocketManager(socketManager);
    
    // Iniciar servidor
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log('🎉 WA Gateway server is running!');
      console.log(`📍 Server URL: ${baseUrl}`);
      console.log(`📚 API Documentation: ${baseUrl}/api-docs`);
      console.log(`🔗 API Base URL: ${baseUrl}/api`);
      console.log(`💚 Health Check: ${baseUrl}/api/health`);
      console.log(`📊 Statistics: ${baseUrl}/api/stats`);
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
