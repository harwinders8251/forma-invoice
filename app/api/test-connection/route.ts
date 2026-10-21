import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const startTime = Date.now();
  try {
    const { data, error } = await supabase.from("_test_connection_").select("*").limit(1);
    const latency = Date.now() - startTime;

    // Supabase will respond with PGRST205 or similar if table doesn't exist, which confirms handshake & auth
    const isConnected = !error || error.code === "PGRST205" || error.message?.includes("schema cache");

    return NextResponse.json({
      status: isConnected ? "connected" : "error",
      message: isConnected ? "Supabase se connection successfully establish ho gaya hai!" : error?.message,
      latencyMs: latency,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      details: error ? { code: error.code, note: "Server reached. Table creation pending." } : { data },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        status: "failed",
        error: message,
      },
      { status: 500 }
    );
  }
}
