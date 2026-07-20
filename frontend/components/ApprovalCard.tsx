"use client";

import type { Draft } from "@/lib/api";
import RecordCard from "./RecordCard";

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
  const action = approval?.action as Draft | undefined;
  return (
    <div className="approval">
      <strong>Approval required: {op}</strong>
      {action ? (
        <RecordCard record={action} />
      ) : (
        <p className="record-reason">Roll back action {approval?.action_id}</p>
      )}
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
