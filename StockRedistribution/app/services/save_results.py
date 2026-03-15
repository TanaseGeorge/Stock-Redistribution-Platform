from datetime import datetime
from app.supabase_client import supabase


def clear_old_proposed_transfers():
    try:
        supabase.table("transfers").delete().eq("status", "pending").execute()
    except Exception as e:
        print(f"[WARN] Nu am putut șterge transferurile propuse vechi: {e}")


def save_recommendations(recommendations: list):
    if not recommendations:
        return

    now = datetime.utcnow().isoformat()
    rows = []

    for rec in recommendations:
        rows.append({
            "source_store_id": rec["source_store_id"],
            "destination_store_id": rec["destination_store_id"],
            "product_id": rec["product_id"],
            "quantity": rec["quantity"],
            "transport_cost": rec["transport_cost"],
            "estimated_profit_gain": rec["estimated_profit_gain"],
            "status": rec["status"],
            "created_at": now,
        })

    supabase.table("transfers").insert(rows).execute()