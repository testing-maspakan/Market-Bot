import { NextRequest } from "next/server";
import { WebSocketServer } from "ws";
import { connectToDatabase } from "@/lib/mongodb";

// Global WebSocket server instance
declare global {
  var wss: WebSocketServer | undefined;
}

export async function GET(request: NextRequest) {
  // This route enables WebSocket upgrade handling
  if (!global.wss) {
    initializeWebSocketServer();
  }
  
  return new Response("WebSocket endpoint ready", { status: 200 });
}

function initializeWebSocketServer() {
  const wss = new WebSocketServer({ noServer: true });
  global.wss = wss;
  
  const clients = new Set();

  wss.on("connection", function connection(ws) {
    console.log("New WebSocket connection established");
    clients.add(ws);
    
    ws.send(JSON.stringify({
      type: "CONNECTION_ESTABLISHED",
      timestamp: Date.now()
    }));

    // Handle messages from clients (bot)
    ws.on("message", function message(data) {
      try {
        const parsed = JSON.parse(data.toString());
        console.log("Received WebSocket message:", parsed.type);
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    });

    ws.on("close", () => {
      console.log("WebSocket connection closed");
      clients.delete(ws);
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      clients.delete(ws);
    });
  });

  // Start MongoDB Change Streams
  startChangeStreams(wss);
}

async function startChangeStreams(wss: WebSocketServer) {
  try {
    await connectToDatabase();
    const db = (await connectToDatabase()).connection.db;
    const productCollection = db.collection("products");
    
    const changeStream = productCollection.watch(
      [
        {
          $match: {
            $or: [
              { operationType: "insert" },
              { operationType: "update" },
              { operationType: "delete" },
              { 
                "updateDescription.updatedFields": {
                  $in: ["stock", "price", "isActive"]
                }
              }
            ]
          }
        }
      ],
      { fullDocument: "updateLookup" }
    );

    changeStream.on("change", (change) => {
      console.log("Product change detected:", change.operationType);
      
      // Broadcast to all connected WebSocket clients
      broadcastToClients(wss, {
        type: "PRODUCT_UPDATE",
        operation: change.operationType,
        data: change.fullDocument || change.documentKey,
        timestamp: Date.now()
      });
    });

    changeStream.on("error", (error) => {
      console.error("Change stream error:", error);
    });

    console.log("MongoDB Change Streams activated for products");
  } catch (error) {
    console.error("Failed to start change streams:", error);
  }
}

function broadcastToClients(wss: WebSocketServer, message: any) {
  const messageStr = JSON.stringify(message);
  
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN state
      client.send(messageStr);
    }
  });
}