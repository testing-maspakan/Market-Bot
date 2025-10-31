import { Schema, model, models, Document, Types } from 'mongoose';

export interface IProduct extends Document {
  // UUID Identifier
  productId: string;
  
  // Core Product Information
  name: string;
  description: string;
  price: number;
  stock: number;
  
  // Media & Presentation
  imageUrl: string;
  threeJsModelUrl?: string; // Optional 3D model for premium experience
  
  // Categorization & Organization
  category: string;
  tags: string[];
  
  // Digital Product Delivery
  digitalFileUrl?: string;
  discordRoleId?: string; // Optional role to grant upon purchase
  
  // Status & Activation
  isActive: boolean;
  featured: boolean;
  
  // Real-time Critical Fields (Change Stream Triggers)
  lastUpdated: Date;
  
  // Audit & Metadata
  createdBy: string; // Discord User ID of seller/admin
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>({
  // UUID for external references
  productId: {
    type: String,
    required: true,
    unique: true,
    default: () => `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  
  // Core Product Information
  name: {
    type: String,
    required: [true, 'Product name is required'],
    maxlength: [100, 'Product name cannot exceed 100 characters'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0, 'Price cannot be negative'],
    validate: {
      validator: function(value: number) {
        return value % 1 === 0 || value.toString().split('.')[1]?.length <= 2;
      },
      message: 'Price must have at most 2 decimal places'
    }
  },
  stock: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock cannot be negative'],
    // Stock changes trigger real-time updates
    index: true
  },
  
  // Media & Presentation
  imageUrl: {
    type: String,
    required: [true, 'Product image is required'],
    validate: {
      validator: function(url: string) {
        return /^https?:\/\/.+\..+/.test(url);
      },
      message: 'Please provide a valid image URL'
    }
  },
  threeJsModelUrl: {
    type: String,
    validate: {
      validator: function(url: string) {
        if (!url) return true; // Optional field
        return /^https?:\/\/.+\..+/.test(url);
      },
      message: 'Please provide a valid 3D model URL'
    }
  },
  
  // Categorization
  category: {
    type: String,
    required: [true, 'Product category is required'],
    enum: [
      'digital-goods', 
      'game-codes', 
      'discord-premium', 
      'artwork', 
      'software',
      'other'
    ],
    index: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  
  // Digital Delivery
  digitalFileUrl: {
    type: String,
    validate: {
      validator: function(url: string) {
        if (!url) return true; // Optional for physical goods
        return /^https?:\/\/.+\..+/.test(url);
      },
      message: 'Please provide a valid digital file URL'
    }
  },
  discordRoleId: {
    type: String,
    // Optional: role to grant upon purchase completion
  },
  
  // Status & Activation
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  
  // Real-time Critical Fields
  lastUpdated: {
    type: Date,
    default: Date.now,
    index: -1 // Descending index for efficient change detection
  },
  
  // Audit Trail
  createdBy: {
    type: String,
    required: true,
    ref: 'User' // Reference to Discord user
  }
}, {
  timestamps: true, // Auto-manages createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for product availability
ProductSchema.virtual('isAvailable').get(function(this: IProduct) {
  return this.isActive && this.stock > 0;
});

// Compound indexes for optimized queries
ProductSchema.index({ isActive: 1, stock: -1 }); // Active products with stock
ProductSchema.index({ category: 1, isActive: 1 }); // Category browsing
ProductSchema.index({ featured: -1, createdAt: -1 }); // Featured products
ProductSchema.index({ lastUpdated: -1 }); // Change stream optimization

// Pre-save middleware to update lastUpdated on critical field changes
ProductSchema.pre('save', function(next) {
  if (this.isModified('price') || this.isModified('stock') || this.isModified('isActive')) {
    this.lastUpdated = new Date();
  }
  next();
});

// Static method for real-time change detection
ProductSchema.statics.findRecentlyUpdated = function(hours = 24) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.find({ 
    lastUpdated: { $gte: cutoff },
    isActive: true 
  });
};

export default models?.Product || model<IProduct>('Product', ProductSchema);