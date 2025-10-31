import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface CustomWebSocket extends WebSocket {
  isAlive: boolean;
  clientType?: 'dashboard' | 'bot';
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Set<CustomWebSocket> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/api/websocket'
    });

    this.setupWebSocketHandlers();
    this.startHeartbeat();
    
    console.log('🚀 WebSocket Server initialized');
  }

  private setupWebSocketHandlers() {
    if (!this.wss) return;

    this.wss.on('connection', (ws: CustomWebSocket, request) => {
      console.log('🔗 New WebSocket connection');
      
      ws.isAlive = true;
      this.clients.add(ws);

      // Identify client type from query params
      const url = new URL(request.url!, `http://${request.headers.host}`);
      ws.clientType = url.searchParams.get('client') as 'dashboard' | 'bot' || 'dashboard';

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data) => {
        this.handleMessage(ws, data.toString());
      });

      ws.on('close', () => {
        console.log('🔌 WebSocket connection closed');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        this.clients.delete(ws);
      });

      // Send welcome message
      this.sendToClient(ws, {
        type: 'CONNECTION_ESTABLISHED',
        timestamp: new Date().toISOString()
      });
    });
  }

  private handleMessage(ws: CustomWebSocket, message: string) {
    try {
      const parsed = JSON.parse(message);
      
      switch (parsed.type) {
        case 'PING':
          this.sendToClient(ws, { type: 'PONG', timestamp: Date.now() });
          break;
          
        case 'SUBSCRIBE_PRODUCTS':
          console.log(`📦 ${ws.clientType} subscribed to product updates`);
          break;
          
        default:
          console.log('Received unknown message type:', parsed.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  // Broadcast to all clients
  broadcast(message: any) {
    const messageStr = JSON.stringify({
      ...message,
      timestamp: Date.now()
    });

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  // Send to specific client type
  broadcastToType(clientType: 'dashboard' | 'bot', message: any) {
    const messageStr = JSON.stringify({
      ...message,
      timestamp: Date.now()
    });

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN && client.clientType === clientType) {
        client.send(messageStr);
      }
    });
  }

  private sendToClient(ws: CustomWebSocket, message: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((ws) => {
        if (!ws.isAlive) {
          console.log('💔 Terminating unresponsive WebSocket connection');
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 second heartbeat
  }

  cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.clients.forEach(client => client.terminate());
    this.clients.clear();
  }
}

export const webSocketManager = new WebSocketManager();