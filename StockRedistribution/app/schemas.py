from pydantic import BaseModel
from typing import List


class OptimizationRequest(BaseModel):
    clear_old_proposed: bool = True
    save_results: bool = True


class TransferRecommendation(BaseModel):
    source_store_id: str
    destination_store_id: str
    product_id: str
    quantity: int
    transport_cost: int
    estimated_profit_gain: int
    status: str


class OptimizationResponse(BaseModel):
    status: str
    total_estimated_profit: int
    recommendations_count: int
    recommendations: List[TransferRecommendation]