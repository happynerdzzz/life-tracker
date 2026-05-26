import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind");
  const supabase = createServerClient();
  let query = supabase.from("categories").select("id, name, kind").order("name");
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("categories")
    .upsert({ name: body.name, kind: body.kind }, { onConflict: "name,kind" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
