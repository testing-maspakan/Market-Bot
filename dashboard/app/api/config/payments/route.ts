import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { connectToDatabase } from "@/lib/mongodb";

// Payment configuration schema
interface PaymentConfig {
  bank_transfer: {
    bca: { account_number: string; account_name: string };
    bni: { account_number: string; account_name: string };
  };
  ewallet: {
    gopay: { number: string; instructions: string };
    ovo: { number: string; instructions: string };
  };
  qris: { image_url: string };
}

const COLLECTION_NAME = "payment_configs";

// GET - Retrieve payment configuration
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToDatabase();
    const db = (await connectToDatabase()).connection.db;
    const collection = db.collection(COLLECTION_NAME);
    
    const config = await collection.findOne({ type: "payment_methods" });
    
    return NextResponse.json({ 
      success: true, 
      data: config || getDefaultPaymentConfig() 
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST/PUT - Update payment configuration
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToDatabase();
    const db = (await connectToDatabase()).connection.db;
    const collection = db.collection(COLLECTION_NAME);
    
    const config: PaymentConfig = await request.json();
    
    // Validate required structure
    if (!validatePaymentConfig(config)) {
      return NextResponse.json(
        { success: false, error: "Invalid payment configuration structure" },
        { status: 400 }
      );
    }

    // Upsert configuration
    await collection.updateOne(
      { type: "payment_methods" },
      { 
        $set: { 
          ...config, 
          updatedAt: new Date(), 
          updatedBy: session.user.id 
        } 
      },
      { upsert: true }
    );

    return NextResponse.json({ 
      success: true, 
      message: "Payment configuration updated successfully" 
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

function getDefaultPaymentConfig(): PaymentConfig {
  return {
    bank_transfer: {
      bca: { account_number: "", account_name: "" },
      bni: { account_number: "", account_name: "" }
    },
    ewallet: {
      gopay: { number: "", instructions: "" },
      ovo: { number: "", instructions: "" }
    },
    qris: { image_url: "" }
  };
}

function validatePaymentConfig(config: any): config is PaymentConfig {
  return (
    config &&
    config.bank_transfer &&
    config.ewallet &&
    config.qris &&
    typeof config.bank_transfer.bca.account_number === "string" &&
    typeof config.bank_transfer.bca.account_name === "string"
  );
}