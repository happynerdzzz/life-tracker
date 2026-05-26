import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export type GoalRow = {
  id: string;
  kind: string;
  title: string;
  target_value: number;
  target_unit: string | null;
  target_date: string | null;
  reference: string | null;
  start_value: number | null;
  is_active: boolean;
  created_at: string;
};

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("goals")
    .select("id, kind, title, target_value, target_unit, target_date, reference, start_value, is_active, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const supabase = createServerClient();
  const { data, error } = await supabase.from("goals").insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const supabase = createServerClient();
  const { data, error } = await supabase.from("goals").update(rest).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const supabase = createServerClient();
  const { error } = await supabase.from("goals").update({ is_active: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
