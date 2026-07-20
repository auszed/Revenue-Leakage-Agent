"use client";

export default function ApprovalCard({
  approval,
  onDecision,
  busy,
}: {
  approval: any;
  onDecision: (approved: boolean) => void;
  busy: boolean;
}) {
  const op = approval?.operation ?? "action";
  const detail = approval?.action ?? approval?.action_id ?? approval;
  return (
    <div className="approval">
      <strong>Approval required: {op}</strong>
      <pre>{JSON.stringify(detail, null, 2)}</pre>
      <div className="approval-actions">
        <button disabled={busy} onClick={() => onDecision(true)} className="approve">
          Approve
        </button>
        <button disabled={busy} onClick={() => onDecision(false)} className="reject">
          Reject
        </button>
      </div>
    </div>
  );
}
