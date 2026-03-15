from ortools.sat.python import cp_model
from app.config import MAX_TRANSFER_ROUTES_PER_PRODUCT, MIN_UNIT_NET_GAIN


def _safe_id(value: str) -> str:
    return str(value).replace("-", "_")


def optimize_transfers(data: dict) -> dict:
    stores = data["stores"]
    products = data["products"]
    unit_margin = data["unit_margin"]
    transferable_surplus = data["transferable_surplus"]
    strategic_need = data["strategic_need"]
    cost_per_unit = data["cost_per_unit"]
    fixed_cost = data["fixed_cost"]

    model = cp_model.CpModel()

    x = {}
    y = {}
    candidate_routes = []

    for i in stores:
        for j in stores:
            if i == j:
                continue

            cpu = cost_per_unit.get((i, j))
            fc = fixed_cost.get((i, j))
            if cpu is None or fc is None:
                continue

            for p in products:
                donor_surplus = transferable_surplus.get((i, p), 0)
                receiver_need = strategic_need.get((j, p), 0)
                margin = unit_margin.get((j, p), 0)

                if donor_surplus <= 0 or receiver_need <= 0:
                    continue

                unit_net_gain = margin - cpu
                if unit_net_gain < MIN_UNIT_NET_GAIN:
                    continue

                upper_bound = min(donor_surplus, receiver_need)
                if upper_bound <= 0:
                    continue

                safe_i = _safe_id(i)
                safe_j = _safe_id(j)
                safe_p = _safe_id(p)

                x[(i, j, p)] = model.NewIntVar(0, upper_bound, f"x_{safe_i}_{safe_j}_{safe_p}")
                y[(i, j, p)] = model.NewBoolVar(f"y_{safe_i}_{safe_j}_{safe_p}")

                model.Add(x[(i, j, p)] >= y[(i, j, p)])
                model.Add(x[(i, j, p)] <= upper_bound * y[(i, j, p)])

                candidate_routes.append((i, j, p))

    for i in stores:
        for p in products:
            outgoing = [x[(ii, j, pp)] for (ii, j, pp) in candidate_routes if ii == i and pp == p]
            if outgoing:
                model.Add(sum(outgoing) <= transferable_surplus.get((i, p), 0))

    for j in stores:
        for p in products:
            incoming = [x[(i, jj, pp)] for (i, jj, pp) in candidate_routes if jj == j and pp == p]
            if incoming:
                model.Add(sum(incoming) <= strategic_need.get((j, p), 0))

    for p in products:
        active_routes = [y[(i, j, pp)] for (i, j, pp) in candidate_routes if pp == p]
        if active_routes:
            model.Add(sum(active_routes) <= MAX_TRANSFER_ROUTES_PER_PRODUCT)

    objective_terms = []
    for (i, j, p) in candidate_routes:
        unit_gain = unit_margin.get((j, p), 0) - cost_per_unit.get((i, j), 0)
        route_fixed_cost = fixed_cost.get((i, j), 0)
        objective_terms.append(unit_gain * x[(i, j, p)])
        objective_terms.append(-route_fixed_cost * y[(i, j, p)])

    model.Maximize(sum(objective_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30.0
    solver.parameters.num_search_workers = 8

    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {
            "status": "no_solution",
            "total_estimated_profit": 0,
            "recommendations": [],
        }

    recommendations = []
    total_estimated_profit = int(round(solver.ObjectiveValue()))

    for (i, j, p) in candidate_routes:
        qty = solver.Value(x[(i, j, p)])
        used = solver.Value(y[(i, j, p)])

        if used and qty > 0:
            cpu = cost_per_unit.get((i, j), 0)
            fc = fixed_cost.get((i, j), 0)
            margin = unit_margin.get((j, p), 0)

            transport_cost = qty * cpu + fc
            estimated_profit_gain = qty * (margin - cpu) - fc

            recommendations.append({
                "source_store_id": i,
                "destination_store_id": j,
                "product_id": p,
                "quantity": int(qty),
                "transport_cost": int(transport_cost),
                "estimated_profit_gain": int(estimated_profit_gain),
                "status": "pending",
            })

    recommendations.sort(key=lambda r: r["estimated_profit_gain"], reverse=True)

    return {
        "status": "ok",
        "total_estimated_profit": total_estimated_profit,
        "recommendations": recommendations,
    }