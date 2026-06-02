import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const type = searchParams.get("type");

  const supabase = createServerClient();

  if (from && to) {
    let q = supabase
      .from("entries")
      .select("*")
      .gte("entry_date", from)
      .lte("entry_date", to)
      .order("entry_date", { ascending: true })
      .order("created_at", { ascending: true });
    if (type) q = q.eq("type", type);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (!date) {
    return NextResponse.json({ error: "date or from+to required" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .eq("entry_date", date)
    .order("entry_time", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("entries")
    .insert(body)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // fire-and-forget streak recompute
  const base = req.nextUrl.origin;
  fetch(`${base}/api/streaks`, { method: "POST" }).catch(() => {});
  return NextResponse.json(data, { status: 201 });
}
