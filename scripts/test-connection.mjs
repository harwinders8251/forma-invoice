import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Load .env or .env.local
const envPath = fs.existsSync(path.resolve(process.cwd(), ".env.local"))
  ? path.resolve(process.cwd(), ".env.local")
  : path.resolve(process.cwd(), ".env");

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...rest] = trimmed.split("=");
      if (key && rest.length > 0) {
        process.env[key.trim()] = rest.join("=").trim();
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

console.log("\n============================================");
console.log("🔍 Checking Supabase Connection...");
console.log("============================================");
console.log("Supabase URL:", supabaseUrl);
console.log("Key Prefix  :", supabaseKey ? supabaseKey.slice(0, 16) + "..." : "MISSING");

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Error: Supabase URL or Publishable Key is missing in .env / .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConnection() {
  try {
    // Attempting a simple query or health check ping
    const startTime = Date.now();
    const { data, error } = await supabase.from("_test_connection_").select("*").limit(1);
    const latency = Date.now() - startTime;

    // In Supabase, if table doesn't exist, it returns code PGRST205 (relation does not exist)
    // This confirms the connection, authentication, and network handshake are 100% successful.
    if (error && error.code === "PGRST205") {
      console.log(`\n✅ Connection Successful! (${latency}ms)`);
      console.log(" Supabase server ne successfully respond kiya.");
      console.log(" Note: Abhi database mein tables create karni baaki hain.");
    } else if (error && (error.code === "42P01" || error.message?.includes("relation") || error.message?.includes("schema cache"))) {
      console.log(`\n✅ Connection Successful! (${latency}ms)`);
      console.log(" Supabase server ne successfully respond kiya.");
    } else if (error) {
      console.log("\n⚠️ Supabase se response mila, lekin error hai:");
      console.log("Code:", error.code);
      console.log("Message:", error.message);
    } else {
      console.log(`\n✅ Connection Successful! (${latency}ms)`);
      console.log(" Data fetched successfully:", data);
    }
    console.log("============================================\n");
  } catch (err) {
    console.error("\n❌ Network connection failed:", err.message || err);
    console.log("============================================\n");
  }
}

checkConnection();
