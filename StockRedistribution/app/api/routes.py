from fastapi import APIRouter, HTTPException

from app.schemas import OptimizationRequest, OptimizationResponse
from app.services.data_loader import load_data
from app.services.preprocessing import (
    prepare_frames,
    compute_sales_features,
    build_transfer_costs_fallback,
    build_model_table,
    create_optimizer_inputs,
)
from app.services.optimizer import optimize_transfers
from app.services.save_results import clear_old_proposed_transfers, save_recommendations

router = APIRouter()


@router.get("/health")
def health_check():
    return {"status": "ok"}


@router.post("/optimize", response_model=OptimizationResponse)
def run_optimization(payload: OptimizationRequest):
    try:
        raw = load_data()
        stores_df, products_df, inventory_df, sales_df, demand_df, transfer_costs_df = prepare_frames(raw)

        if stores_df.empty:
            raise HTTPException(status_code=400, detail="Tabela Stores este goală.")
        if products_df.empty:
            raise HTTPException(status_code=400, detail="Tabela Products este goală.")
        if inventory_df.empty:
            raise HTTPException(status_code=400, detail="Tabela Inventory este goală.")

        sales_features_df = compute_sales_features(sales_df)
        model_df = build_model_table(
            products_df=products_df,
            inventory_df=inventory_df,
            sales_features_df=sales_features_df,
            demand_df=demand_df,
        )

        if transfer_costs_df.empty:
            transfer_costs_df = build_transfer_costs_fallback(stores_df)

        optimizer_inputs = create_optimizer_inputs(model_df, transfer_costs_df)
        result = optimize_transfers(optimizer_inputs)

        if payload.save_results:
            if payload.clear_old_proposed:
                clear_old_proposed_transfers()
            save_recommendations(result["recommendations"])

        return {
            "status": result["status"],
            "total_estimated_profit": result["total_estimated_profit"],
            "recommendations_count": len(result["recommendations"]),
            "recommendations": result["recommendations"],
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))