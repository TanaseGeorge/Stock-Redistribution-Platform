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
stock_health —
system_state —
transfer_costs —
```

---

## Transfer Optimization Logic


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

