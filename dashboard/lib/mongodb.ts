import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongoose || {
  conn: null,
  promise: null,
};

if (!global.mongoose) {
  global.mongoose = cached;
}

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts);
  }

  try {
    cached.conn = await cached.promise;
    
    // Setup change streams after connection
    await setupChangeStreams();
    
    console.log('✅ MongoDB connected successfully');
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
}

// Change Streams Implementation
async function setupChangeStreams() {
  const db = mongoose.connection.db;
  
  // Watch products collection for real-time updates
  const productCollection = db.collection('products');
  const productChangeStream = productCollection.watch(
    [
      { 
        $match: { 
          'operationType': { $in: ['insert', 'update', 'delete'] },
          'updateDescription.updatedFields': { $exists: true }
        } 
      }
    ],
    { 
      fullDocument: 'updateLookup',
      maxAwaitTimeMS: 5000 // 5 second batch window
    }
  );

  productChangeStream.on('change', (change) => {
    console.log('🔄 Product change detected:', change.operationType);
    
    // Broadcast to WebSocket clients
    broadcastToWebSocketClients({
      type: 'PRODUCT_UPDATE',
      operation: change.operationType,
      data: change.fullDocument || change.documentKey
    });
  });

  productChangeStream.on('error', (error) => {
    console.error('❌ Change stream error:', error);
  });

  console.log('👂 MongoDB Change Streams activated for products collection');
}

// WebSocket broadcast function (will be implemented in next section)
function broadcastToWebSocketClients(message: any) {
  // Implementation in next section
}