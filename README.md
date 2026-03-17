# StockMind — AI-driven Stock Management

StockMind is a multi-store stock redistribution platform that helps managers monitor inventory levels, identify inefficiencies, and optimize stock transfers between stores using a combination of a greedy algorithm, an OR-Tools LP optimizer, and an AI assistant.

---

## Overview

The platform manages a network of stores sharing the same product catalog. When some stores accumulate dead stock while others run critically low, StockMind automatically identifies transfer opportunities and recommends the most profitable redistribution strategy.

The AI chatbot (powered by Groq) gives managers a natural language interface to query inventory data, ask for transfer recommendations, and get insights about their store network.

---

## Features

- **Dashboard** — overview of stock health, low stock alerts, surplus inventory, and recommended transfers
- **Stores** — manage the store network with add/edit/delete, filter by city/type/manager, assign managers
- **Inventory** — full stock visibility across all stores, filter by status (out/low/surplus/ok), edit stock levels and dates, add new products directly to a store
- **Transfers** — view and manage stock transfer recommendations, approve/complete transfers, filter by status/source store/destination store
- **Chatbot** — AI assistant with full context of stores, products, inventory, transfers and managers; answers questions in Romanian or English and recommends transfers

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + Vite | UI framework |
| React Router | Client-side routing |
| Supabase JS | DB queries and Auth |
| Groq API | AI chatbot |
| TailwindCSS / CSS Modules | Styling |

### Backend
| Technology | Purpose |
|---|---|
| FastAPI + Python 3.11 | REST API |
| Supabase (PostgreSQL) | Database |

---

## Database Schema

```
users          — managers with role-based access
stores         — store locations with manager assignment
products       — product catalog with purchase/selling prices
inventory      — stock per store per product (qty, min, max, last sale/restock)
sales          — sales history with price snapshot at sale time
transfers      — transfer recommendations and history (pending → approved → completed)
demand_forecast — AI-generated demand predictions per store/product
stock_health — Stores calculated metrics about stock status (e.g., low, out of stock, surplus, sales performance) for each product in each store.
system_state — Keeps the global state of the system, including whether data has changed and when the last optimization was run.
transfer_costs — Defines the cost of moving products between stores, including fixed and per-unit transport costs used in optimization.
```

---

## Transfer Optimization Logic

The system optimizes stock redistribution between stores to maximize total estimated profit.

The optimization is implemented in Python and exposed via a FastAPI backend. It retrieves data from Supabase, processes it, and computes optimal product transfers.

## How it works

For each `(store, product)` pair, the system computes:

- **Unit margin**  
  `selling_price - purchase_price`

- **Sales velocity**  
  Based on recent sales (last 7 and 30 days)

- **Predicted demand**  
  Estimated from historical data or forecast tables

- **Safety stock**  
  Minimum stock level required to avoid stockouts

- **Target stock**  
  Based on predicted demand and safety stock

From these values, two key metrics are derived:

- **Transferable surplus**  
  Extra stock that can be safely moved

- **Strategic need**  
  Amount of stock a store should receive to meet demand

## Optimization

The system evaluates all possible transfers between stores and selects the combination that maximizes total profit.

Each transfer is evaluated using:
profit = quantity × (unit_margin - transport_cost) - fixed_cost

Only transfers with positive profit are considered.

## Key behavior

The algorithm is **demand-driven**, not just deficit-based.

This means:
- A store can receive products even if it is not in a strict deficit
- If a product sells faster in one store than another, stock is redistributed accordingly

## Output

The system generates a list of recommended transfers containing:

- source store
- destination store
- product
- quantity
- estimated profit gain

These recommendations are saved in the `Transfers` table and can be displayed in the frontend.

---

## Frontend Setup

```bash
cd stockflow-fe
npm install
```

Create `.env` in `stockflow-fe/`:
```bash
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh...
VITE_GROQ_API_KEY=gsk_...
```

Start dev server:
```bash
npm run dev
```

---

## Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

Create `.env` in `backend/`:
```bash
DATABASE_URL=postgresql://postgres.xxxx:password@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
SUPABASE_SERVICE_KEY=eyJh...
```

Start server:
```bash
uvicorn main:app --reload
```
---

## Pages & Routes

| Route | Page | Access |
|---|---|---|
| `/login` | Login | Public |
| `/register` | Register | Public |
| `/dashboard` | Dashboard | Authenticated |
| `/stores` | Stores | Authenticated |
| `/inventory` | Inventory | Authenticated |
| `/transfers` | Transfers | Authenticated |
| `/chatbot` | AI Chatbot | Authenticated |

