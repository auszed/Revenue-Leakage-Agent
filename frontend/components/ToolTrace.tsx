"use client";

import type { TraceItem } from "@/lib/api";
import { downloadInvoice } from "@/lib/invoice";
import RecordCard from "./RecordCard";

function argSig(args: unknown): string {
  if (!args || typeof args !== "object") return "";
  return Object.entries(args as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(", ");
}

function KeyVals({ obj }: { obj: Record<string, unknown> }) {
  return (
    <div className="field-grid">
      {Object.entries(obj).map(([k, v]) => (
        <div key={k} className="field">
          <span className="field-k">{k}</span>
          <span className="field-v">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
        </div>
      ))}
    </div>
  );
}

function InvoiceTable({ rows }: { rows: any[] }) {
  return (
    <table className="inv-table">
      <thead>
        <tr>
          <th>Invoice</th>
          <th>Issued</th>
          <th>Amount</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.invoice_id}>
            <td>{r.invoice_id || <em>(none)</em>}</td>
            <td>{r.issue_date}</td>
            <td>
              {Number(r.amount_invoiced).toLocaleString()} {r.currency}
            </td>
            <td>
              <span className={`pill pill-${r.status}`}>{r.status}</span>
            </td>
            <td>
              <button className="download-btn" onClick={() => downloadInvoice(r)}>
                Download
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function renderResult(output: string) {
  let data: any;
  try {
    data = JSON.parse(output);
  } catch {
    return <div className="trace-out">{output}</div>;
  }

  if (data && typeof data === "object" && "error" in data) {
    return <div className="trace-error">{String(data.error)}</div>;
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return <div className="trace-out">No matching records.</div>;
    if (typeof data[0] === "object" && "amount_invoiced" in data[0]) {
      return <InvoiceTable rows={data} />;
    }
    return <KeyVals obj={{ items: data.length }} />;
  }
  if (data.action_type) return <RecordCard record={data} />;
  if ("converted" in data && "rate" in data) {
    return (
      <div className="fx-line">
        {Number(data.amount).toLocaleString()} {data.from} = {Number(data.converted).toLocaleString()} {data.to}{" "}
        <span className="muted">@ {data.rate}</span>
      </div>
    );
  }
  if (data.plan) {
    return (
      <>
        <KeyVals obj={data.plan} />
        {Array.isArray(data.related_plans) && data.related_plans.length > 0 && (
          <div className="muted">Related: {data.related_plans.map((p: any) => p.plan_id).join(", ")}</div>
        )}
      </>
    );
  }
  if (data.record && data.record.action_type) {
    return (
      <>
        <div className="muted">{data.status}</div>
        <RecordCard record={data.record} />
      </>
    );
  }
  if (data.status) return <div className="trace-out">{data.status} {data.action_id ?? ""}</div>;
  return <KeyVals obj={data} />;
}

export default function ToolTrace({ items }: { items: TraceItem[] }) {
  return (
    <div className="trace">
      {items.map((it, i) =>
        it.type === "call" ? (
          <div key={i} className="tool-sig">
            <span className="tool-name">{it.tool}</span>
            <span className="muted">({argSig(it.args)})</span>
          </div>
        ) : (
          <div key={i} className="trace-step">{renderResult(it.output ?? "")}</div>
        )
      )}
    </div>
  );
}
