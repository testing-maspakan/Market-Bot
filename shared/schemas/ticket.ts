import { Schema, model, models, Document, Types } from 'mongoose';

export type TicketStatus = 'open' | 'pending_verification' | 'paid' | 'completed' | 'closed' | 'cancelled';

export interface ITransactionLog {
  action: string;
  timestamp: Date;
  performedBy: string; // Discord User ID
  details?: any;
  note?: string;
}

export interface ITicket extends Document {
  // UUID Identifier
  ticketId: string;
  
  // User & Product Information
  userId: string; // Discord User ID of buyer
  productId: Types.ObjectId; // Reference to Product
  productSnapshot: {
    name: string;
    price: number;
    imageUrl: string;
  }; // Product data at time of purchase
  
  // Discord Channel Management
  channelId: string; // Discord channel ID for this ticket
  sellerId?: string; // Discord User ID of assigned seller/admin
  
  // Payment & Status
  status: TicketStatus;
  paymentMethodUsed: string; // Reference to PaymentMethod methodId
  totalAmount: number;
  
  // Manual Verification System
  paymentProofUrl: string; // URL to uploaded payment proof
  verifiedBy?: string; // Discord User ID of admin who verified
  verifiedAt?: Date;
  
  // Transaction Audit Log
  transactionLog: ITransactionLog[];
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  autoCloseAt?: Date; // Scheduled auto-close timestamp
}

const TicketSchema = new Schema<ITicket>({
  // UUID for external references
  ticketId: {
    type: String,
    required: true,
    unique: true,
    default: () => `tkt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  
  // User & Product Information
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    index: true
  },
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product reference is required'],
    index: true
  },
  productSnapshot: {
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    imageUrl: {
      type: String,
      required: true
    }
  },
  
  // Discord Channel Management
  channelId: {
    type: String,
    required: [true, 'Discord channel ID is required'],
    unique: true,
    index: true
  },
  sellerId: {
    type: String,
    ref: 'User', // Reference to Discord user (seller/admin)
    index: true
  },
  
  // Payment & Status
  status: {
    type: String,
    enum: ['open', 'pending_verification', 'paid', 'completed', 'closed', 'cancelled'],
    default: 'open',
    index: true
  },
  paymentMethodUsed: {
    type: String,
    required: [true, 'Payment method is required'],
    ref: 'PaymentMethod' // Reference to PaymentMethod methodId
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  
  // Manual Verification System
  paymentProofUrl: {
    type: String,
    required: [true, 'Payment proof is required'],
    validate: {
      validator: function(url: string) {
        return /^https?:\/\/.+\..+/.test(url) || url.startsWith('/uploads/');
      },
      message: 'Please provide a valid payment proof URL'
    }
  },
  verifiedBy: {
    type: String,
    ref: 'User'
  },
  verifiedAt: {
    type: Date
  },
  
  // Transaction Audit Log
  transactionLog: [{
    action: {
      type: String,
      required: true,
      enum: [
        'ticket_created',
        'payment_uploaded',
        'payment_verified',
        'product_delivered',
        'status_changed',
        'admin_note',
        'ticket_closed',
        'ticket_reopened'
      ]
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    performedBy: {
      type: String,
      required: true
    },
    details: Schema.Types.Mixed, // Flexible details object
    note: String
  }],
  
  // Auto-close scheduling
  autoCloseAt: {
    type: Date,
    default: function() {
      // Auto-close 24 hours after creation if not completed
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
    },
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for ticket age
TicketSchema.virtual('ageInHours').get(function(this: ITicket) {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60));
});

// Virtual for isOverdue (past autoCloseAt)
TicketSchema.virtual('isOverdue').get(function(this: ITicket) {
  return this.autoCloseAt && new Date() > this.autoCloseAt && 
         ['open', 'pending_verification'].includes(this.status);
});

// Compound indexes for optimized ticket management
TicketSchema.index({ userId: 1, status: 1 }); // User's tickets
TicketSchema.index({ status: 1, createdAt: -1 }); // Ticket queue management
TicketSchema.index({ status: 1, autoCloseAt: 1 }); // Auto-close queries
TicketSchema.index({ sellerId: 1, status: 1 }); // Seller's assigned tickets
TicketSchema.index({ 'productSnapshot.name': 'text' }); // Text search

// Pre-save middleware to set closedAt when status changes to closed/completed
TicketSchema.pre('save', function(next) {
  if (this.isModified('status') && 
      ['completed', 'closed', 'cancelled'].includes(this.status) && 
      !this.closedAt) {
    this.closedAt = new Date();
  }
  
  // Add to transaction log on status changes
  if (this.isModified('status') && this.transactionLog) {
    this.transactionLog.push({
      action: 'status_changed',
      timestamp: new Date(),
      performedBy: 'system', // or actual user if available
      details: {
        from: this.previous('status'),
        to: this.status
      }
    });
  }
  
  next();
});

// Static method for finding tickets needing auto-close
TicketSchema.statics.findOverdueTickets = function() {
  return this.find({
    status: { $in: ['open', 'pending_verification'] },
    autoCloseAt: { $lte: new Date() }
  });
};

// Instance method for adding transaction log entry
TicketSchema.methods.addTransactionLog = function(
  action: string, 
  performedBy: string, 
  details?: any, 
  note?: string
) {
  this.transactionLog.push({
    action,
    timestamp: new Date(),
    performedBy,
    details,
    note
  });
  return this.save();
};

export default models?.Ticket || model<ITicket>('Ticket', TicketSchema);