import { 
  ButtonInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';

interface PaymentConfig {
  bank_transfer: {
    bca: { account_number: string; account_name: string };
    bni: { account_number: string; account_name: string };
    [key: string]: any;
  };
  ewallet: {
    gopay: { number: string; instructions: string };
    ovo: { number: string; instructions: string };
    [key: string]: any;
  };
  qris: { image_url: string };
  crypto?: {
    bitcoin?: { address: string; instructions: string };
    ethereum?: { address: string; instructions: string };
    [key: string]: any;
  };
}

export class PaymentManager {
  private paymentConfig: PaymentConfig | null = null;
  private lastFetch: number = 0;
  private cacheDuration: number = 300000; // 5 minutes

  async getPaymentConfig(): Promise<PaymentConfig> {
    // Return cached config if still valid
    if (this.paymentConfig && Date.now() - this.lastFetch < this.cacheDuration) {
      return this.paymentConfig;
    }

    try {
      const response = await fetch(`${process.env.DASHBOARD_URL}/api/config/payments`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        this.paymentConfig = result.data;
        this.lastFetch = Date.now();
        return this.paymentConfig;
      } else {
        throw new Error(result.error || 'Failed to fetch payment config');
      }
    } catch (error) {
      console.error('❌ Error fetching payment config:', error);
      
      // Return default empty config if fetch fails
      return this.getDefaultConfig();
    }
  }

  async handlePaymentButton(interaction: ButtonInteraction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const config = await this.getPaymentConfig();
      
      // Create payment method selection menu
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('payment_method_select')
        .setPlaceholder('Choose a payment method')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('Bank Transfer')
            .setValue('bank_transfer')
            .setDescription('BCA, BNI, and other bank transfers')
            .setEmoji('🏦'),
          new StringSelectMenuOptionBuilder()
            .setLabel('E-Wallet')
            .setValue('ewallet')
            .setDescription('Gopay, OVO, and other e-wallets')
            .setEmoji('📱'),
          new StringSelectMenuOptionBuilder()
            .setLabel('QRIS')
            .setValue('qris')
            .setDescription('Quick Response Code Indonesian Standard')
            .setEmoji('📲'),
          ...(config.crypto ? [
            new StringSelectMenuOptionBuilder()
              .setLabel('Cryptocurrency')
              .setValue('crypto')
              .setDescription('Bitcoin, Ethereum, and other crypto')
              .setEmoji('₿')
          ] : [])
        );

      const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(selectMenu);

      const embed = new EmbedBuilder()
        .setTitle('💰 Payment Methods')
        .setDescription('Please select your preferred payment method from the menu below to see detailed instructions.')
        .setColor(0x0099FF)
        .setTimestamp();

      await interaction.editReply({ 
        embeds: [embed], 
        components: [actionRow] 
      });

    } catch (error) {
      console.error('❌ Error handling payment button:', error);
      await interaction.editReply({ 
        content: '❌ Unable to fetch payment methods. Please try again later.' 
      });
    }
  }

  async handlePaymentMethodSelect(interaction: any) {
    try {
      await interaction.deferUpdate();
      
      const methodType = interaction.values[0];
      const config = await this.getPaymentConfig();
      
      let embed: EmbedBuilder;
      
      switch (methodType) {
        case 'bank_transfer':
          embed = this.createBankTransferEmbed(config.bank_transfer);
          break;
        case 'ewallet':
          embed = this.createEWalletEmbed(config.ewallet);
          break;
        case 'qris':
          embed = this.createQRISEmbed(config.qris);
          break;
        case 'crypto':
          embed = this.createCryptoEmbed(config.crypto || {});
          break;
        default:
          embed = new EmbedBuilder()
            .setTitle('❌ Invalid Selection')
            .setColor(0xFF0000);
      }

      const backButton = new ButtonBuilder()
        .setCustomId('payment_back')
        .setLabel('⬅ Back to Methods')
        .setStyle(ButtonStyle.Secondary);

      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(backButton);

      await interaction.editReply({ 
        embeds: [embed], 
        components: [actionRow] 
      });

    } catch (error) {
      console.error('❌ Error handling payment method select:', error);
    }
  }

  private createBankTransferEmbed(bankConfig: any): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('🏦 Bank Transfer')
      .setDescription('Please transfer to one of the following bank accounts:')
      .setColor(0x2B6CB0);

    for (const [bankName, details] of Object.entries(bankConfig)) {
      if (details && typeof details === 'object' && 'account_number' in details) {
        embed.addFields({
          name: `${bankName.toUpperCase()}`,
          value: `**Account Number:** ${details.account_number}\n**Account Name:** ${details.account_name}`,
          inline: false
        });
      }
    }

    embed.addFields({
      name: '📝 Important Instructions',
      value: '1. Include your Discord username in the transfer description\n2. Keep your payment proof/receipt\n3. Upload the proof in your purchase ticket\n4. Wait for admin verification',
      inline: false
    });

    return embed;
  }

  private createEWalletEmbed(ewalletConfig: any): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('📱 E-Wallet Payment')
      .setDescription('You can pay using the following e-wallets:')
      .setColor(0x38A169);

    for (const [walletName, details] of Object.entries(ewalletConfig)) {
      if (details && typeof details === 'object' && 'number' in details) {
        embed.addFields({
          name: `${this.formatWalletName(walletName)}`,
          value: `**Number:** ${details.number}\n**Instructions:** ${details.instructions || 'Standard transfer'}`,
          inline: false
        });
      }
    }

    return embed;
  }

  private createQRISEmbed(qrisConfig: any): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('📲 QRIS Payment')
      .setDescription('Scan the QR code below to make your payment:')
      .setColor(0x805AD5);

    if (qrisConfig.image_url) {
      embed.setImage(qrisConfig.image_url);
    }

    embed.addFields({
      name: '💡 How to Pay',
      value: '1. Open your banking/e-wallet app\n2. Tap "Scan QR" or "QRIS"\n3. Scan the QR code above\n4. Enter the payment amount\n5. Complete the transaction\n6. Save the payment confirmation',
      inline: false
    });

    return embed;
  }

  private createCryptoEmbed(cryptoConfig: any): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('₿ Cryptocurrency Payment')
      .setDescription('You can pay using the following cryptocurrencies:')
      .setColor(0xF6C343);

    for (const [cryptoName, details] of Object.entries(cryptoConfig)) {
      if (details && typeof details === 'object' && 'address' in details) {
        embed.addFields({
          name: `${this.formatCryptoName(cryptoName)}`,
          value: `**Address:** \`${details.address}\`\n**Instructions:** ${details.instructions || 'Send exact amount to this address'}`,
          inline: false
        });
      }
    }

    embed.addFields({
      name: '⚠️ Important Notes',
      value: '• Cryptocurrency payments may take time to confirm\n• Ensure you send the exact amount\n• Include your Discord username in the memo/message\n• Transaction fees are your responsibility',
      inline: false
    });

    return embed;
  }

  private formatWalletName(walletName: string): string {
    const nameMap: { [key: string]: string } = {
      'gopay': 'Gopay',
      'ovo': 'OVO',
      'dana': 'DANA',
      'linkaja': 'LinkAja',
      'shopeepay': 'ShopeePay'
    };
    return nameMap[walletName] || walletName.charAt(0).toUpperCase() + walletName.slice(1);
  }

  private formatCryptoName(cryptoName: string): string {
    const nameMap: { [key: string]: string } = {
      'bitcoin': 'Bitcoin (BTC)',
      'ethereum': 'Ethereum (ETH)',
      'usdt': 'Tether (USDT)',
      'usdc': 'USD Coin (USDC)'
    };
    return nameMap[cryptoName] || cryptoName.charAt(0).toUpperCase() + cryptoName.slice(1);
  }

  private getDefaultConfig(): PaymentConfig {
    return {
      bank_transfer: {
        bca: { account_number: '', account_name: '' },
        bni: { account_number: '', account_name: '' }
      },
      ewallet: {
        gopay: { number: '', instructions: '' },
        ovo: { number: '', instructions: '' }
      },
      qris: { image_url: '' }
    };
  }
}