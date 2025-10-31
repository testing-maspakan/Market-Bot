import mongoose from 'mongoose';

export const ensureIndexes = async () => {
  const Product = mongoose.model('Product');
  const Ticket = mongoose.model('Ticket');
  const PaymentMethod = mongoose.model('PaymentMethod');

  // Product indexes for real-time performance
  await Product.collection.createIndex({ lastUpdated: -1 });
  await Product.collection.createIndex({ isActive: 1, stock: -1 });
  await Product.collection.createIndex({ 'tags': 1 });
  
  // Ticket indexes for efficient querying
  await Ticket.collection.createIndex({ status: 1, createdAt: -1 });
  await Ticket.collection.createIndex({ autoCloseAt: 1 }, { 
    expireAfterSeconds: 0, // TTL index for auto-cleanup
    partialFilterExpression: { status: { $in: ['completed', 'closed', 'cancelled'] } }
  });
  
  // Payment method indexes
  await PaymentMethod.collection.createIndex({ isActive: 1, order: 1 });
  
  console.log('✅ Database indexes ensured for optimal real-time performance');
};