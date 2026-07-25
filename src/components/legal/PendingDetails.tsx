import { pendingBusinessFields } from "@/data/business";

/**
 * A visible notice listing the business details Michaela has not supplied yet.
 *
 * These pages are a first draft written against the law rather than against her
 * circumstances, and they carry placeholders where her real details belong. A
 * placeholder that renders as ordinary body text would eventually go live and read
 * as a finished policy, so it says so loudly instead. It disappears on its own once
 * `src/data/business.ts` is filled in, with nothing else to remember to remove.
 */
export function PendingDetails() {
  const missing = pendingBusinessFields();
  if (!missing.length) return null;

  return (
    <aside
      role="note"
      style={{
        border: "2px solid #b00",
        background: "#fff4f4",
        color: "#5a0000",
        padding: "1rem 1.2rem",
        margin: "0 0 2rem",
      }}
    >
      <b style={{ display: "block", marginBottom: ".4rem" }}>
        Not ready to publish
      </b>
      <p style={{ marginBottom: ".6rem" }}>
        This page is a draft. It still needs {missing.length === 1 ? "one detail" : "these details"}:
      </p>
      <ul style={{ margin: "0 0 .6rem 1.1rem" }}>
        {missing.map((field) => (
          <li key={field}>{field}</li>
        ))}
      </ul>
      <p style={{ fontSize: ".9rem" }}>
        Fill them in at <code>src/data/business.ts</code> and this notice goes away by itself.
      </p>
    </aside>
  );
}
