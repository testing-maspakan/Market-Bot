import { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  MessageActionRowComponentBuilder 
} from 'discord.js';
import { IProduct } from '../../../../shared/schemas/product';

export class ProductEmbedManager {
  static createProductEmbed(product: IProduct): { 
    embed: EmbedBuilder; 
    components: ActionRowBuilder<MessageActionRowComponentBuilder>[] 
  } {
    // Create main product embed
    const embed = new EmbedBuilder()
      .setTitle(`🛍️ ${product.name}`)
      .setDescription(product.description)
      .addFields(
        { 
          name: '💰 Price', 
          value: `**$${product.price.toFixed(2)}**`, 
          inline: true 
        },
        { 
          name: '📦 Stock', 
          value: `**${product.stock} available**`, 
          inline: true 
        },
        { 
          name: '📝 Category', 
          value: `**${this.formatCategory(product.category)}**`, 
          inline: true 
        }
      )
      .setImage(product.imageUrl)
      .setColor(product.stock > 0 ? 0x00FF00 : 0xFF0000)
      .setFooter({ 
        text: `Product ID: ${product.productId} • Last updated: ${new Date().toLocaleTimeString()}` 
      })
      .setTimestamp();

    // Add 3D model field if available
    if (product.threeJsModelUrl) {
      embed.addFields({
        name: '🎮 3D Preview',
        value: '*Interactive model available*',
        inline: true
      });
    }

    // Create action buttons
    const buyButton = new ButtonBuilder()
      .setCustomId(`buy_btn:${product.productId}`)
      .setLabel('🛒 Buy Now')
      .setStyle(ButtonStyle.Success)
      .setDisabled(product.stock <= 0 || !product.isActive);

    const paymentButton = new ButtonBuilder()
      .setCustomId('payment_btn')
      .setLabel('💰 Payment Methods')
      .setStyle(ButtonStyle.Primary);

    const refreshButton = new ButtonBuilder()
      .setCustomId(`refresh_btn:${product.productId}`)
      .setLabel('🔄 Refresh')
      .setStyle(ButtonStyle.Secondary);

    const actionRow = new ActionRowBuilder<MessageActionRowComponentBuilder>()
      .addComponents(buyButton, paymentButton, refreshButton);

    return {
      embed,
      components: [actionRow]
    };
  }

  static createProductPanel(products: IProduct[]): { 
    embeds: EmbedBuilder[]; 
    components: ActionRowBuilder<MessageActionRowComponentBuilder>[] 
  } {
    if (products.length === 1) {
      return this.createProductEmbed(products[0]);
    }

    // Multiple products panel
    const embeds: EmbedBuilder[] = [];
    const components: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

    products.forEach((product, index) => {
      const embed = new EmbedBuilder()
        .setTitle(`🛍️ ${product.name}`)
        .setDescription(product.description.length > 100 
          ? product.description.substring(0, 100) + '...' 
          : product.description
        )
        .addFields(
          { name: '💰 Price', value: `$${product.price}`, inline: true },
          { name: '📦 Stock', value: `${product.stock}`, inline: true }
        )
        .setColor(product.stock > 0 ? 0x00FF00 : 0xFF0000)
        .setFooter({ text: `Product ${index + 1} of ${products.length}` });

      embeds.push(embed);
    });

    // Create action row with navigation buttons for multiple products
    const mainActionRow = new ActionRowBuilder<MessageActionRowComponentBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('buy_btn:multi')
          .setLabel('🛒 Buy Product')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('payment_btn')
          .setLabel('💰 Payment Methods')
          .setStyle(ButtonStyle.Primary)
      );

    components.push(mainActionRow);

    return { embeds, components };
  }

  private static formatCategory(category: string): string {
    const categoryMap: { [key: string]: string } = {
      'digital-goods': 'Digital Goods',
      'game-codes': 'Game Codes',
      'discord-premium': 'Discord Premium',
      'artwork': 'Artwork',
      'software': 'Software',
      'other': 'Other'
    };
    return categoryMap[category] || category;
  }

  static createStockWarningEmbed(product: IProduct): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('⚠️ Product Out of Stock')
      .setDescription(`**${product.name}** is currently out of stock.`)
      .setColor(0xFFA500)
      .setTimestamp();
  }
}