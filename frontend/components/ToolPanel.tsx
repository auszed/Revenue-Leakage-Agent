"use client";

import type { ToolInfo } from "@/lib/api";

export default function ToolPanel({
  tools,
  enabled,
  onToggle,
}: {
  tools: ToolInfo[];
  enabled: Record<string, boolean>;
  onToggle: (name: string) => void;
}) {
  return (
    <aside className="panel">
      <h2>Tools</h2>
      <p className="hint">Enable the tools the agent may use. Write tools need your approval.</p>
      <ul className="tool-list">
        {tools.map((t) => (
          <li key={t.name}>
            <label>
              <input
                type="checkbox"
                checked={!!enabled[t.name]}
                onChange={() => onToggle(t.name)}
              />
              <span className="tool-name">{t.name}</span>
            </label>
            <span className="tool-desc">{t.description}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
