import WebSocket from 'ws';
import { Client } from 'discord.js';
import { ProductManager } from './ProductManager';
import { ChannelManager } from './ChannelManager';

interface WebSocketMessage {
  type: string;
  operation?: string;
  data?: any;
  timestamp: number;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private productManager: ProductManager;
  private channelManager: ChannelManager;
  private client: Client;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000;
  private isConnected: boolean = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat: number = 0;
  private fallbackPollingInterval: NodeJS.Timeout | null = null;

  constructor(client: Client, productManager: ProductManager, channelManager: ChannelManager) {
    this.client = client;
    this.productManager = productManager;
    this.channelManager = channelManager;
  }

  async connect() {
    const wsUrl = process.env.WEBSOCKET_URL || 'ws://localhost:3001/api/websocket?client=bot';
    
    console.log(`🔗 Connecting to WebSocket: ${wsUrl}`);
    
    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      console.log('✅ WebSocket connected successfully');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.stopFallbackPolling();
      
      // Subscribe to product updates
      this.send({
        type: 'SUBSCRIBE_PRODUCTS',
        client: 'bot',
        guildId: this.client.guilds.cache.first()?.id
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
        console.log('🔄 Received real-time product update');
        this.handleProductUpdate(message.data, message.operation);
        break;
        
      case 'PONG':
        this.lastHeartbeat = Date.now();
        break;
        
      default:
        console.log('📨 Received message type:', message.type);
    }
  }

  private async handleProductUpdate(productData: any, operation: string) {
    try {
      switch (operation) {
        case 'insert':
        case 'update':
          await this.channelManager.updateProductEmbed(productData);
          break;
          
        case 'delete':
          // Handle product removal from channels
          console.log(`🗑️ Product deleted: ${productData.productId}`);
          break;
          
        default:
          console.log(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      console.error('❌ Error handling product update:', error);
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
      
      // Start fallback polling if first disconnection
      if (this.reconnectAttempts === 1) {
        this.startFallbackPolling();
      }
    } else {
      console.error('💥 Max reconnection attempts reached. Staying in fallback mode.');
      this.startFallbackPolling();
    }
  }

  private startFallbackPolling() {
    if (this.fallbackPollingInterval) return;
    
    console.log('🔄 Starting fallback polling (5-second interval)');
    
    this.fallbackPollingInterval = setInterval(async () => {
      try {
        await this.productManager.pollForUpdates();
      } catch (error) {
        console.error('❌ Error in fallback polling:', error);
      }
    }, 5000); // 5-second intervals
  }

  private stopFallbackPolling() {
    if (this.fallbackPollingInterval) {
      clearInterval(this.fallbackPollingInterval);
      this.fallbackPollingInterval = null;
      console.log('✅ Stopped fallback polling');
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
    }, 15000); // 15-second heartbeat
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

  public getConnectionStatus(): { connected: boolean; fallbackMode: boolean } {
    return {
      connected: this.isConnected,
      fallbackMode: !!this.fallbackPollingInterval
    };
  }

  public disconnect() {
    this.stopHeartbeat();
    this.stopFallbackPolling();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}