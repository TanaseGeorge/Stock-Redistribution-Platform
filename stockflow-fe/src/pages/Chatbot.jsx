import { useEffect, useRef, useState } from "react";
import supabase from "../api/supabase";
import "../styles/Chatbot.css";

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function buildSystemPrompt(stores, products, inventory, transfers, users) {
  const storeMap = {};
  for (const s of stores) storeMap[s.id] = s;

  const productMap = {};
  for (const p of products) productMap[p.id] = p;

  const inventoryLines = inventory.map((i) => {
    const store = storeMap[i.store_id];
    const product = productMap[i.product_id];
    const margin = product
      ? (product.selling_price - product.purchase_price).toFixed(2)
      : "N/A";
    const daysSinceLastSale = i.last_sale_at
      ? Math.floor((Date.now() - new Date(i.last_sale_at)) / 86400000)
      : 999;
    return `- ${store?.name || "?"} | ${product?.name || "?"} | qty: ${i.quantity} | min: ${i.min_stock} | max: ${i.max_stock ?? "—"} | margin: ${margin} RON | days since last sale: ${daysSinceLastSale} | last restock: ${i.last_restocked_at ? new Date(i.last_restocked_at).toLocaleDateString("en-GB") : "never"}`;
  });

  const transferLines = transfers.slice(0, 30).map((t) => {
    const from = storeMap[t.source_store_id]?.name || "?";
    const to = storeMap[t.destination_store_id]?.name || "?";
    const product = productMap[t.product_id];
    return `- ${from} → ${to} | ${product?.name || "?"} | qty: ${t.quantity} | status: ${t.status} | profit gain: ${t.estimated_profit_gain ?? 0} RON | transport: ${t.transport_cost ?? 0} RON`;
  });

  const managerLines = users.map((u) => {
    const managedStores = stores
      .filter((s) => s.manager_id === u.id)
      .map((s) => s.name)
      .join(", ");
    return `- ${u.name} | email: ${u.email} | role: ${u.role} | manages: ${managedStores || "no stores assigned"}`;
  });

  return `You are StockMind, an AI assistant for a multi-store stock redistribution platform.

The platform uses an OR-Tools LP optimizer that:
- Computes transferable_surplus = quantity - safety_stock (where safety_stock = max(min_stock, sales_velocity × 7))
- Computes strategic_need = target_stock - quantity (where target_stock = predicted_demand × confidence_factor)
- Only recommends transfers where unit_net_gain = unit_margin - transport_cost_per_unit >= minimum threshold
- Maximizes total profit across all transfers simultaneously
- Limits transfer routes per product to avoid over-fragmentation
- Transport costs: same city = lower cost, different city = higher cost

## Current data

### Stores (${stores.length})
${stores.map((s) => `- ${s.name} | city: ${s.city || "—"} | type: ${s.type || "—"} | capacity: ${s.capacity ?? "—"}`).join("\n")}

### Managers (${users.length})
${managerLines.length > 0 ? managerLines.join("\n") : "No managers registered."}

### Products (${products.length})
${products.map((p) => `- ${p.name} | category: ${p.category || "—"} | buy: ${p.purchase_price} RON | sell: ${p.selling_price} RON | margin: ${(p.selling_price - p.purchase_price).toFixed(2)} RON`).join("\n")}

### Inventory (${inventory.length} entries)
${inventoryLines.join("\n")}

### Transfers — pending/recent (${transfers.length})
${transferLines.length > 0 ? transferLines.join("\n") : "None yet."}

## How to reason about transfers
When asked for recommendations, analyze each product across all stores and identify:
1. DONORS — stores where: qty > min_stock AND (last_sale_at > 30 days OR sales are very low) → these have transferable surplus
2. RECEIVERS — stores where: qty <= min_stock AND product sells actively (last_sale_at < 14 days) → these have strategic need
3. PROFITABILITY — only recommend if: unit_margin - estimated_transport_cost > 0
4. PRIORITY — sort by estimated_profit_gain descending (critical stores with qty=0 first)
5. SAME CITY transfers — prefer these as transport cost is lower

## Transfer recommendation format
When recommending a transfer, always use this format:
**Transfer recommendation:**
- From: [store name] (surplus: X units)
- To: [store name] (need: X units)
- Product: [name]
- Quantity: X units
- Unit margin: X RON
- Estimated profit gain: X RON
- Reason: [brief explanation]

## Rules
- Answer in the same language the manager uses (Romanian or English)
- Be concise and direct
- Never recommend transferring below min_stock at the source
- Never make up data — only use what's provided above
- If you don't have enough data (no sales history), say so clearly
- When asked about dead stock, flag items with last_sale_at > 30 days AND qty > min_stock
- When asked about critical stock, flag items with qty = 0 or qty <= min_stock with active sales
- When asked about a manager, show which stores they manage and any stock issues in those stores`;
}

