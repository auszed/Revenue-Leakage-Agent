"use client";

import type { Draft } from "@/lib/api";
import RecordCard from "./RecordCard";

export default function ProposalCard({
  draft,
  onAccept,
  onDismiss,
  busy,
}: {
  draft: Draft;
  onAccept: (draft: Draft) => void;
  onDismiss: () => void;
  busy: boolean;
}) {
  return (
    <div className="proposal">
      <strong className="proposal-title">Proposed corrective action</strong>
      <RecordCard record={draft} />
      <div className="approval-actions">
        <button disabled={busy} onClick={() => onAccept(draft)} className="approve">
          Accept
        </button>
        <button disabled={busy} onClick={onDismiss} className="reject">
          Dismiss
        </button>
      </div>
    </div>
  );
}
