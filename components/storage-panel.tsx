"use client";
import { useEffect, useState } from "react";
import { Database, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "../lib/client";
import { formatBytes } from "../lib/media-config";
type Usage = {
  used: number;
  reserved: number;
  limit: number;
  percentage: number;
  level: string;
  notifications: { id: string; threshold: number; created: number }[];
  thresholds: number[];
};
export function StoragePanel() {
  const [data, setData] = useState<Usage | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [result, setResult] = useState("");
  async function refresh() {
    try {
      setError("");
      setData(await api("storage"));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, []);
  async function action(action: "cleanup" | "acknowledge") {
    setBusy(true);
    try {
      const response = await api("storage", { action });
      if (action === "cleanup")
        setResult(
          `${response.cleaned} abandoned files cleaned. ${response.pending} still pending.`,
        );
      setConfirm(false);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="storage-panel">
      <div className="storage-summary">
        <span>
          <Database size={23} />
        </span>
        <h4>A little room to grow.</h4>
        <p>Estimated private media storage</p>
      </div>
      {error && (
        <p role="alert" className="media-error">
          {error}
        </p>
      )}
      {data && (
        <>
          <div className={"storage-meter " + data.level}>
            <strong>
              {formatBytes(data.used)}{" "}
              <small>of {formatBytes(data.limit)}</small>
            </strong>
            <progress
              max={100}
              value={Math.min(100, data.percentage)}
              aria-label="Estimated storage usage"
            />
            <p>
              {data.percentage}% including {formatBytes(data.reserved)} reserved
              for active or cancelled transfers.
            </p>
          </div>
          <div className="storage-thresholds">
            {data.thresholds.map((n, i) => (
              <span key={n} className={data.percentage >= n ? "reached" : ""}>
                {n}% · {["Early", "High", "Critical"][i]}
              </span>
            ))}
          </div>
          {data.notifications.map((n) => (
            <p className="storage-notice" key={n.id}>
              <AlertCircle size={17} />
              <span>
                Media usage reached {n.threshold}%. Review space before more
                uploads become unavailable.
              </span>
            </p>
          ))}
          {data.notifications.length > 0 && (
            <button
              className="secondary full"
              disabled={busy}
              onClick={() => void action("acknowledge")}
            >
              <CheckCircle2 size={16} />
              Mark warnings read
            </button>
          )}
          <p className="panel-note">
            These are estimates from DropBy’s D1 records, including reserved
            transfers and pending deletions. They are not Supabase billing or
            bandwidth measurements. Text messaging stays available if new
            uploads reach the configured budget.
          </p>
          <div className="storage-controls">
            <button className="secondary full" onClick={() => void refresh()}>
              <RefreshCw size={16} />
              Refresh estimate
            </button>
            <button
              className="secondary full"
              disabled={busy}
              onClick={() => setConfirm(!confirm)}
            >
              Review abandoned uploads
            </button>
          </div>
          {confirm && (
            <div className="storage-cleanup">
              <strong>Only abandoned media will be removed.</strong>
              <p>
                This cleans expired transfers older than 24 hours, cancelled
                transfers older than 10 minutes, unsent drafts older than 48
                hours, and pending deletions. Active messages, music, profile
                images, logos and wallpapers are preserved.
              </p>
              <button
                className="primary full"
                disabled={busy}
                onClick={() => void action("cleanup")}
              >
                {busy ? "Cleaning…" : "Clean abandoned uploads"}
              </button>
            </div>
          )}
          {result && <p role="status">{result}</p>}
        </>
      )}
    </div>
  );
}
