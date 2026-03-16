import supabase from "../api/supabase";

const SYSTEM_STATE_ID = "main";

export async function ensureSystemState() {
  const { data, error } = await supabase
    .from("system_state")
    .select("*")
    .eq("id", SYSTEM_STATE_ID)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const now = new Date().toISOString();

    const { error: insertError } = await supabase
      .from("system_state")
      .insert({
        id: SYSTEM_STATE_ID,
        stock_dirty_external: true,
        last_external_change_at: now,
        last_optimization_at: null,
        updated_at: now,
      });

    if (insertError) throw insertError;
  }
}

export async function getSystemState() {
  await ensureSystemState();

  const { data, error } = await supabase
    .from("system_state")
    .select("*")
    .eq("id", SYSTEM_STATE_ID)
    .single();

  if (error) throw error;
  return data;
}

export async function markStockDirtyExternal() {
  await ensureSystemState();

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("system_state")
    .update({
      stock_dirty_external: true,
      last_external_change_at: now,
      updated_at: now,
    })
    .eq("id", SYSTEM_STATE_ID);

  if (error) throw error;
}

export async function markOptimizationRun() {
  await ensureSystemState();

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("system_state")
    .update({
      stock_dirty_external: false,
      last_optimization_at: now,
      updated_at: now,
    })
    .eq("id", SYSTEM_STATE_ID);

  if (error) throw error;
}