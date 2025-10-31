import { Schema, model, models, Document } from 'mongoose';

export type PaymentMethodType = 'bank' | 'ewallet' | 'qris' | 'crypto';

export interface IBankDetails {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  branch?: string;
}

export interface IEWalletDetails {
  provider: string; // Gopay, OVO, Dana, etc
  phoneNumber: string;
  accountName?: string;
}

export interface IQRISDetails {
  qrCodeUrl: string;
  merchantName: string;
}

export interface ICryptoDetails {
  network: string; // Bitcoin, Ethereum, etc
  walletAddress: string;
  qrCodeUrl?: string;
}

export interface IPaymentMethod extends Document {
  // UUID Identifier
  methodId: string;
  
  // Core Information
  name: string;
  type: PaymentMethodType;
  
  // Flexible Details based on type
  details: IBankDetails | IEWalletDetails | IQRISDetails | ICryptoDetails;
  
  // User Instructions
  instructions: string;
  
  // Configuration & Limits
  processingFee: number; // Percentage or fixed amount
  minimumAmount: number;
  maximumAmount: number;
  
  // Status & Activation
  isActive: boolean;
  order: number; // For display ordering
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
}

const PaymentMethodSchema = new Schema<IPaymentMethod>({
  // UUID for external references
  methodId: {
    type: String,
    required: true,
    unique: true,
    default: () => `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  
  // Core Information
  name: {
    type: String,
    required: [true, 'Payment method name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  type: {
    type: String,
    required: [true, 'Payment method type is required'],
    enum: ['bank', 'ewallet', 'qris', 'crypto'],
    index: true
  },
  
  // Flexible Details Schema
  details: {
    type: Schema.Types.Mixed,
    required: [true, 'Payment details are required'],
    validate: {
      validator: function(details: any) {
        // Type-specific validation
        switch (this.type) {
          case 'bank':
            return details.bankName && details.accountNumber && details.accountHolder;
          case 'ewallet':
            return details.provider && details.phoneNumber;
          case 'qris':
            return details.qrCodeUrl && details.merchantName;
          case 'crypto':
            return details.network && details.walletAddress;
          default:
            return false;
        }
      },
      message: 'Invalid details structure for payment method type'
    }
  },
  
  // User Instructions
  instructions: {
    type: String,
    required: [true, 'Payment instructions are required'],
    maxlength: [1000, 'Instructions cannot exceed 1000 characters']
  },
  
  // Configuration & Limits
  processingFee: {
    type: Number,
    default: 0,
    min: [0, 'Processing fee cannot be negative']
  },
  minimumAmount: {
    type: Number,
    default: 0,
    min: [0, 'Minimum amount cannot be negative']
  },
  maximumAmount: {
    type: Number,
    default: 1000000000, // 1 billion default
    min: [0, 'Maximum amount cannot be negative']
  },
  
  // Status & Activation
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  order: {
    type: Number,
    default: 0,
    min: [0, 'Order cannot be negative']
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      // Hide sensitive details in some contexts
      if (ret.details && ret.type === 'bank') {
        ret.details.accountNumber = `***${ret.details.accountNumber.slice(-4)}`;
      }
      if (ret.details && ret.type === 'ewallet') {
        ret.details.phoneNumber = `***${ret.details.phoneNumber.slice(-4)}`;
      }
      return ret;
    }
  }
});

// Virtual for display name with type
PaymentMethodSchema.virtual('displayName').get(function(this: IPaymentMethod) {
  return `${this.name} (${this.type.toUpperCase()})`;
});

// Virtual for calculating final amount with fees
PaymentMethodSchema.virtual('calculateFinalAmount').get(function(this: IPaymentMethod) {
  return function(amount: number) {
    const fee = this.processingFee / 100 * amount;
    return Math.ceil(amount + fee);
  };
});

// Indexes for payment method management
PaymentMethodSchema.index({ isActive: 1, order: 1 }); // Active methods in order
PaymentMethodSchema.index({ type: 1, isActive: 1 }); // Filter by type

// Static method to get active payment methods ordered
PaymentMethodSchema.statics.getActiveMethods = function() {
  return this.find({ isActive: true })
    .sort({ order: 1, name: 1 })
    .lean();
};

// Instance method to validate amount against limits
PaymentMethodSchema.methods.validateAmount = function(amount: number) {
  return amount >= this.minimumAmount && amount <= this.maximumAmount;
};

// Pre-save middleware to validate details structure
PaymentMethodSchema.pre('save', function(next) {
  if (this.isModified('details') && !this.details) {
    return next(new Error('Payment details are required'));
  }
  next();
});

export default models?.PaymentMethod || model<IPaymentMethod>('PaymentMethod', PaymentMethodSchema);