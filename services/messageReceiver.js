const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { botManager } = require('../bots/botManager');
const databaseService = require('./databaseService');

async function handleMessage(sessionId, msg, client, botManager) {
  try {
    console.log(`📨 Processing message in session ${sessionId}:`, {
      from: msg.from,
      type: msg.type,
      hasMedia: !!msg.hasMedia
    });

    // Extraer información del mensaje
    const messageData = {
      sessionId,
      from: msg.from,
      to: msg.to,
      timestamp: msg.timestamp,
      type: msg.type,
      message: null,
      audioUrl: null,
      audioDuration: null
    };

    // Procesar según el tipo de mensaje
    if (msg.type === 'text' || msg.type === 'chat') {
      messageData.message = msg.body;
      messageData.audioUrl = null;
    } else if (msg.type === 'ptt' || msg.type === 'audio') {
      const audioData = await handleAudioMessage(msg, sessionId);
      messageData.message = null;
      messageData.audioUrl = audioData.audioUrl;
      messageData.audioDuration = audioData.duration;
    } else {
      messageData.message = `[${msg.type.toUpperCase()}] Mensaje no soportado`;
      messageData.audioUrl = null;
    }

    // Guardar mensaje en base de datos
    await databaseService.saveMessage(
      sessionId,
      msg.from,
      msg.to,
      msg.type,
      messageData.message,
      messageData.audioUrl,
      messageData.audioDuration,
      'incoming'
    );

    // Enviar al webhook
    await sendToWebhook(messageData, sessionId, botManager);

  } catch (error) {
    console.error(`❌ Error processing message in ${sessionId}:`, error);
  }
}

async function handleAudioMessage(msg, sessionId) {
  try {
    console.log(`🎵 Processing audio message in session ${sessionId}`);

    // Descargar el audio
    const media = await msg.downloadMedia();
    if (!media) {
      throw new Error('No se pudo descargar el audio');
    }

    // Crear directorio para la sesión si no existe
    const sessionDir = path.join(process.env.AUDIO_UPLOAD_PATH || './uploads/audio', sessionId);
    await fs.ensureDir(sessionDir);

    // Generar nombre único para el archivo
    const timestamp = Date.now();
    const extension = getAudioExtension(media.mimetype);
    const filename = `audio_${timestamp}.${extension}`;
    const filePath = path.join(sessionDir, filename);

    // Guardar archivo
    await fs.writeFile(filePath, media.data, 'base64');

    // Generar URL pública
    const baseUrl = process.env.AUDIO_BASE_URL || 'http://localhost:3000/audio';
    const audioUrl = `${baseUrl}/${sessionId}/${filename}`;

    console.log(`✅ Audio saved: ${audioUrl}`);

    return {
      audioUrl,
      duration: msg.duration || null,
      filename,
      filePath
    };
  } catch (error) {
    console.error(`❌ Error handling audio message:`, error);
    throw error;
  }
}

function getAudioExtension(mimetype) {
  const extensions = {
    'audio/ogg; codecs=opus': 'ogg',
    'audio/mp4': 'm4a',
    'audio/webm': 'webm',
    'audio/wav': 'wav',
    'audio/mpeg': 'mp3'
  };
  return extensions[mimetype] || 'ogg';
}

async function sendToWebhook(messageData, sessionId, botManager) {
  try {
    const bot = botManager.getBot(sessionId);
    const webhookUrl = bot?.webhookUrl || process.env.WEBHOOK_URL;

    if (!webhookUrl) {
      throw new Error('No hay webhook URL configurado para esta sesión');
    }

    // Formatear datos para el webhook
    const webhookData = {
      body: {
        data: {
          messages: {
            key: {
              remoteJid: messageData.from
            },
            message: {
              extendedTextMessage: messageData.message ? { text: messageData.message } : null,
              audioMessage: messageData.audioUrl ? {
                url: messageData.audioUrl,
                mimetype: 'audio/ogg; codecs=opus',
                fileLength: messageData.audioDuration ? messageData.audioDuration.toString() : '0'
              } : null
            }
          }
        }
      }
    };

    console.log(`📤 Sending to webhook: ${webhookUrl}`);
    console.log(`📤 Webhook data:`, JSON.stringify(webhookData, null, 2));

    const response = await axios.post(webhookUrl, webhookData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log(`✅ Webhook response status: ${response.status}`);

    // Procesar respuesta del webhook
    if (response.data && response.data.reply) {
      await sendReply(messageData.sessionId, messageData.from, response.data.reply);
    }

  } catch (error) {
    console.error(`❌ Error sending to webhook:`, error.response?.data || error.message);
    
    // Guardar error en base de datos
    await databaseService.saveMessage(
      sessionId,
      'system',
      messageData.from,
      'error',
      `Error sending to webhook: ${error.message}`,
      null,
      null,
      'system'
    );
  }
}

async function sendReply(sessionId, to, reply) {
  try {
    console.log(`📤 Sending reply from ${sessionId} to ${to}: ${reply}`);
    
    const result = await botManager.sendMessage(sessionId, to, reply);
    
    if (result.success) {
      console.log(`✅ Reply sent successfully: ${result.messageId}`);
    } else {
      console.error(`❌ Failed to send reply: ${result.error}`);
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Error sending reply:`, error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  handleMessage,
  handleAudioMessage,
  sendToWebhook,
  sendReply
};
