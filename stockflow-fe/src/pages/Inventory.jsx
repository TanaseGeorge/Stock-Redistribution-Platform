import { useEffect, useMemo, useState } from "react";
import supabase from "../api/supabase";
import "../styles/Inventory.css";

export default function Inventory() {
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [storeFilter, setStoreFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [editItem, setEditItem] = useState(null);
  const [editQty, setEditQty] = useState("");
  const [editMin, setEditMin] = useState("");
  const [editMax, setEditMax] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [
        { data: storesData, error: storesError },
        { data: productsData, error: productsError },
        { data: inventoryData, error: inventoryError },
      ] = await Promise.all([
        supabase.from("stores").select("*").order("name"),
        supabase.from("products").select("*").order("name"),
        supabase.from("inventory").select("*"),
      ]);
      if (storesError) throw storesError;
      if (productsError) throw productsError;
      if (inventoryError) throw inventoryError;
      setStores(storesData || []);
      setProducts(productsData || []);
      setInventory(inventoryData || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load inventory.");
    } finally {
      setLoading(false);
    }
  }

  const storeMap = useMemo(() => {
    const map = {};
    for (const s of stores) map[s.id] = s;
    return map;
  }, [stores]);

  const productMap = useMemo(() => {
    const map = {};
    for (const p of products) map[p.id] = p;
    return map;
  }, [products]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return [...set].sort();
  }, [products]);

  const mapped = useMemo(() => {
    return inventory.map((item) => {
      const store = storeMap[item.store_id];
      const product = productMap[item.product_id];
      const qty = Number(item.quantity || 0);
      const min = Number(item.min_stock || 10);
      const max = item.max_stock ? Number(item.max_stock) : null;
      let status = "ok";
      if (qty === 0) status = "out";
      else if (qty <= min) status = "low";
      else if (max && qty >= max) status = "surplus";
      return {
        id: item.id,
        storeId: item.store_id,
        productId: item.product_id,
        store: store?.name || "Unknown",
        product: product?.name || "Unknown",
        category: product?.category || "",
        quantity: qty,
        minStock: min,
        maxStock: max,
        lastSaleAt: item.last_sale_at,
        lastRestockedAt: item.last_restocked_at,
        status,
      };
    });
  }, [inventory, storeMap, productMap]);

  const filtered = useMemo(() => {
    return mapped.filter((item) => {
      const matchSearch =
        item.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.store.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStore = storeFilter === "all" || item.storeId === storeFilter;
      const matchCategory = categoryFilter === "all" || item.category === categoryFilter;
      const matchStatus = statusFilter === "all" || item.status === statusFilter;
      return matchSearch && matchStore && matchCategory && matchStatus;
    });
  }, [mapped, searchTerm, storeFilter, categoryFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: mapped.length,
    out: mapped.filter((i) => i.status === "out").length,
    low: mapped.filter((i) => i.status === "low").length,
    surplus: mapped.filter((i) => i.status === "surplus").length,
    totalUnits: mapped.reduce((s, i) => s + i.quantity, 0),
  }), [mapped]);

  function openEdit(item) {
    setEditItem(item);
    setEditQty(String(item.quantity));
    setEditMin(String(item.minStock));
    setEditMax(item.maxStock != null ? String(item.maxStock) : "");
  }

  async function handleSave() {
    if (!editItem) return;
    setSaving(true);
    try {
      const payload = {
        quantity: Number(editQty),
        min_stock: Number(editMin),
        max_stock: editMax !== "" ? Number(editMax) : null,
      };
      const { error } = await supabase
        .from("inventory")
        .update(payload)
        .eq("id", editItem.id);
      if (error) throw error;
      setInventory((prev) =>
        prev.map((i) => (i.id === editItem.id ? { ...i, ...payload } : i))
      );
      setEditItem(null);
    } catch (err) {
      console.error(err);
      alert("Failed to update inventory.");
    } finally {
      setSaving(false);
    }
  }

  function statusLabel(s) {
    if (s === "out") return "Out of stock";
    if (s === "low") return "Low stock";
    if (s === "surplus") return "Surplus";
    return "OK";
  }

  function formatDate(val) {
    if (!val) return "—";
    return new Date(val).toLocaleDateString("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  }

  if (loading) return (
    <div className="inventory-page">
      <div className="inventory-header"><h1>Inventory</h1><p>Loading...</p></div>
    </div>
  );

  if (error) return (
    <div className="inventory-page">
      <div className="inventory-header"><h1>Inventory</h1><p className="error-text">{error}</p></div>
    </div>
  );

  return (
    <div className="inventory-page">
      <div className="inventory-header">
        <h1>Inventory</h1>
        <p>Monitor and manage stock levels across all stores</p>
      </div>

      <div className="inventory-stats-grid">
        <div className="inventory-card stat-card">
          <span className="card-label">Total SKUs</span>
          <h2>{stats.total}</h2>
        </div>
        <div className="inventory-card stat-card">
          <span className="card-label">Total Units</span>
          <h2>{stats.totalUnits.toLocaleString()}</h2>
        </div>
        <div className="inventory-card stat-card">
          <span className="card-label">Out of Stock</span>
          <h2 className="danger-text">{stats.out}</h2>
        </div>
        <div className="inventory-card stat-card">
          <span className="card-label">Low Stock</span>
          <h2 className="warning-text">{stats.low}</h2>
        </div>
        <div className="inventory-card stat-card">
          <span className="card-label">Surplus</span>
          <h2 className="info-text">{stats.surplus}</h2>
        </div>
      </div>

      <div className="inventory-card filters-card">
        <div className="filters-grid">
          <div className="filter-group">
            <label>Search</label>
            <input
              type="text"
              placeholder="Search by product or store..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Store</label>
            <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
              <option value="all" style={{ background: '#1e2026', color: '#f5f7ff' }}>All stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id} style={{ background: '#1e2026', color: '#f5f7ff' }}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Category</label>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all" style={{ background: '#1e2026', color: '#f5f7ff' }}>All categories</option>
              {categories.map((c) => (
                <option key={c} value={c} style={{ background: '#1e2026', color: '#f5f7ff' }}>{c}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all" style={{ background: '#1e2026', color: '#f5f7ff' }}>All</option>
              <option value="out" style={{ background: '#1e2026', color: '#f5f7ff' }}>Out of stock</option>
              <option value="low" style={{ background: '#1e2026', color: '#f5f7ff' }}>Low stock</option>
              <option value="surplus" style={{ background: '#1e2026', color: '#f5f7ff' }}>Surplus</option>
              <option value="ok" style={{ background: '#1e2026', color: '#f5f7ff' }}>OK</option>
            </select>
          </div>
        </div>
      </div>

      <div className="inventory-card">
        <div className="card-header">
          <h3>Stock Levels</h3>
          <span className="result-count">{filtered.length} items</span>
        </div>

        <div className="inventory-table">
          <div className="inventory-table-head">
            <span>Store</span>
            <span>Product</span>
            <span>Category</span>
            <span>Qty</span>
            <span>Min</span>
            <span>Max</span>
            <span>Last Sale</span>
            <span>Last Restock</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">No inventory items found.</div>
          ) : (
            filtered.map((item) => (
              <div key={item.id} className="inventory-table-row">
                <span>{item.store}</span>
                <span>{item.product}</span>
                <span className="category-tag">{item.category || "—"}</span>
                <span className={
                  item.status === "out" ? "danger-text" :
                  item.status === "low" ? "warning-text" :
                  item.status === "surplus" ? "info-text" : ""
                }>
                  {item.quantity}
                </span>
                <span className="muted">{item.minStock}</span>
                <span className="muted">{item.maxStock ?? "—"}</span>
                <span className="muted">{formatDate(item.lastSaleAt)}</span>
                <span className="muted">{formatDate(item.lastRestockedAt)}</span>
                <span>
                  <span className={`status-pill ${item.status}`}>
                    {statusLabel(item.status)}
                  </span>
                </span>
                <span>
                  <button className="btn-edit-sm" onClick={() => openEdit(item)}>
                    Edit
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {editItem && (
        <div className="modal-overlay" onClick={() => setEditItem(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Stock</h2>
            <p className="modal-subtitle">{editItem.product} · {editItem.store}</p>
            <div className="modal-fields">
              {[
                { label: "Quantity", val: editQty, set: setEditQty },
                { label: "Min Stock", val: editMin, set: setEditMin },
                { label: "Max Stock (optional)", val: editMax, set: setEditMax },
              ].map(({ label, val, set }) => (
                <div key={label} className="modal-field">
                  <label>{label}</label>
                  <input
                    type="number"
                    min="0"
                    value={val}
                    onChange={(e) => set(e.target.value)}
                  />
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setEditItem(null)}>Cancel</button>
              <button className="btn-save" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}