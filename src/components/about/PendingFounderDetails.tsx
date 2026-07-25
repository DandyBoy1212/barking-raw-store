import { pendingFounderFields } from "@/data/founder";

/**
 * A visible notice that this page is a draft awaiting Michaela's sign-off.
 *
 * The story on the page is hers and the training claims are the trust argument
 * for the whole site, so a drafted version reading as finished copy is the
 * failure this exists to prevent. It disappears on its own once
 * src/data/founder.ts is filled in, with nothing else to remember to remove.
 */
export function PendingFounderDetails() {
  const missing = pendingFounderFields();
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
        Draft awaiting Michaela&apos;s sign-off
      </b>
      <p style={{ marginBottom: ".6rem" }}>
        This page was drafted from the project notes, not by her. It still needs:
      </p>
      <ul style={{ margin: "0 0 .6rem 1.1rem" }}>
        {missing.map((field) => (
          <li key={field}>{field}</li>
        ))}
      </ul>
      <p style={{ fontSize: ".9rem" }}>
        What to send is listed in <code>docs/about-details-for-michaela.md</code>. Fill it in at{" "}
        <code>src/data/founder.ts</code> and this notice goes away by itself.
      </p>
    </aside>
  );
}
