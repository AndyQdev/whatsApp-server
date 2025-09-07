const { Server } = require('socket.io');

class SocketManager {
  constructor() {
    this.io = null;
    this.connectedClients = new Map(); // sessionId -> socket.id[]
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: "*", // En producción, especificar dominios
        methods: ["GET", "POST"]
      },
      path: '/socket.io'
    });

    this.io.on('connection', (socket) => {
      console.log(`🔌 Socket.IO client connected: ${socket.id}`);
      
      // Cliente se suscribe a una sesión específica
      socket.on('subscribe-session', (sessionId) => {
        socket.join(`session-${sessionId}`);
        
        // Trackear conexiones por sesión
        if (!this.connectedClients.has(sessionId)) {
          this.connectedClients.set(sessionId, []);
        }
        this.connectedClients.get(sessionId).push(socket.id);
        
        console.log(`📡 Client ${socket.id} subscribed to session: ${sessionId}`);
        
        // Confirmar suscripción
        socket.emit('subscribed', { sessionId, status: 'connected' });
      });

      // Cliente se desuscribe de una sesión
      socket.on('unsubscribe-session', (sessionId) => {
        socket.leave(`session-${sessionId}`);
        
        if (this.connectedClients.has(sessionId)) {
          const clients = this.connectedClients.get(sessionId);
          const index = clients.indexOf(socket.id);
          if (index > -1) {
            clients.splice(index, 1);
          }
          if (clients.length === 0) {
            this.connectedClients.delete(sessionId);
          }
        }
        
        console.log(`📡 Client ${socket.id} unsubscribed from session: ${sessionId}`);
      });

      // Cliente se desconecta
      socket.on('disconnect', (reason) => {
        console.log(`🔌 Socket.IO client disconnected: ${socket.id}, reason: ${reason}`);
        this.removeClientFromAllSessions(socket.id);
      });

      // Ping/Pong para mantener conexión
      socket.on('ping', () => {
        socket.emit('pong');
      });
    });

    console.log('✅ Socket.IO server initialized');
  }

  // Emitir evento a una sesión específica
  emitToSession(sessionId, event, data) {
    if (this.io) {
      const eventData = {
        event,
        sessionId,
        timestamp: new Date().toISOString(),
        data
      };
      
      this.io.to(`session-${sessionId}`).emit('whatsapp-event', eventData);
      console.log(`📤 Emitted ${event} to session ${sessionId}`);
    }
  }

  // Emitir a todos los clientes conectados
  emitToAll(event, data) {
    if (this.io) {
      this.io.emit('broadcast', {
        event,
        timestamp: new Date().toISOString(),
        data
      });
    }
  }

  // Obtener estadísticas de conexiones
  getConnectionStats() {
    const totalConnections = this.io ? this.io.sockets.sockets.size : 0;
    const sessionsWithClients = this.connectedClients.size;
    
    return {
      totalConnections,
      sessionsWithClients,
      sessionDetails: Object.fromEntries(
        Array.from(this.connectedClients.entries()).map(([sessionId, clients]) => [
          sessionId,
          { clientCount: clients.length, clients }
        ])
      )
    };
  }

  // Remover cliente de todas las sesiones
  removeClientFromAllSessions(socketId) {
    for (const [sessionId, clients] of this.connectedClients.entries()) {
      const index = clients.indexOf(socketId);
      if (index > -1) {
        clients.splice(index, 1);
        if (clients.length === 0) {
          this.connectedClients.delete(sessionId);
        }
      }
    }
  }
}

// Instancia global
const socketManager = new SocketManager();

module.exports = { socketManager };