export default function Chatbot() {
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [users, setUsers] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hello! I'm StockMind, your AI stock assistant. Ask me anything about your stores, inventory, managers, or transfer recommendations.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadData() {
    try {
      const [
        { data: storesData },
        { data: productsData },
        { data: inventoryData },
        { data: transfersData },
        { data: usersData },
      ] = await Promise.all([
        supabase.from("stores").select("*").order("name"),
        supabase.from("products").select("*").order("name"),
        supabase.from("inventory").select("*"),
        supabase.from("transfers").select("*").order("created_at", { ascending: false }).limit(30),
        supabase.from("users").select("id, name, email, role").order("name"),
      ]);
      setStores(storesData || []);
      setProducts(productsData || []);
      setInventory(inventoryData || []);
      setTransfers(transfersData || []);
      setUsers(usersData || []);
      setDataLoaded(true);
    } catch (err) {
      console.error("Failed to load data for chatbot:", err);
      setDataLoaded(true);
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
  
    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setLoading(true);
  
    try {
      const systemPrompt = buildSystemPrompt(stores, products, inventory, transfers, users);
  
      const response = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.slice(1).map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.text,
            })),
            { role: "user", content: userMessage },
          ],
          temperature: 0.7,
          max_tokens: 1024,
        }),
      });
  
      const data = await response.json();
      const reply =
        data?.choices?.[0]?.message?.content ||
        "Sorry, I couldn't generate a response. Please try again.";
  
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Connection error. Please check your API key and try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const suggestions = [
    "Which stores have critical stock levels?",
    "Recommend transfers for dead stock",
    "What products have the highest profit margin?",
  ];

  return (
    <div className="chatbot-page">
      <div className="chatbot-header">
        <h1>Chatbot</h1>
        <p>Ask StockMind about your inventory, stores, managers, and transfer recommendations</p>
      </div>

      <div className="chatbot-layout">
        <div className="chatbot-main">
          <div className="chat-window">
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.role}`}>
                {msg.role === "assistant" && (
                  <div className="message-avatar">AI</div>
                )}
                <div className="message-bubble">
                  {msg.text.split("\n").map((line, j) => (
                    <p key={j} style={{ margin: j === 0 ? 0 : "6px 0 0" }}>{line}</p>
                  ))}
                </div>
              </div>
            ))}
            {loading && (
              <div className="message assistant">
                <div className="message-avatar">AI</div>
                <div className="message-bubble typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-area">
            <textarea
              className="chat-input"
              placeholder="Ask about inventory, transfers, managers, or stock recommendations..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={loading || !dataLoaded}
            />
            <button
              className="chat-send-btn"
              onClick={sendMessage}
              disabled={loading || !input.trim() || !dataLoaded}
            >
              {loading ? "..." : "Send"}
            </button>
          </div>
        </div>

        <div className="chatbot-sidebar">
          <div className="chatbot-card">
            <h3>Quick questions</h3>
            <div className="suggestions">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className="suggestion-btn"
                  onClick={() => setInput(s)}
                  disabled={loading}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="chatbot-card">
            <h3>Data loaded</h3>
            <div className="data-stats">
              {[
                { label: "Stores", val: stores.length },
                { label: "Products", val: products.length },
                { label: "Inventory entries", val: inventory.length },
                { label: "Transfers", val: transfers.length },
                { label: "Managers", val: users.length },
              ].map(({ label, val }) => (
                <div key={label} className="data-stat-row">
                  <span className="data-stat-label">{label}</span>
                  <span className="data-stat-val">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}