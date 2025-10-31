import { 
  ButtonInteraction, 
  User, 
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder as ModalActionRow
} from 'discord.js';
import { TicketSystem } from './TicketSystem';
import { ProductManager } from '../real-time/ProductManager';
import { IProduct } from '../../../../shared/schemas/product';

export class PurchaseFlow {
  private ticketSystem: TicketSystem;
  private productManager: ProductManager;

  constructor(ticketSystem: TicketSystem, productManager: ProductManager) {
    this.ticketSystem = ticketSystem;
    this.productManager = productManager;
  }

  async handleBuyButton(interaction: ButtonInteraction) {
    try {
      const productId = interaction.customId.split(':')[1];
      const product = this.productManager.getCachedProduct(productId);
      
      if (!product) {
        await interaction.reply({ 
          content: '❌ Product not found. Please try again later.', 
          ephemeral: true 
        });
        return;
      }

      // Check stock availability
      if (product.stock <= 0 || !product.isActive) {
        await interaction.reply({ 
          content: '❌ This product is currently out of stock.', 
          ephemeral: true 
        });
        return;
      }

      // Create purchase ticket
      await interaction.deferReply({ ephemeral: true });
      
      const ticketChannel = await this.ticketSystem.createPurchaseTicket(
        interaction.user, 
        product
      );

      // Send success message
      const successEmbed = new EmbedBuilder()
        .setTitle('✅ Purchase Ticket Created')
        .setDescription(`Your purchase ticket has been created: ${ticketChannel}`)
        .addFields(
          { name: 'Product', value: product.name },
          { name: 'Price', value: `$${product.price}` },
          { name: 'Next Steps', value: 'Please check the ticket channel for payment instructions.' }
        )
        .setColor(0x00FF00)
        .setTimestamp();

      await interaction.editReply({ 
        embeds: [successEmbed] 
      });

      // Log the purchase initiation
      console.log(`🛒 Purchase initiated by ${interaction.user.tag} for ${product.name}`);

    } catch (error) {
      console.error('❌ Error handling buy button:', error);
      
      await interaction.reply({ 
        content: '❌ An error occurred while creating your purchase ticket. Please try again later.', 
        ephemeral: true 
      });
    }
  }

  async handlePaymentProofUpload(interaction: ButtonInteraction) {
    try {
      // Create modal for payment proof details
      const modal = new ModalBuilder()
        .setCustomId('payment_proof_modal')
        .setTitle('Upload Payment Proof');

      const transactionIdInput = new TextInputBuilder()
        .setCustomId('transaction_id')
        .setLabel('Transaction ID / Reference')
        .setPlaceholder('Enter your transaction ID or reference number')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const amountPaidInput = new TextInputBuilder()
        .setCustomId('amount_paid')
        .setLabel('Amount Paid')
        .setPlaceholder('Enter the amount you paid')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const proofImageInput = new TextInputBuilder()
        .setCustomId('proof_image_url')
        .setLabel('Payment Proof Image URL')
        .setPlaceholder('Paste the URL of your payment proof screenshot')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const firstActionRow = new ModalActionRow<TextInputBuilder>().addComponents(transactionIdInput);
      const secondActionRow = new ModalActionRow<TextInputBuilder>().addComponents(amountPaidInput);
      const thirdActionRow = new ModalActionRow<TextInputBuilder>().addComponents(proofImageInput);

      modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

      await interaction.showModal(modal);

    } catch (error) {
      console.error('❌ Error handling payment proof upload:', error);
      await interaction.reply({ 
        content: '❌ An error occurred. Please try again.', 
        ephemeral: true 
      });
    }
  }
}