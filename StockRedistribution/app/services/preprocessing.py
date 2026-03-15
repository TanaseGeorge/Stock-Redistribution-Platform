import math
from typing import Dict, List

import pandas as pd

from app.config import (
    PLANNING_HORIZON_DAYS,
    SAFETY_STOCK_DAYS,
    DEMAND_CONFIDENCE_FACTOR,
    DEFAULT_COST_PER_UNIT_SAME_CITY,
    DEFAULT_COST_PER_UNIT_DIFF_CITY,
    DEFAULT_FIXED_COST_SAME_CITY,
    DEFAULT_FIXED_COST_DIFF_CITY,
)


def to_df(data: List[dict], expected_cols: List[str]) -> pd.DataFrame:
    df = pd.DataFrame(data)
    for col in expected_cols:
        if col not in df.columns:
            df[col] = None
    return df


def safe_numeric(df: pd.DataFrame, cols: List[str]) -> pd.DataFrame:
    for col in cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    return df


def prepare_frames(raw: Dict[str, List[dict]]):
    stores_df = to_df(raw["stores"], ["id", "name", "city", "address", "capacity", "type"])
    products_df = to_df(raw["products"], ["id", "name", "category", "purchase_price", "selling_price"])
    inventory_df = to_df(
        raw["inventory"],
        ["id", "store_id", "product_id", "quantity", "min_stock", "max_stock", "last_sale_at", "last_restocked_at"]
    )
    sales_df = to_df(
        raw["sales"],
        [
            "id",
            "store_id",
            "product_id",
            "quantity_sold",
            "sale_date",
            "recorded_at",
            "unit_price_at_sale",
            "unit_cost_at_sale",
        ],
    )
    demand_df = to_df(
        raw["demand_stats"],
        [
            "id",
            "store_id",
            "product_id",
            "predicted_demand",
            "avg_sales",
            "sales_velocity",
            "period_start",
            "period_end",
            "confidence",
            "calculated_at",
        ],
    )
    transfer_costs_df = to_df(
        raw["transfer_costs"],
        ["id", "source_store_id", "destination_store_id", "cost_per_unit", "fixed_cost"]
    )

    products_df = safe_numeric(products_df, ["purchase_price", "selling_price"])
    inventory_df = safe_numeric(inventory_df, ["quantity", "min_stock", "max_stock"])
    sales_df = safe_numeric(sales_df, ["quantity_sold", "unit_price_at_sale", "unit_cost_at_sale"])
    demand_df = safe_numeric(demand_df, ["predicted_demand", "avg_sales", "sales_velocity", "confidence"])
    transfer_costs_df = safe_numeric(transfer_costs_df, ["cost_per_unit", "fixed_cost"])

    if not sales_df.empty and "sale_date" in sales_df.columns:
        sales_df["sale_date"] = pd.to_datetime(sales_df["sale_date"], errors="coerce")

    products_df["unit_margin"] = (products_df["selling_price"] - products_df["purchase_price"]).clip(lower=0)

    return stores_df, products_df, inventory_df, sales_df, demand_df, transfer_costs_df


def compute_sales_features(sales_df: pd.DataFrame) -> pd.DataFrame:
    if sales_df.empty or sales_df["sale_date"].isna().all():
        return pd.DataFrame(columns=["store_id", "product_id", "avg_sales_30", "avg_sales_7", "sales_velocity", "observed_days"])

    latest_date = sales_df["sale_date"].max()

    sales_30 = sales_df[sales_df["sale_date"] >= latest_date - pd.Timedelta(days=29)].copy()
    sales_7 = sales_df[sales_df["sale_date"] >= latest_date - pd.Timedelta(days=6)].copy()

    agg_30 = (
        sales_30.groupby(["store_id", "product_id"], as_index=False)["quantity_sold"]
        .sum()
        .rename(columns={"quantity_sold": "qty_30"})
    )
    agg_30["avg_sales_30"] = agg_30["qty_30"] / 30.0

    agg_7 = (
        sales_7.groupby(["store_id", "product_id"], as_index=False)["quantity_sold"]
        .sum()
        .rename(columns={"quantity_sold": "qty_7"})
    )
    agg_7["avg_sales_7"] = agg_7["qty_7"] / 7.0

    observed = (
        sales_df.dropna(subset=["sale_date"])
        .groupby(["store_id", "product_id"], as_index=False)["sale_date"]
        .nunique()
        .rename(columns={"sale_date": "observed_days"})
    )

    result = (
        agg_30.merge(
            agg_7[["store_id", "product_id", "avg_sales_7"]],
            on=["store_id", "product_id"],
            how="outer",
        )
        .merge(
            observed,
            on=["store_id", "product_id"],
            how="outer",
        )
        .fillna(0)
    )

    result["sales_velocity"] = 0.7 * result["avg_sales_7"] + 0.3 * result["avg_sales_30"]
    return result


