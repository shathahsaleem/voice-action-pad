import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Coming in Milestone 4" },
    { status: 501 }
  );
}