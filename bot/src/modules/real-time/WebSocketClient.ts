import WebSocket from 'ws';
import { ProductManager } from './ProductManager';

interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp: number;
  operation?: string;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private productManager: ProductManager;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000; // 5 seconds
  private isConnected: boolean = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat: number = 0;

  constructor(productManager: ProductManager) {
    this.productManager = productManager;
  }

  connect() {
    const wsUrl = process.env.WEBSOCKET_URL || 'ws://localhost:3001/api/websocket?client=bot';
    
    console.log(`🔗 Connecting to WebSocket: ${wsUrl}`);
    
    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      console.log('✅ WebSocket connected successfully');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      
      // Subscribe to product updates
      this.send({
        type: 'SUBSCRIBE_PRODUCTS'
      });
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
      }
    });

    this.ws.on('close', (code, reason) => {
      console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
      this.handleDisconnection();
    });

    this.ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
      this.handleDisconnection();
    });
  }

  private handleMessage(message: WebSocketMessage) {
    switch (message.type) {
      case 'CONNECTION_ESTABLISHED':
        console.log('🤝 WebSocket connection confirmed');
        break;
        
      case 'PRODUCT_UPDATE':
        console.log('🔄 Received product update via WebSocket');
        this.productManager.handleProductUpdate(message.data, message.operation);
        break;
        
      case 'PONG':
        this.lastHeartbeat = Date.now();
        break;
        
      default:
        console.log('📨 Received unknown message type:', message.type);
    }
  }

  private handleDisconnection() {
    this.isConnected = false;
    this.stopHeartbeat();
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      
      console.log(`🔄 Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('💥 Max reconnection attempts reached. Switching to fallback mode.');
      this.productManager.activateFallbackMode();
    }
  }

  private startHeartbeat() {
    this.lastHeartbeat = Date.now();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws) {
        this.send({ type: 'PING' });
        
        // Check if server is responsive
        if (Date.now() - this.lastHeartbeat > 30000) {
          console.log('💔 Server heartbeat timeout');
          this.ws.terminate();
        }
      }
    }, 15000); // 15 second heartbeat
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private send(message: any) {
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  public disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}