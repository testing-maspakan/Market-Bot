import mongoose from 'mongoose';
import { webSocketManager } from '../../dashboard/lib/websocket-server';

export const setupChangeStreams = async () => {
  const db = mongoose.connection.db;
  
  if (!db) {
    throw new Error('Database not connected');
  }

  // Product Change Stream (Primary Real-time Trigger)
  const productCollection = db.collection('products');
  const productChangeStream = productCollection.watch(
    [
      {
        $match: {
          $or: [
            { 'operationType': 'insert' },
            { 'operationType': 'update' },
            { 'operationType': 'delete' },
            { 
              'updateDescription.updatedFields': {
                $in: ['stock', 'price', 'isActive', 'lastUpdated']
              }
            }
          ]
        }
      }
    ],
    {
      fullDocument: 'updateLookup',
      maxAwaitTimeMS: 5000, // 5 second batch window
      batchSize: 100
    }
  );

  productChangeStream.on('change', (change) => {
    console.log(`🔄 Product Change Stream: ${change.operationType}`);
    
    // Broadcast to all connected WebSocket clients
    webSocketManager.broadcast({
      type: 'PRODUCT_UPDATE',
      operation: change.operationType,
      data: change.fullDocument || change.documentKey,
      timestamp: Date.now()
    });

    // Specific broadcast to Discord bots
    webSocketManager.broadcastToType('bot', {
      type: 'PRODUCT_UPDATE_REQUIRED',
      productId: change.fullDocument?.productId || change.documentKey._id,
      operation: change.operationType,
      criticalFields: ['stock', 'price', 'isActive']
    });
  });

  // Ticket Change Stream for Admin Dashboard Updates
  const ticketCollection = db.collection('tickets');
  const ticketChangeStream = ticketCollection.watch(
    [
      {
        $match: {
          $or: [
            { 'operationType': 'insert' },
            { 'operationType': 'update' },
            {
              'updateDescription.updatedFields.status': { $exists: true }
            }
          ]
        }
      }
    ],
    {
      fullDocument: 'updateLookup',
      maxAwaitTimeMS: 3000
    }
  );

  ticketChangeStream.on('change', (change) => {
    console.log(`🎫 Ticket Change Stream: ${change.operationType}`);
    
    webSocketManager.broadcastToType('dashboard', {
      type: 'TICKET_UPDATE',
      operation: change.operationType,
      data: change.fullDocument,
      timestamp: Date.now()
    });
  });

  // Error handling
  productChangeStream.on('error', (error) => {
    console.error('❌ Product Change Stream Error:', error);
  });

  ticketChangeStream.on('error', (error) => {
    console.error('❌ Ticket Change Stream Error:', error);
  });

  console.log('👂 MongoDB Change Streams activated for real-time updates');
};