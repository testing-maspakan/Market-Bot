import { Client, TextChannel, ChannelType, PermissionFlagsBits } from 'discord.js';
import { ProductEmbedManager } from '../embeds/ProductEmbed';
import { IProduct } from '../../../../shared/schemas/product';

export class ChannelManager {
  private client: Client;
  private productMessages: Map<string, string> = new Map(); // productId -> messageId

  constructor(client: Client) {
    this.client = client;
  }

  async deployProductEmbeds(channelId: string, products: IProduct[]) {
    try {
      const channel = await this.client.channels.fetch(channelId) as TextChannel;
      
      if (!channel || channel.type !== ChannelType.GuildText) {
        throw new Error('Invalid channel or channel is not a text channel');
      }

      // Clear existing product messages in this channel
      await this.clearExistingProductMessages(channel);

      // Send new product embeds
      for (const product of products) {
        if (product.isActive) {
          const { embed, components } = ProductEmbedManager.createProductEmbed(product);
          const message = await channel.send({ 
            embeds: [embed], 
            components 
          });
          
          this.productMessages.set(product.productId, message.id);
          console.log(`✅ Deployed product embed for: ${product.name}`);
        }
      }

      // Send welcome message
      const welcomeEmbed = new EmbedBuilder()
        .setTitle('🛍️ Digital Store')
        .setDescription('Welcome to our digital products store! Browse available products below and click **Buy Now** to purchase.')
        .setColor(0x0099FF)
        .setTimestamp();

      await channel.send({ embeds: [welcomeEmbed] });

    } catch (error) {
      console.error('❌ Error deploying product embeds:', error);
      throw error;
    }
  }

  async updateProductEmbed(product: IProduct) {
    try {
      const messageId = this.productMessages.get(product.productId);
      if (!messageId) return;

      // Find the message across all channels
      for (const [channelId, channel] of this.client.channels.cache) {
        if (channel.type === ChannelType.GuildText) {
          try {
            const textChannel = channel as TextChannel;
            const message = await textChannel.messages.fetch(messageId);
            
            if (message) {
              const { embed, components } = ProductEmbedManager.createProductEmbed(product);
              await message.edit({ embeds: [embed], components });
              console.log(`✅ Updated product embed for: ${product.name}`);
              return;
            }
          } catch (error) {
            // Message not found in this channel, continue searching
            continue;
          }
        }
      }

      // If message not found, remove from cache
      this.productMessages.delete(product.productId);
      
    } catch (error) {
      console.error(`❌ Error updating product embed for ${product.productId}:`, error);
    }
  }

  private async clearExistingProductMessages(channel: TextChannel) {
    try {
      const messages = await channel.messages.fetch({ limit: 50 });
      
      for (const [messageId, message] of messages) {
        // Delete messages that have buy buttons (our product embeds)
        if (message.components.length > 0 && message.embeds.length > 0) {
          await message.delete();
        }
      }
      
      // Clear cache for this channel
      this.productMessages.clear();
      
    } catch (error) {
      console.error('❌ Error clearing existing product messages:', error);
    }
  }

  getProductMessageId(productId: string): string | undefined {
    return this.productMessages.get(productId);
  }

  cacheProductMessage(productId: string, messageId: string) {
    this.productMessages.set(productId, messageId);
  }
}