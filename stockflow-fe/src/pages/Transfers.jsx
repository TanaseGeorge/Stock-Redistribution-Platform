import { useEffect, useMemo, useState } from "react";
import supabase from "../api/supabase";
import "../styles/Transfers.css";

export default function Transfers() {
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [transfers, setTransfers] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [destinationFilter, setDestinationFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);

  useEffect(() => {
    loadTransfersData();
  }, []);

  async function loadTransfersData() {
    try {
      setLoading(true);
      setError("");

      const [
        { data: storesData, error: storesError },
        { data: productsData, error: productsError },
        { data: transfersData, error: transfersError },
      ] = await Promise.all([
        supabase.from("stores").select("*"),
        supabase.from("products").select("*"),
        supabase
          .from("transfers")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      if (storesError) throw storesError;
      if (productsError) throw productsError;
      if (transfersError) throw transfersError;

      setStores(storesData || []);
      setProducts(productsData || []);
      setTransfers(transfersData || []);
    } catch (err) {
      console.error(err);
      setError("Nu am putut încărca transferurile.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveTransfer(id) {
    try {
      setActionLoadingId(id);

      const { error } = await supabase
        .from("transfers")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      setTransfers((prev) =>
        prev.map((transfer) =>
          transfer.id === id
            ? {
                ...transfer,
                status: "approved",
                approved_at: new Date().toISOString(),
              }
            : transfer
        )
      );
    } catch (err) {
      console.error(err);
      alert("Nu am putut aproba transferul.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleCompleteTransfer(id) {
    try {
      setActionLoadingId(id);

      const { error } = await supabase
        .from("transfers")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      setTransfers((prev) =>
        prev.map((transfer) =>
          transfer.id === id
            ? {
                ...transfer,
                status: "completed",
                completed_at: new Date().toISOString(),
              }
            : transfer
        )
      );
    } catch (err) {
      console.error(err);
      alert("Nu am putut marca transferul ca finalizat.");
    } finally {
      setActionLoadingId(null);
    }
  }

  const formatRON = (value) => {
    return new Intl.NumberFormat("ro-RO", {
      style: "currency",
      currency: "RON",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  };

  const formatDate = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("ro-RO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
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

  const mappedTransfers = useMemo(() => {
    return transfers.map((item) => ({
      id: item.id,
      fromStoreId: item.source_store_id,
      toStoreId: item.destination_store_id,
      productId: item.product_id,
      from: storeMap[item.source_store_id]?.name || "Magazin necunoscut",
      to: storeMap[item.destination_store_id]?.name || "Magazin necunoscut",
      product: productMap[item.product_id]?.name || "Produs necunoscut",
      quantity: item.quantity || 0,
      transportCost: Number(item.transport_cost || 0),
      estimatedProfit: Number(item.estimated_profit_gain || 0),
      status: item.status || "unknown",
      createdAt: item.created_at,
      approvedAt: item.approved_at,
      completedAt: item.completed_at,
      notes: item.notes || "",
    }));
  }, [transfers, storeMap, productMap]);

  const filteredTransfers = useMemo(() => {
    return mappedTransfers.filter((item) => {
      const matchesSearch =
        item.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.to.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || item.status.toLowerCase() === statusFilter;

      const matchesSource =
        sourceFilter === "all" || item.fromStoreId === sourceFilter;

      const matchesDestination =
        destinationFilter === "all" || item.toStoreId === destinationFilter;

      return matchesSearch && matchesStatus && matchesSource && matchesDestination;
    });
  }, [mappedTransfers, searchTerm, statusFilter, sourceFilter, destinationFilter]);

  const stats = useMemo(() => {
    const pending = filteredTransfers.filter(
      (item) => item.status.toLowerCase() === "pending"
    ).length;

    const approved = filteredTransfers.filter(
      (item) => item.status.toLowerCase() === "approved"
    ).length;

    const completed = filteredTransfers.filter(
      (item) => item.status.toLowerCase() === "completed"
    ).length;

    const totalProfit = filteredTransfers.reduce(
      (sum, item) => sum + item.estimatedProfit,
      0
    );

    const totalTransport = filteredTransfers.reduce(
      (sum, item) => sum + item.transportCost,
      0
    );

    return {
      total: filteredTransfers.length,
      pending,
      approved,
      completed,
      totalProfit,
      totalTransport,
    };
  }, [filteredTransfers]);

  if (loading) {
    return (
      <div className="transfers-page">
        <div className="transfers-header">
          <h1>Transfers</h1>
          <p>Se încarcă transferurile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="transfers-page">
        <div className="transfers-header">
          <h1>Transfers</h1>
          <p className="error-text">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="transfers-page">
      <div className="transfers-header">
        <h1>Transfers</h1>
        <p>Manage stock redistribution recommendations and movement history</p>
      </div>

      <div className="transfers-stats-grid">
        <div className="transfers-card stat-card">
          <span className="card-label">Total Transfers</span>
          <h2>{stats.total}</h2>
        </div>

        <div className="transfers-card stat-card">
          <span className="card-label">Pending</span>
          <h2>{stats.pending}</h2>
        </div>

        <div className="transfers-card stat-card">
          <span className="card-label">Approved</span>
          <h2>{stats.approved}</h2>
        </div>

        <div className="transfers-card stat-card">
          <span className="card-label">Completed</span>
          <h2>{stats.completed}</h2>
        </div>

        <div className="transfers-card stat-card">
          <span className="card-label">Total Profit</span>
          <h2>{formatRON(stats.totalProfit)}</h2>
        </div>

        <div className="transfers-card stat-card">
          <span className="card-label">Transport Cost</span>
          <h2>{formatRON(stats.totalTransport)}</h2>
        </div>
      </div>

      <div className="transfers-card filters-card">
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
            <label>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Source Store</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <option value="all">All</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Destination Store</label>
            <select
              value={destinationFilter}
              onChange={(e) => setDestinationFilter(e.target.value)}
            >
              <option value="all">All</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="transfers-card">
        <div className="card-header">
          <h3>All Transfers</h3>
        </div>

        <div className="transfers-table">
          <div className="transfers-table-head">
            <span>From</span>
            <span>To</span>
            <span>Product</span>
            <span>Qty</span>
            <span>Transport Cost</span>
            <span>Profit</span>
            <span>Status</span>
            <span>Created At</span>
            <span>Actions</span>
          </div>

          {filteredTransfers.length === 0 ? (
            <div className="empty-state">No transfers found.</div>
          ) : (
            filteredTransfers.map((item) => (
              <div key={item.id} className="transfers-table-row">
                <span>{item.from}</span>
                <span>{item.to}</span>
                <span>{item.product}</span>
                <span>{item.quantity}</span>
                <span>{formatRON(item.transportCost)}</span>
                <span className="success-text">
                  {formatRON(item.estimatedProfit)}
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
                <span>{formatDate(item.createdAt)}</span>

                <span className="action-buttons">
                  {item.status.toLowerCase() === "pending" && (
                    <button
                      className="btn-primary"
                      onClick={() => handleApproveTransfer(item.id)}
                      disabled={actionLoadingId === item.id}
                    >
                      {actionLoadingId === item.id ? "Saving..." : "Approve"}
                    </button>
                  )}

                  {item.status.toLowerCase() === "approved" && (
                    <button
                      className="btn-complete"
                      onClick={() => handleCompleteTransfer(item.id)}
                      disabled={actionLoadingId === item.id}
                    >
                      {actionLoadingId === item.id ? "Saving..." : "Complete"}
                    </button>
                  )}

                  {item.status.toLowerCase() === "completed" && (
                    <span className="done-label">Done</span>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}