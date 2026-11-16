import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/server/supabase";


export async function GET() {
  try {
    const supabase = getSupabaseClient();

    // Run a tiny query just to confirm the database responds
    const { error } = await supabase
      .from("sessions")
      .select("id")
      .limit(1);

    if (error) {
      return NextResponse.json(
        { status: "error", message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}