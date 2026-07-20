"use client";

import type { Draft } from "@/lib/api";
import { downloadInvoice } from "@/lib/invoice";

const LABELS: Record<string, string> = {
  make_good_invoice: "Make-good Invoice",
  credit_memo: "Credit Memo",
  plan_amendment: "Plan Amendment",
};

function money(amount?: number, currency?: string): string | null {
  if (amount == null) return null;
  return `${amount.toLocaleString()} ${currency ?? ""}`.trim();
}

export default function RecordCard({ record }: { record: Draft }) {
  const label = LABELS[record.action_type] ?? record.action_type;
  const headId = record.invoice_id ?? record.memo_id ?? record.amendment_id;

  const rows: [string, string][] = [];
  if (record.plan_id) rows.push(["Plan", record.plan_id]);
  // For a credit memo the head id is the memo; the invoice_id is the target invoice.
  if (record.invoice_id && record.action_type !== "make_good_invoice") {
    rows.push(["Invoice", record.invoice_id]);
  }
  if (record.customer_name) rows.push(["Customer", record.customer_name]);
  const m = money(record.amount, record.currency);
  if (m) rows.push(["Amount", m]);
  if (record.applied_at) rows.push(["Applied", new Date(record.applied_at).toLocaleString()]);

  return (
    <div className="record-card">
      <div className="record-head">
        <span className={`badge badge-${record.action_type}`}>{label}</span>
        {headId && <span className="record-id">{headId}</span>}
      </div>

      <div className="field-grid">
        {rows.map(([k, v]) => (
          <div key={k} className="field">
            <span className="field-k">{k}</span>
            <span className="field-v">{v}</span>
          </div>
        ))}
        {record.change_set &&
          Object.entries(record.change_set).map(([k, v]) => (
            <div key={k} className="field">
              <span className="field-k">{k}</span>
              <span className="field-v">{String(v)}</span>
            </div>
          ))}
      </div>

      {record.reason && <p className="record-reason">{record.reason}</p>}

      {record.action_type === "make_good_invoice" && record.invoice_id && (
        <div className="record-actions">
          <button className="download-btn" onClick={() => downloadInvoice(record)}>
            Download invoice
          </button>
        </div>
      )}
    </div>
  );
}
