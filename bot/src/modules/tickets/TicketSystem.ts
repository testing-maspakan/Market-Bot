import { 
  Client, 
  Guild, 
  User, 
  TextChannel, 
  ChannelType, 
  OverwriteResolvable, 
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { IProduct } from '../../../../shared/schemas/product';

export class TicketSystem {
  private client: Client;
  private ticketCategoryId: string | null = null;

  constructor(client: Client) {
    this.client = client;
  }

  setTicketCategory(categoryId: string) {
    this.ticketCategoryId = categoryId;
  }

  async createPurchaseTicket(user: User, product: IProduct): Promise<TextChannel> {
    const guild = this.findUserGuild(user);
    if (!guild) {
      throw new Error('User not found in any guild');
    }

    // Generate channel name
    const channelName = this.generateChannelName(user, product);
    
    // Configure permissions
    const permissions = this.getChannelPermissions(user, guild);
    
    // Create the ticket channel
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: this.ticketCategoryId || undefined,
      permissionOverwrites: permissions,
      topic: `Purchase ticket for ${product.name} - User: ${user.tag} (${user.id}) - Product: ${product.productId}`
    });

    // Send initial guide
    await this.sendInitialGuide(channel, user, product);

    console.log(`✅ Created ticket channel: ${channel.name} for user: ${user.tag}`);
    
    return channel;
  }

  private findUserGuild(user: User): Guild | null {
    // Find the first guild where both bot and user are present
    for (const guild of this.client.guilds.cache.values()) {
      if (guild.members.cache.has(user.id)) {
        return guild;
      }
    }
    return null;
  }

  private generateChannelName(user: User, product: IProduct): string {
    const username = user.username.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
    const productName = product.name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15);
    return `ticket-${username}-${productName}-${Date.now().toString().slice(-4)}`;
  }

  private getChannelPermissions(user: User, guild: Guild): OverwriteResolvable[] {
    const permissions: OverwriteResolvable[] = [
      {
        id: guild.id, // @everyone
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: user.id, // Purchasing user
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles
        ]
      },
      {
        id: this.client.user!.id, // Bot itself
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles
        ]
      }
    ];

    // Add admin role if configured
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    if (adminRoleId) {
      permissions.push({
        id: adminRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages
        ]
      });
    }

    return permissions;
  }

  private async sendInitialGuide(channel: TextChannel, user: User, product: IProduct) {
    const welcomeEmbed = new EmbedBuilder()
      .setTitle(`🎫 Purchase Ticket: ${product.name}`)
      .setDescription(`Hello ${user}, thank you for your interest in **${product.name}**!`)
      .addFields(
        { 
          name: '📦 Product Details', 
          value: `**Name:** ${product.name}\n**Price:** $${product.price}\n**Category:** ${product.category}` 
        },
        { 
          name: '🛒 Next Steps', 
          value: '1. Click the "Payment Methods" button below to see available payment options\n2. Make your payment according to the instructions\n3. Upload your payment proof in this channel\n4. Wait for admin verification\n5. Receive your digital product!' 
        }
      )
      .setColor(0x0099FF)
      .setTimestamp();

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('payment_instructions')
          .setLabel('💰 Payment Methods')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('🔒 Close Ticket')
          .setStyle(ButtonStyle.Danger)
      );

    await channel.send({ 
      content: `${user} <@&${process.env.ADMIN_ROLE_ID || ''}>`,
      embeds: [welcomeEmbed], 
      components: [actionRow] 
    });
  }

  async closeTicket(channel: TextChannel, reason: string = 'No reason provided') {
    try {
      const closeEmbed = new EmbedBuilder()
        .setTitle('🔒 Ticket Closed')
        .setDescription(`This ticket has been closed.\n**Reason:** ${reason}`)
        .setColor(0xFF0000)
        .setTimestamp();

      await channel.send({ embeds: [closeEmbed] });
      
      // Delete channel after delay
      setTimeout(async () => {
        try {
          await channel.delete('Ticket closed by system');
        } catch (error) {
          console.error('❌ Error deleting ticket channel:', error);
        }
      }, 5000); // 5-second delay

    } catch (error) {
      console.error('❌ Error closing ticket:', error);
      throw error;
    }
  }

  async archiveTicket(channel: TextChannel) {
    try {
      // Implement ticket archiving logic here
      // This could export chat history, update database, etc.
      console.log(`📁 Archiving ticket: ${channel.name}`);
      
      // For now, just rename the channel
      await channel.setName(`archived-${channel.name}`);
      
    } catch (error) {
      console.error('❌ Error archiving ticket:', error);
    }
  }
}