def build_transfer_costs_fallback(stores_df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    stores = stores_df.to_dict("records")

    for s1 in stores:
        for s2 in stores:
            if str(s1["id"]) == str(s2["id"]):
                continue

            city1 = str(s1.get("city", "")).strip().lower()
            city2 = str(s2.get("city", "")).strip().lower()
            same_city = city1 == city2 and city1 != ""

            rows.append({
                "source_store_id": str(s1["id"]),
                "destination_store_id": str(s2["id"]),
                "cost_per_unit": DEFAULT_COST_PER_UNIT_SAME_CITY if same_city else DEFAULT_COST_PER_UNIT_DIFF_CITY,
                "fixed_cost": DEFAULT_FIXED_COST_SAME_CITY if same_city else DEFAULT_FIXED_COST_DIFF_CITY,
            })

    return pd.DataFrame(rows)


def build_model_table(
    products_df: pd.DataFrame,
    inventory_df: pd.DataFrame,
    sales_features_df: pd.DataFrame,
    demand_df: pd.DataFrame,
) -> pd.DataFrame:
    model_df = inventory_df.merge(
        products_df[["id", "name", "category", "unit_margin"]],
        left_on="product_id",
        right_on="id",
        how="left"
    )

    model_df = model_df.merge(
        sales_features_df,
        on=["store_id", "product_id"],
        how="left"
    )

    if not demand_df.empty:
        demand_small = demand_df[["store_id", "product_id", "predicted_demand", "avg_sales", "sales_velocity"]].copy()
        demand_small = demand_small.rename(columns={
            "avg_sales": "forecast_avg_sales",
            "sales_velocity": "forecast_sales_velocity",
        })
        model_df = model_df.merge(
            demand_small,
            on=["store_id", "product_id"],
            how="left"
        )
    else:
        model_df["predicted_demand"] = 0
        model_df["forecast_avg_sales"] = 0
        model_df["forecast_sales_velocity"] = 0

    model_df = safe_numeric(
        model_df,
        [
            "quantity",
            "min_stock",
            "max_stock",
            "unit_margin",
            "avg_sales_30",
            "avg_sales_7",
            "sales_velocity",
            "observed_days",
            "predicted_demand",
            "forecast_avg_sales",
            "forecast_sales_velocity"
        ]
    )

    forecast_from_sales = model_df["sales_velocity"] * PLANNING_HORIZON_DAYS
    model_df["raw_predicted_demand"] = model_df["predicted_demand"].where(
        model_df["predicted_demand"] > 0,
        forecast_from_sales
    )
    model_df["effective_predicted_demand"] = (
        model_df["raw_predicted_demand"] * DEMAND_CONFIDENCE_FACTOR
    ).clip(lower=0)

    model_df["dynamic_safety_stock"] = model_df["sales_velocity"] * SAFETY_STOCK_DAYS
    model_df["safety_stock"] = model_df[["min_stock", "dynamic_safety_stock"]].max(axis=1)
    model_df["target_stock"] = model_df[["effective_predicted_demand", "safety_stock"]].max(axis=1)

    def apply_max_stock(row):
        if row["max_stock"] > 0:
            return min(row["target_stock"], row["max_stock"])
        return row["target_stock"]

    model_df["target_stock"] = model_df.apply(apply_max_stock, axis=1)
    model_df["transferable_surplus"] = (model_df["quantity"] - model_df["safety_stock"]).clip(lower=0)
    model_df["strategic_need"] = (model_df["target_stock"] - model_df["quantity"]).clip(lower=0)

    for col in [
        "quantity",
        "min_stock",
        "max_stock",
        "safety_stock",
        "target_stock",
        "transferable_surplus",
        "strategic_need"
    ]:
        model_df[col] = model_df[col].fillna(0).apply(lambda x: int(math.floor(x)))

    return model_df


def create_optimizer_inputs(model_df: pd.DataFrame, transfer_costs_df: pd.DataFrame) -> Dict:
    stores = sorted(model_df["store_id"].dropna().astype(str).unique().tolist())
    products = sorted(model_df["product_id"].dropna().astype(str).unique().tolist())

    unit_margin = {}
    transferable_surplus = {}
    strategic_need = {}

    for _, row in model_df.iterrows():
        s = str(row["store_id"])
        p = str(row["product_id"])
        unit_margin[(s, p)] = int(round(row["unit_margin"]))
        transferable_surplus[(s, p)] = int(row["transferable_surplus"])
        strategic_need[(s, p)] = int(row["strategic_need"])

    cost_per_unit = {}
    fixed_cost = {}
    for _, row in transfer_costs_df.iterrows():
        i = str(row["source_store_id"])
        j = str(row["destination_store_id"])
        cost_per_unit[(i, j)] = int(round(row["cost_per_unit"]))
        fixed_cost[(i, j)] = int(round(row["fixed_cost"]))

    return {
        "stores": stores,
        "products": products,
        "unit_margin": unit_margin,
        "transferable_surplus": transferable_surplus,
        "strategic_need": strategic_need,
        "cost_per_unit": cost_per_unit,
        "fixed_cost": fixed_cost,
    }