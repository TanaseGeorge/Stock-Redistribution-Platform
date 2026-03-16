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
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const [showAddProduct, setShowAddProduct] = useState(false);
  const emptyProduct = {
    name: "", category: "", purchase_price: "", selling_price: "",
    store_id: "", quantity: "", min_stock: "10", max_stock: "",
    last_sale_at: "", last_restocked_at: ""
  };
  const [productForm, setProductForm] = useState(emptyProduct);
  const [savingProduct, setSavingProduct] = useState(false);

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
        purchasePrice: product?.purchase_price || 0,
        sellingPrice: product?.selling_price || 0,
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
    setEditForm({
      name: item.product,
      category: item.category,
      purchase_price: String(item.purchasePrice),
      selling_price: String(item.sellingPrice),
      quantity: String(item.quantity),
      min_stock: String(item.minStock),
      max_stock: item.maxStock != null ? String(item.maxStock) : "",
      last_sale_at: item.lastSaleAt ? item.lastSaleAt.split("T")[0] : "",
      last_restocked_at: item.lastRestockedAt ? item.lastRestockedAt.split("T")[0] : "",
    });
  }

  async function handleSave() {
    if (!editItem) return;
    setSaving(true);
    try {
      const { error: invError } = await supabase
        .from("inventory")
        .update({
          quantity: Number(editForm.quantity),
          min_stock: Number(editForm.min_stock),
          max_stock: editForm.max_stock !== "" ? Number(editForm.max_stock) : null,
          last_sale_at: editForm.last_sale_at || null,
          last_restocked_at: editForm.last_restocked_at || null,
        })
        .eq("id", editItem.id);
      if (invError) throw invError;

      const { error: prodError } = await supabase
        .from("products")
        .update({
          name: editForm.name.trim(),
          category: editForm.category.trim() || null,
          purchase_price: Number(editForm.purchase_price),
          selling_price: Number(editForm.selling_price),
        })
        .eq("id", editItem.productId);
      if (prodError) throw prodError;

      await loadData();
      setEditItem(null);
    } catch (err) {
      console.error(err);
      alert("Failed to update.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from("inventory").delete().eq("id", id);
    if (error) { alert("Failed to delete."); return; }
    setInventory((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleSaveProduct() {
    if (!productForm.name.trim() || !productForm.store_id) {
      alert("Name and store are required.");
      return;
    }
    setSavingProduct(true);
    try {
      const { data: newProduct, error: productError } = await supabase
        .from("products")
        .insert({
          name: productForm.name.trim(),
          category: productForm.category.trim() || null,
          purchase_price: Number(productForm.purchase_price || 0),
          selling_price: Number(productForm.selling_price || 0),
        })
        .select()
        .single();
      if (productError) throw productError;

      const { error: inventoryError } = await supabase
        .from("inventory")
        .insert({
          store_id: productForm.store_id,
          product_id: newProduct.id,
          quantity: Number(productForm.quantity || 0),
          min_stock: Number(productForm.min_stock || 10),
          max_stock: productForm.max_stock ? Number(productForm.max_stock) : null,
          last_sale_at: productForm.last_sale_at || null,
          last_restocked_at: productForm.last_restocked_at || null,
        });
      if (inventoryError) throw inventoryError;

      await loadData();
      setShowAddProduct(false);
      setProductForm(emptyProduct);
    } catch (err) {
      console.error(err);
      alert("Failed to save product.");
    } finally {
      setSavingProduct(false);
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
        <div className="inventory-header-actions">
          <button className="btn-add" onClick={() => { setProductForm(emptyProduct); setShowAddProduct(true); }}>
            + Add Product
          </button>
        </div>
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
                }>{item.quantity}</span>
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
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn-edit-sm" onClick={() => openEdit(item)}>Edit</button>
                    <button className="btn-delete-sm" onClick={() => handleDelete(item.id)}>Delete</button>
                  </div>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {editItem && (
        <div className="modal-overlay" onClick={() => setEditItem(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Item</h2>
            <p className="modal-subtitle">{editItem.product} · {editItem.store}</p>
            <div className="modal-two-col">
              <div className="modal-col">
                <p className="modal-section-title">Product info</p>
                {[
                  { label: "Name", key: "name", placeholder: "Product name" },
                  { label: "Category", key: "category", placeholder: "e.g. Electronics" },
                  { label: "Purchase price (RON)", key: "purchase_price", placeholder: "0", type: "number" },
                  { label: "Selling price (RON)", key: "selling_price", placeholder: "0", type: "number" },
                ].map(({ label, key, placeholder, type }) => (
                  <div key={key} className="modal-field">
                    <label>{label}</label>
                    <input
                      type={type || "text"}
                      placeholder={placeholder}
                      value={editForm[key]}
                      onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <div className="modal-col">
                <p className="modal-section-title">Stock info</p>
                {[
                  { label: "Quantity", key: "quantity", type: "number" },
                  { label: "Min stock", key: "min_stock", type: "number" },
                  { label: "Max stock (optional)", key: "max_stock", type: "number" },
                  { label: "Last sale", key: "last_sale_at", type: "date" },
                  { label: "Last restock", key: "last_restocked_at", type: "date" },
                ].map(({ label, key, type }) => (
                  <div key={key} className="modal-field">
                    <label>{label}</label>
                    <input
                      type={type || "text"}
                      value={editForm[key]}
                      onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
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

      {showAddProduct && (
        <div className="modal-overlay" onClick={() => setShowAddProduct(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h2>Add Product</h2>
            <div className="modal-two-col">
              <div className="modal-col">
                <p className="modal-section-title">Product info</p>
                {[
                  { label: "Name *", key: "name", placeholder: "Product name" },
                  { label: "Category", key: "category", placeholder: "e.g. Electronics" },
                  { label: "Purchase price (RON)", key: "purchase_price", placeholder: "0", type: "number" },
                  { label: "Selling price (RON)", key: "selling_price", placeholder: "0", type: "number" },
                ].map(({ label, key, placeholder, type }) => (
                  <div key={key} className="modal-field">
                    <label>{label}</label>
                    <input
                      type={type || "text"}
                      placeholder={placeholder}
                      value={productForm[key]}
                      onChange={(e) => setProductForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <div className="modal-col">
                <p className="modal-section-title">Stock info</p>
                <div className="modal-field">
                  <label>Store *</label>
                  <select
                    value={productForm.store_id}
                    onChange={(e) => setProductForm((f) => ({ ...f, store_id: e.target.value }))}
                    className="modal-select"
                  >
                    <option value="" style={{ background: '#1e2026', color: '#f5f7ff' }}>Select store</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id} style={{ background: '#1e2026', color: '#f5f7ff' }}>{s.name}</option>
                    ))}
                  </select>
                </div>
                {[
                  { label: "Quantity", key: "quantity", type: "number", placeholder: "0" },
                  { label: "Min stock", key: "min_stock", type: "number", placeholder: "10" },
                  { label: "Max stock (optional)", key: "max_stock", type: "number", placeholder: "—" },
                  { label: "Last sale (optional)", key: "last_sale_at", type: "date" },
                  { label: "Last restock (optional)", key: "last_restocked_at", type: "date" },
                ].map(({ label, key, type, placeholder }) => (
                  <div key={key} className="modal-field">
                    <label>{label}</label>
                    <input
                      type={type || "text"}
                      placeholder={placeholder || ""}
                      value={productForm[key]}
                      onChange={(e) => setProductForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowAddProduct(false)}>Cancel</button>
              <button className="btn-save" onClick={handleSaveProduct} disabled={savingProduct}>
                {savingProduct ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}