import { useEffect, useMemo, useState } from "react";
import supabase from "../api/supabase";
import "../styles/Transfers.css";
import {
  ensureSystemState,
  getSystemState,
  markOptimizationRun,
} from "../utils/systemState";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

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

  const [optimizationLoading, setOptimizationLoading] = useState(false);
  const [optimizationMessage, setOptimizationMessage] = useState("");

  useEffect(() => {
    loadTransfersData();
  }, []);

  async function loadTransfersData() {
    try {
      setLoading(true);
      setError("");

      await ensureSystemState();

      const [
        { data: storesData, error: storesError },
        { data: productsData, error: productsError },
        { data: transfersData, error: transfersError },
      ] = await Promise.all([
        supabase.from("stores").select("*").order("name"),
        supabase.from("products").select("*").order("name"),
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

  async function handleRunOptimization() {
    try {
      setOptimizationLoading(true);
      setOptimizationMessage("");

      const systemState = await getSystemState();

      if (!systemState.stock_dirty_external) {
        setOptimizationMessage(
          "Optimization is locked. Run it again only after external stock changes like sales, restock or manual inventory edits."
        );
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/optimize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          save_results: true,
          clear_old_proposed: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Optimization failed.");
      }

      await markOptimizationRun();
      await loadTransfersData();

      setOptimizationMessage(
        `Optimization completed successfully. ${data.recommendations_count} transfer(s) generated.`
      );
    } catch (err) {
      console.error(err);
      setOptimizationMessage(
        err.message || "Nu am putut rula optimizarea."
      );
    } finally {
      setOptimizationLoading(false);
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

      const { data: transfer, error: transferError } = await supabase
        .from("transfers")
        .select("*")
        .eq("id", id)
        .single();

      if (transferError) throw transferError;

      if (!transfer) {
        throw new Error("Transferul nu a fost găsit.");
      }

      if (String(transfer.status).toLowerCase() !== "approved") {
        throw new Error("Doar transferurile aprobate pot fi finalizate.");
      }

      const sourceStoreId = transfer.source_store_id;
      const destinationStoreId = transfer.destination_store_id;
      const productId = transfer.product_id;
      const quantity = Number(transfer.quantity || 0);

      if (quantity <= 0) {
        throw new Error("Cantitatea transferului este invalidă.");
      }

      const { data: sourceInventory, error: sourceError } = await supabase
        .from("inventory")
        .select("*")
        .eq("store_id", sourceStoreId)
        .eq("product_id", productId)
        .single();

      if (sourceError) throw sourceError;

      if (!sourceInventory) {
        throw new Error("Nu există stoc sursă pentru acest transfer.");
      }

      const currentSourceQty = Number(sourceInventory.quantity || 0);

      if (currentSourceQty < quantity) {
        throw new Error("Magazinul sursă nu are suficient stoc pentru acest transfer.");
      }

      const sourceNewQty = currentSourceQty - quantity;

      const { data: destinationInventory, error: destinationFetchError } = await supabase
        .from("inventory")
        .select("*")
        .eq("store_id", destinationStoreId)
        .eq("product_id", productId)
        .maybeSingle();

      if (destinationFetchError) throw destinationFetchError;

      const destinationCurrentQty = Number(destinationInventory?.quantity || 0);
      const destinationNewQty = destinationCurrentQty + quantity;

      const { error: sourceUpdateError } = await supabase
        .from("inventory")
        .update({
          quantity: sourceNewQty,
        })
        .eq("id", sourceInventory.id);

      if (sourceUpdateError) throw sourceUpdateError;

      let destinationMutationDone = false;

      try {
        if (destinationInventory) {
          const { error: destinationUpdateError } = await supabase
            .from("inventory")
            .update({
              quantity: destinationNewQty,
            })
            .eq("id", destinationInventory.id);

          if (destinationUpdateError) throw destinationUpdateError;
        } else {
          const { error: destinationInsertError } = await supabase
            .from("inventory")
            .insert({
              store_id: destinationStoreId,
              product_id: productId,
              quantity: quantity,
              min_stock: 0,
              max_stock: null,
            });

          if (destinationInsertError) throw destinationInsertError;
        }

        destinationMutationDone = true;

        const { error: transferUpdateError } = await supabase
          .from("transfers")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", id);

        if (transferUpdateError) throw transferUpdateError;
      } catch (innerError) {
        await supabase
          .from("inventory")
          .update({
            quantity: currentSourceQty,
          })
          .eq("id", sourceInventory.id);

        if (destinationMutationDone && destinationInventory) {
          await supabase
            .from("inventory")
            .update({
              quantity: destinationCurrentQty,
            })
            .eq("id", destinationInventory.id);
        }

        throw innerError;
      }

      await loadTransfersData();
    } catch (err) {
      console.error(err);
      alert(err.message || "Nu am putut marca transferul ca finalizat.");
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
      quantity: Number(item.quantity || 0),
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

      <div className="transfers-card optimization-card">
        <div className="optimization-content">
          <div>
            <h3>Generate New Transfers</h3>
            <p>
              Run the Python optimization algorithm to generate new stock
              redistribution recommendations. You can run it again only after
              external stock changes like sales, restock or manual edits.
            </p>
          </div>

          <button
            className="btn-primary optimize-btn"
            onClick={handleRunOptimization}
            disabled={optimizationLoading}
          >
            {optimizationLoading ? "Running..." : "Run Optimization"}
          </button>
        </div>

        {optimizationMessage && (
          <p className="optimization-message">{optimizationMessage}</p>
        )}
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