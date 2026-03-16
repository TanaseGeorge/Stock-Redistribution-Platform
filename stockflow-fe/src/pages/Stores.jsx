import { useEffect, useMemo, useState } from "react";
import supabase from "../api/supabase";
import "../styles/Stores.css";

export default function Stores() {
  const [stores, setStores] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editStore, setEditStore] = useState(null);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [managerFilter, setManagerFilter] = useState("all");

  const emptyForm = { name: "", city: "", address: "", capacity: "", type: "", manager_id: "" };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [
        { data: storesData, error: storesError },
        { data: inventoryData, error: inventoryError },
        { data: usersData, error: usersError },
      ] = await Promise.all([
        supabase.from("stores").select("*, users(name)").order("name"),
        supabase.from("inventory").select("store_id, quantity, min_stock"),
        supabase.from("users").select("id, name").order("name"),
      ]);
      if (storesError) throw storesError;
      if (inventoryError) throw inventoryError;
      if (usersError) throw usersError;
      setStores(storesData || []);
      setInventory(inventoryData || []);
      setUsers(usersData || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load stores.");
    } finally {
      setLoading(false);
    }
  }

  const storeStats = useMemo(() => {
    const map = {};
    for (const item of inventory) {
      if (!map[item.store_id]) map[item.store_id] = { total: 0, lowStock: 0 };
      map[item.store_id].total += Number(item.quantity || 0);
      if (Number(item.quantity) <= Number(item.min_stock || 10))
        map[item.store_id].lowStock += 1;
    }
    return map;
  }, [inventory]);

  const cities = useMemo(() => {
    const set = new Set(stores.map((s) => s.city).filter(Boolean));
    return [...set].sort();
  }, [stores]);

  const types = useMemo(() => {
    const set = new Set(stores.map((s) => s.type).filter(Boolean));
    return [...set].sort();
  }, [stores]);

  const filtered = useMemo(() => {
    return stores.filter((s) => {
      if (!s) return false;
      const matchSearch =
        s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.address?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCity = cityFilter === "all" || s.city === cityFilter;
      const matchType = typeFilter === "all" || s.type === typeFilter;
      const matchManager = managerFilter === "all" || s.manager_id === managerFilter;
      return matchSearch && matchCity && matchType && matchManager;
    });
  }, [stores, searchTerm, cityFilter, typeFilter, managerFilter]);

  const stats = useMemo(() => {
    const totalStock = Object.values(storeStats).reduce((sum, s) => sum + s.total, 0);
    const storesWithAlerts = Object.values(storeStats).filter((s) => s.lowStock > 0).length;
    return { total: stores.length, totalStock, storesWithAlerts, cities: cities.length };
  }, [stores, storeStats, cities]);

  function openAdd() {
    setEditStore(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(store) {
    setEditStore(store);
    setForm({
      name: store.name || "",
      city: store.city || "",
      address: store.address || "",
      capacity: store.capacity || "",
      type: store.type || "",
      manager_id: store.manager_id || "", 
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        city: form.city.trim() || null,
        address: form.address.trim() || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        type: form.type.trim() || null,
        manager_id: form.manager_id || null,
      };
      if (editStore) {
        const { error } = await supabase.from("stores").update(payload).eq("id", editStore.id);
        if (error) throw error;
        setStores((prev) => prev.map((s) => (s.id === editStore.id ? { ...s, ...payload } : s)));
      } else {
        const { data, error } = await supabase.from("stores").insert(payload).select().single();
        if (error) throw error;
        setStores((prev) => [...prev, data]);
      }
      setShowModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to save store.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this store?")) return;
    const { error } = await supabase.from("stores").delete().eq("id", id);
    if (error) { alert("Failed to delete store."); return; }
    setStores((prev) => prev.filter((s) => s.id !== id));
  }

  if (loading) return <div className="stores-page"><div className="stores-header"><h1>Stores</h1><p>Loading...</p></div></div>;
  if (error) return <div className="stores-page"><div className="stores-header"><h1>Stores</h1><p className="error-text">{error}</p></div></div>;

  return (
    <div className="stores-page">
      <div className="stores-header">
      <h1>Stores</h1>
      <p>Manage your store network</p>
      <div className="stores-header-actions">
        <button className="btn-add" onClick={openAdd}>+ Add Store</button>
      </div>
    </div>

      <div className="stores-stats-grid">
        {[
          { label: "Total Stores", val: stats.total },
          { label: "Total Stock Units", val: stats.totalStock.toLocaleString() },
          { label: "Stores with Alerts", val: stats.storesWithAlerts },
          { label: "Cities", val: stats.cities },
        ].map(({ label, val }) => (
          <div key={label} className="stores-card stat-card">
            <span className="card-label">{label}</span>
            <h2>{val}</h2>
          </div>
        ))}
      </div>

      <div className="stores-card filters-card">
        <div className="filters-grid">
          <div className="filter-group">
            <label>Search</label>
            <input
              type="text"
              placeholder="Search by name, city or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>City</label>
            <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
              <option value="all" style={{ background: '#1e2026', color: '#f5f7ff' }}>All cities</option>
              {cities.map((c) => (
                <option key={c} value={c} style={{ background: '#1e2026', color: '#f5f7ff' }}>{c}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all" style={{ background: '#1e2026', color: '#f5f7ff' }}>All types</option>
              {types.map((t) => (
                <option key={t} value={t} style={{ background: '#1e2026', color: '#f5f7ff' }}>{t}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
          <label>Manager</label>
          <select value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)}>
            <option value="all" style={{ background: '#1e2026', color: '#f5f7ff' }}>All managers</option>
            {users.map((u) => (
              <option key={u.id} value={u.id} style={{ background: '#1e2026', color: '#f5f7ff' }}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        </div>
      </div>

      <div className="stores-grid">
        {filtered.length === 0 ? (
          <div className="empty-state">No stores found.</div>
        ) : (
          filtered.map((store) => {
            const s = storeStats[store.id] || { total: 0, lowStock: 0 };
            return (
              <div key={store.id} className="store-card">
                <div className="store-card-top">
                  <div className="store-avatar">
                    {store.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="store-info">
                    <h3>{store.name}</h3>
                    <span className="store-subtitle">
                      {[store.city, store.address].filter(Boolean).join(" · ")}
                    </span>
                    {s.lowStock > 0 && (
                      <span className="alert-badge">{s.lowStock} alerts</span>
                    )}
                  </div>
                </div>

                <div className="store-meta-grid">
                  <div className="store-meta-item">
                    <span className="store-meta-label">Type</span>
                    <span className="store-meta-value">{store.type || "—"}</span>
                  </div>
                  <div className="store-meta-item">
                    <span className="store-meta-label">Capacity</span>
                    <span className="store-meta-value">
                      {store.capacity ? Number(store.capacity).toLocaleString() : "—"}
                    </span>
                  </div>
                  <div className="store-meta-item">
                    <span className="store-meta-label">Stock units</span>
                    <span className="store-meta-value">{s.total.toLocaleString()}</span>
                  </div>
                  <div className="store-meta-item">
                    <span className="store-meta-label">Manager</span>
                    <span className="store-meta-value">
                      {store.users?.name || "—"}
                    </span>
                  </div>
                </div>

                <div className="store-actions">
                  <button className="btn-edit" onClick={() => openEdit(store)}>Edit</button>
                  <button className="btn-delete" onClick={() => handleDelete(store.id)}>Delete</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editStore ? "Edit Store" : "Add Store"}</h2>
            <div className="modal-fields">
              {[
                { label: "Name *", key: "name", placeholder: "Store name" },
                { label: "City", key: "city", placeholder: "e.g. Bucharest" },
                { label: "Address", key: "address", placeholder: "Street address" },
                { label: "Capacity", key: "capacity", placeholder: "e.g. 1000", type: "number" },
                { label: "Type", key: "type", placeholder: "e.g. mall, standalone" },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key} className="modal-field">
                  <label>{label}</label>
                  <input
                    type={type || "text"}
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="modal-field">
            <label>Manager</label>
            <select
              value={form.manager_id}
              onChange={(e) => setForm((f) => ({ ...f, manager_id: e.target.value }))}
              style={{ height: '44px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.03)', color: '#f5f7ff', padding: '0 14px',
                      outline: 'none', fontSize: '14px', fontFamily: 'inherit' }}
            >
              <option value="" style={{ background: '#1e2026', color: '#f5f7ff' }}>No manager</option>
              {users.map((u) => (
                <option key={u.id} value={u.id} style={{ background: '#1e2026', color: '#f5f7ff' }}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
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