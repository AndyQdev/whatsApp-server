const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { handleMessage } = require('../services/messageReceiver');

async function createBot(sessionId, botManager, webhookUrl = null) {
  return new Promise((resolve, reject) => {
    console.log(`🤖 Creating bot for session: ${sessionId}`);

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: sessionId }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    });

    const botData = {
      client,
      status: 'initializing',
      qr: null,
      webhookUrl: webhookUrl || process.env.WEBHOOK_URL
    };

    // Evento: Cliente listo
    client.on('ready', async () => {
      console.log(`✅ Client ready for session: ${sessionId}`);
      await botManager.updateBotStatus(sessionId, 'ready');
    });

    // Evento: QR Code generado
    client.on('qr', async (qr) => {
      console.log(`📱 QR Code generated for session: ${sessionId}`);
      
      // Mostrar QR en terminal
      qrcode.generate(qr, { small: true });
      
      // Actualizar estado
      await botManager.updateBotStatus(sessionId, 'qr_ready', null, qr);
    });

    // Evento: Autenticación exitosa
    client.on('authenticated', async () => {
      console.log(`🔐 Client authenticated for session: ${sessionId}`);
      await botManager.updateBotStatus(sessionId, 'authenticated');
    });

    // Evento: Autenticación fallida
    client.on('auth_failure', async (msg) => {
      console.error(`❌ Auth failure for session ${sessionId}:`, msg);
      await botManager.updateBotStatus(sessionId, 'auth_failure');
      reject(new Error(`Authentication failed: ${msg}`));
    });

    // Evento: Desconectado
    client.on('disconnected', async (reason) => {
      console.log(`🔌 Client disconnected for session ${sessionId}: ${reason}`);
      await botManager.updateBotStatus(sessionId, 'disconnected');
    });

    // Evento: Mensaje recibido
    client.on('message', async (msg) => {
      if (msg.fromMe) return; // Ignorar mensajes propios
      
      try {
        await handleMessage(sessionId, msg, client, botManager);
      } catch (error) {
        console.error(`❌ Error processing message in ${sessionId}:`, error);
      }
    });

    // Evento: Mensaje creado (para capturar todos los mensajes)
    client.on('message_create', async (msg) => {
      if (msg.fromMe) return; // Ignorar mensajes propios
      
      try {
        await handleMessage(sessionId, msg, client, botManager);
      } catch (error) {
        console.error(`❌ Error processing message_create in ${sessionId}:`, error);
      }
    });

    // Evento: Cambio de estado
    client.on('change_state', async (state) => {
      console.log(`🔄 State changed for session ${sessionId}: ${state}`);
    });

    // Evento: Error
    client.on('error', async (error) => {
      console.error(`💥 Error in client ${sessionId}:`, error);
      await botManager.updateBotStatus(sessionId, 'error');
    });

    // Inicializar el cliente
    client.initialize()
      .then(() => {
        console.log(`🚀 Client initialized for session: ${sessionId}`);
        resolve(botData);
      })
      .catch((error) => {
        console.error(`❌ Failed to initialize client for session ${sessionId}:`, error);
        reject(error);
      });
  });
}

module.exports = createBot;
