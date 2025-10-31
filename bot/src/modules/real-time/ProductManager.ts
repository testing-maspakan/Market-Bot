import { IProduct } from '../../../../shared/schemas/product';
import { ChannelManager } from './ChannelManager';

export class ProductManager {
  private channelManager: ChannelManager;
  private lastPollTime: number = 0;
  private productCache: Map<string, { product: IProduct; lastUpdated: Date }> = new Map();

  constructor(channelManager: ChannelManager) {
    this.channelManager = channelManager;
  }

  async pollForUpdates(): Promise<void> {
    try {
      const now = Date.now();
      
      // Rate limiting - don't poll more than once every 5 seconds
      if (now - this.lastPollTime < 5000) return;
      
      this.lastPollTime = now;
      
      console.log('🔄 Polling for product updates...');
      
      const response = await fetch(`${process.env.DASHBOARD_URL}/api/products`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        const products: IProduct[] = result.data;
        await this.processProductUpdates(products);
      } else {
        console.error('❌ API returned error:', result.error);
      }
    } catch (error) {
      console.error('❌ Error polling for product updates:', error);
    }
  }

  private async processProductUpdates(products: IProduct[]) {
    let updatesProcessed = 0;

    for (const product of products) {
      const cached = this.productCache.get(product.productId);
      const productLastUpdated = new Date(product.lastUpdated);
      
      // Check if product is new or updated
      if (!cached || productLastUpdated > cached.lastUpdated) {
        console.log(`🔄 Update detected for product: ${product.name}`);
        
        // Update the embed in Discord
        await this.channelManager.updateProductEmbed(product);
        
        // Update cache
        this.productCache.set(product.productId, {
          product,
          lastUpdated: productLastUpdated
        });
        
        updatesProcessed++;
      }
    }

    if (updatesProcessed > 0) {
      console.log(`✅ Processed ${updatesProcessed} product updates via polling`);
    }
  }

  async initializeProductCache() {
    try {
      const response = await fetch(`${process.env.DASHBOARD_URL}/api/products`);
      const result = await response.json();
      
      if (result.success) {
        const products: IProduct[] = result.data;
        
        for (const product of products) {
          this.productCache.set(product.productId, {
            product,
            lastUpdated: new Date(product.lastUpdated)
          });
        }
        
        console.log(`✅ Initialized cache with ${products.length} products`);
      }
    } catch (error) {
      console.error('❌ Error initializing product cache:', error);
    }
  }

  getCachedProduct(productId: string): IProduct | null {
    const cached = this.productCache.get(productId);
    return cached ? cached.product : null;
  }

  getCacheStats() {
    return {
      totalProducts: this.productCache.size,
      lastPollTime: new Date(this.lastPollTime).toISOString()
    };
  }
}