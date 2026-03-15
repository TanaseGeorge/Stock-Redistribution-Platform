import { useEffect, useMemo, useState } from "react";
import supabase from "../api/supabase";
import "../styles/Dashboard.css";

export default function Dashboard() {
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
        { data: storesData, error: storesError },
        { data: productsData, error: productsError },
        { data: inventoryData, error: inventoryError },
        { data: transfersData, error: transfersError },
      ] = await Promise.all([
        supabase.from("stores").select("*"),
        supabase.from("products").select("*"),
        supabase.from("inventory").select("*"),
        supabase
          .from("transfers")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (storesError) throw storesError;
      if (productsError) throw productsError;
      if (inventoryError) throw inventoryError;
      if (transfersError) throw transfersError;

      setStores(storesData || []);
      setProducts(productsData || []);
      setInventory(inventoryData || []);
      setTransfers(transfersData || []);
    } catch (err) {
      console.error(err);
      setError("Nu am putut încărca datele din Supabase.");
    } finally {
      setLoading(false);
    }
  }

  const formatRON = (value) => {
    return new Intl.NumberFormat("ro-RO", {
      style: "currency",
      currency: "RON",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  };

  const storeMap = useMemo(() => {
    const map = {};
    for (const store of stores) {
      map[store.id] = store;
    }
    return map;
  }, [stores]);

  const productMap = useMemo(() => {
    const map = {};
    for (const product of products) {
      map[product.id] = product;
    }
    return map;
  }, [products]);

  const stats = useMemo(() => {
    const lowStockItems = inventory.filter(
      (item) =>
        item.min_stock !== null &&
        item.min_stock !== undefined &&
        Number(item.quantity) <= Number(item.min_stock)
    );

    const surplusItems = inventory.filter(
      (item) =>
        item.max_stock !== null &&
        item.max_stock !== undefined &&
        Number(item.quantity) >= Number(item.max_stock)
    );

    const pendingTransfers = transfers.filter(
      (item) => String(item.status).toLowerCase() === "pending"
    );

    const estimatedProfit = pendingTransfers.reduce(
      (sum, item) => sum + Number(item.estimated_profit_gain || 0),
      0
    );

    return {
      totalStores: stores.length,
      totalProducts: products.length,
      lowStockCount: lowStockItems.length,
      surplusCount: surplusItems.length,
      pendingTransfersCount: pendingTransfers.length,
      estimatedProfit,
    };
  }, [stores, products, inventory, transfers]);

  const lowStockAlerts = useMemo(() => {
    return inventory
      .filter(
        (item) =>
          item.min_stock !== null &&
          item.min_stock !== undefined &&
          Number(item.quantity) <= Number(item.min_stock)
      )
      .map((item) => ({
        id: item.id,
        store: storeMap[item.store_id]?.name || "Magazin necunoscut",
        product: productMap[item.product_id]?.name || "Produs necunoscut",
        stock: item.quantity,
      }))
      .slice(0, 5);
  }, [inventory, storeMap, productMap]);

  const surplusProducts = useMemo(() => {
    return inventory
      .filter(
        (item) =>
          item.max_stock !== null &&
          item.max_stock !== undefined &&
          Number(item.quantity) >= Number(item.max_stock)
      )
      .map((item) => ({
        id: item.id,
        store: storeMap[item.store_id]?.name || "Magazin necunoscut",
        product: productMap[item.product_id]?.name || "Produs necunoscut",
        quantity: item.quantity,
      }))
      .slice(0, 5);
  }, [inventory, storeMap, productMap]);

  const mappedTransfers = useMemo(() => {
    return transfers.map((item) => ({
      id: item.id,
      from: storeMap[item.source_store_id]?.name || "Magazin necunoscut",
      to: storeMap[item.destination_store_id]?.name || "Magazin necunoscut",
      product: productMap[item.product_id]?.name || "Produs necunoscut",
      quantity: item.quantity,
      estimatedProfitGain: Number(item.estimated_profit_gain || 0),
      transportCost: Number(item.transport_cost || 0),
      status: item.status || "unknown",
    }));
  }, [transfers, storeMap, productMap]);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-header">
          <h1>Dashboard</h1>
          <p>Se încarcă datele...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-header">
          <h1>Dashboard</h1>
          <p className="error-text">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p>Overview of stock performance</p>
      </div>

      <div className="stats-grid">
        <div className="dashboard-card stat-card">
          <span className="card-label">Total Stores</span>
          <h2>{stats.totalStores}</h2>
        </div>

        <div className="dashboard-card stat-card">
          <span className="card-label">Total Products</span>
          <h2>{stats.totalProducts}</h2>
        </div>

        <div className="dashboard-card stat-card">
          <span className="card-label">Low Stock Alerts</span>
          <h2>{stats.lowStockCount}</h2>
        </div>

        <div className="dashboard-card stat-card">
          <span className="card-label">Surplus Products</span>
          <h2>{stats.surplusCount}</h2>
        </div>

        <div className="dashboard-card stat-card">
          <span className="card-label">Pending Transfers</span>
          <h2>{stats.pendingTransfersCount}</h2>
        </div>

        <div className="dashboard-card stat-card">
          <span className="card-label">Estimated Profit</span>
          <h2>{formatRON(stats.estimatedProfit)}</h2>
        </div>
      </div>

      <div className="dashboard-row two-columns">
        <div className="dashboard-card">
          <div className="card-header">
            <h3>Low Stock Alerts</h3>
          </div>

          <div className="simple-table">
            <div className="table-head">
              <span>Store</span>
              <span>Product</span>
              <span>Stock</span>
            </div>

            {lowStockAlerts.length === 0 ? (
              <div className="empty-state">No low stock alerts.</div>
            ) : (
              lowStockAlerts.map((item) => (
                <div key={item.id} className="table-row">
                  <span>{item.store}</span>
                  <span>{item.product}</span>
                  <span className="danger-text">{item.stock}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-header">
            <h3>Surplus Inventory</h3>
          </div>

          <div className="simple-table">
            <div className="table-head">
              <span>Store</span>
              <span>Product</span>
              <span>Qty</span>
            </div>

            {surplusProducts.length === 0 ? (
              <div className="empty-state">No surplus inventory.</div>
            ) : (
              surplusProducts.map((item) => (
                <div key={item.id} className="table-row">
                  <span>{item.store}</span>
                  <span>{item.product}</span>
                  <span className="warning-text">{item.quantity}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-card">
        <div className="card-header">
          <h3>Recommended Transfers</h3>
        </div>

        <div className="transfer-table">
          <div className="transfer-head">
            <span>From</span>
            <span>To</span>
            <span>Product</span>
            <span>Qty</span>
            <span>Profit</span>
            <span>Status</span>
          </div>

          {mappedTransfers.length === 0 ? (
            <div className="empty-state">No transfers found.</div>
          ) : (
            mappedTransfers.map((item) => (
              <div key={item.id} className="transfer-row">
                <span>{item.from}</span>
                <span>{item.to}</span>
                <span>{item.product}</span>
                <span>{item.quantity}</span>
                <span className="success-text">
                  {formatRON(item.estimatedProfitGain)}
                </span>
                <span>
                  <span
                    className={`status-pill ${
                      item.status.toLowerCase() === "pending"
                        ? "pending"
                        : item.status.toLowerCase() === "approved"
                        ? "approved"
                        : "completed"
                    }`}
                  >
                    {item.status}
                  </span>
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}