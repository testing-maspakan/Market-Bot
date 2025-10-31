import { Client, GatewayIntentBits, Partials, Events, Collection } from 'discord.js';
import { WebSocketManager } from './modules/real-time/WebSocketManager';
import { ProductManager } from './modules/real-time/ProductManager';
import { ChannelManager } from './modules/real-time/ChannelManager';
import { TicketSystem } from './modules/tickets/TicketSystem';
import { PurchaseFlow } from './modules/tickets/PurchaseFlow';
import { PaymentManager } from './modules/payments/PaymentManager';

class DiscordBot {
  private client: Client;
  private channelManager: ChannelManager;
  private productManager: ProductManager;
  private webSocketManager: WebSocketManager;
  private ticketSystem: TicketSystem;
  private purchaseFlow: PurchaseFlow;
  private paymentManager: PaymentManager;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
      ],
      partials: [Partials.Channel, Partials.Message]
    });

    // Initialize managers
    this.channelManager = new ChannelManager(this.client);
    this.productManager = new ProductManager(this.channelManager);
    this.webSocketManager = new WebSocketManager(
      this.client, 
      this.productManager, 
      this.channelManager
    );
    this.ticketSystem = new TicketSystem(this.client);
    this.purchaseFlow = new PurchaseFlow(this.ticketSystem, this.productManager);
    this.paymentManager = new PaymentManager();

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.once(Events.ClientReady, () => {
      console.log(`🤖 Logged in as ${this.client.user?.tag}`);
      this.initializeSystems();
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isButton()) {
        await this.handleButtonInteraction(interaction);
      }
      
      if (interaction.isStringSelectMenu()) {
        await this.handleSelectMenuInteraction(interaction);
      }
      
      if (interaction.isModalSubmit()) {
        await this.handleModalSubmit(interaction);
      }
    });

    this.client.on(Events.Error, (error) => {
      console.error('❌ Discord client error:', error);
    });
  }

  private async handleButtonInteraction(interaction: any) {
    try {
      if (interaction.customId.startsWith('buy_btn:')) {
        await this.purchaseFlow.handleBuyButton(interaction);
      } 
      else if (interaction.customId === 'payment_btn') {
        await this.paymentManager.handlePaymentButton(interaction);
      }
      else if (interaction.customId === 'payment_back') {
        await this.paymentManager.handlePaymentButton(interaction);
      }
      else if (interaction.customId === 'payment_instructions') {
        await this.paymentManager.handlePaymentButton(interaction);
      }
      else if (interaction.customId.startsWith('refresh_btn:')) {
        await interaction.deferUpdate();
        await this.productManager.pollForUpdates();
        await interaction.editReply({ content: '✅ Product information refreshed!' });
      }
    } catch (error) {
      console.error('❌ Error handling button interaction:', error);
    }
  }

  private async handleSelectMenuInteraction(interaction: any) {
    try {
      if (interaction.customId === 'payment_method_select') {
        await this.paymentManager.handlePaymentMethodSelect(interaction);
      }
    } catch (error) {
      console.error('❌ Error handling select menu interaction:', error);
    }
  }

  private async handleModalSubmit(interaction: any) {
    try {
      if (interaction.customId === 'payment_proof_modal') {
        // Handle payment proof submission
        const transactionId = interaction.fields.getTextInputValue('transaction_id');
        const amountPaid = interaction.fields.getTextInputValue('amount_paid');
        const proofImageUrl = interaction.fields.getTextInputValue('proof_image_url');
        
        // Process payment proof...
        await interaction.reply({ 
          content: '✅ Payment proof submitted! An admin will verify your payment shortly.', 
          ephemeral: true 
        });
      }
    } catch (error) {
      console.error('❌ Error handling modal submit:', error);
    }
  }

  private async initializeSystems() {
    try {
      // Initialize product cache
      await this.productManager.initializeProductCache();
      
      // Connect to WebSocket for real-time updates
      await this.webSocketManager.connect();
      
      // Set up ticket category if configured
      if (process.env.TICKET_CATEGORY_ID) {
        this.ticketSystem.setTicketCategory(process.env.TICKET_CATEGORY_ID);
      }
      
      console.log('✅ All systems initialized successfully');
      
    } catch (error) {
      console.error('❌ Error initializing systems:', error);
    }
  }

  public async start() {
    try {
      await this.client.login(process.env.DISCORD_BOT_TOKEN);
      console.log('🚀 Discord bot started successfully');
    } catch (error) {
      console.error('❌ Failed to start Discord bot:', error);
      process.exit(1);
    }
  }

  public async stop() {
    this.webSocketManager.disconnect();
    this.client.destroy();
    console.log('🛑 Discord bot stopped');
  }
}

// Start the bot
const bot = new DiscordBot();
bot.start();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down...');
  await bot.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down...');
  await bot.stop();
  process.exit(0);
});