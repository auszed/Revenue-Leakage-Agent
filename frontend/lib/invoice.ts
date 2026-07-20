// Build a printable invoice document and open it in a print window (Save as PDF).
// Accepts either a query_invoices row or an applied make-good record.

type AnyInvoice = Record<string, any>;

type Normalized = {
  id: string;
  customer: string;
  plan: string;
  amount: number | null;
  currency: string;
  date: string;
  due?: string;
  status?: string;
  description?: string;
};

function normalize(inv: AnyInvoice): Normalized {
  return {
    id: inv.invoice_id ?? "(unassigned)",
    customer: inv.customer_name ?? "-",
    plan: inv.plan_id || "-",
    amount: inv.amount_invoiced ?? inv.amount ?? null,
    currency: inv.currency ?? "",
    date: inv.issue_date ?? inv.applied_at ?? "",
    due: inv.due_date,
    status: inv.status,
    description: inv.description ?? inv.reason,
  };
}

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string
  );
}

function invoiceHtml(n: Normalized): string {
  const amount = n.amount == null ? "-" : `${Number(n.amount).toLocaleString()} ${esc(n.currency)}`;
  const date = n.date ? esc(n.date).slice(0, 10) : "-";
  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(n.id)}</title>
<style>
  body { font-family: system-ui, Arial, sans-serif; color: #111; margin: 40px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 16px; }
  .issuer { font-size: 18px; font-weight: 700; }
  h1 { font-size: 28px; margin: 0; letter-spacing: 2px; }
  .meta { margin-top: 4px; color: #555; font-size: 13px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 24px 0; font-size: 14px; }
  .k { color: #777; font-size: 12px; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; }
  th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #ddd; }
  td.amt, th.amt { text-align: right; }
  .total { text-align: right; font-size: 18px; font-weight: 700; margin-top: 16px; }
  .print-btn { margin-top: 28px; padding: 10px 18px; border: none; border-radius: 6px; background: #2b5cff; color: #fff; font-weight: 600; cursor: pointer; }
  @media print { .print-btn { display: none; } body { margin: 20px; } }
</style></head><body>
  <div class="top">
    <div><div class="issuer">Revenue Leakage Agent</div><div class="meta">Billing &amp; Recovery</div></div>
    <div style="text-align:right"><h1>INVOICE</h1><div class="meta">${esc(n.id)}</div></div>
  </div>
  <div class="grid">
    <div><div class="k">Bill to</div><div>${esc(n.customer)}</div></div>
    <div><div class="k">Plan</div><div>${esc(n.plan)}</div></div>
    <div><div class="k">Issue date</div><div>${date}</div></div>
    <div><div class="k">Due date</div><div>${n.due ? esc(n.due) : "-"}</div></div>
    ${n.status ? `<div><div class="k">Status</div><div>${esc(n.status)}</div></div>` : ""}
  </div>
  <table>
    <thead><tr><th>Description</th><th class="amt">Amount</th></tr></thead>
    <tbody><tr><td>${esc(n.description || "Subscription billing")}</td><td class="amt">${amount}</td></tr></tbody>
  </table>
  <div class="total">Total: ${amount}</div>
  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  <script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
</body></html>`;
}

export function downloadInvoice(inv: AnyInvoice): void {
  const html = invoiceHtml(normalize(inv));
  const w = window.open("", "_blank", "width=820,height=940");
  if (!w) return; // popup blocked
  w.document.write(html);
  w.document.close();
  w.focus();
}
