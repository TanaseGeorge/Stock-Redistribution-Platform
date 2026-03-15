from typing import Dict, List
from app.supabase_client import supabase


def fetch_all_rows(table_name: str, page_size: int = 1000) -> List[dict]:
    all_rows = []
    start = 0

    while True:
        end = start + page_size - 1
        response = supabase.table(table_name).select("*").range(start, end).execute()
        rows = response.data or []

        if not rows:
            break

        all_rows.extend(rows)

        if len(rows) < page_size:
            break

        start += page_size

    return all_rows


def try_fetch_optional_table(table_names: List[str]) -> List[dict]:
    for name in table_names:
        try:
            return fetch_all_rows(name)
        except Exception:
            continue
    return []


def load_data() -> Dict[str, List[dict]]:
    stores = fetch_all_rows("stores")
    products = fetch_all_rows("products")
    inventory = fetch_all_rows("inventory")
    sales = fetch_all_rows("sales")
    transfers = fetch_all_rows("transfers")

    demand_stats = try_fetch_optional_table(["demand_forecast"])
    transfer_costs = try_fetch_optional_table(["transfer_costs"])

    return {
        "stores": stores,
        "products": products,
        "inventory": inventory,
        "sales": sales,
        "transfers": transfers,
        "demand_stats": demand_stats,
        "transfer_costs": transfer_costs,
    }