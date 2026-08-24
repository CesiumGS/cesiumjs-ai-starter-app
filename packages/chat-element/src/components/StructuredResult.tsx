import { useState } from "react";
import { IconButton, Tooltip } from "@mui/material";
import { Icon } from "@stratakit/mui";
import svgCopy from "@stratakit/icons/copy.svg";
import svgCheckmark from "@stratakit/icons/checkmark.svg";
import { formatToolPayload } from "../utils/format-tool-payload";
import styles from "./AiChatPanel.module.css";

/**
 * One field of a `structuredResult`-configured tool's result that gets its own error-styled panel
 * (see `ToolCard.tsx`'s `ToolResultErrorPanel`) instead of appearing in the generic/structured
 * result output. `title` may depend on other fields in the same result (e.g. `generateCzml`'s
 * `error` reads "Load error" when a `czml` document is also present — generation succeeded but the
 * later browser-side load failed — or "Generation error" when it's absent).
 */
export interface StructuredResultErrorField {
  /** Result field holding this error's message, when present as a string. */
  field: string;
  /** Panel title, or a function computing one from the full result object. */
  title: string | ((result: Record<string, unknown>) => string);
  /** `data-testid` on the rendered panel. */
  testId: string;
}

/**
 * Configures the dedicated rendering {@link StructuredResult} gives one tool's result field,
 * instead of the generic JSON result view — this repo's `executeCesiumCode` (`field: "code"`) and
 * `generateCzml` (`field: "czml"`) both use this to get a `.codeBlock` panel with a copy button,
 * plus their own error fields broken out into separate panels. Passed to `AiChatPanel` via its
 * `structuredResults` prop.
 */
export interface StructuredResultRenderer {
  /** Tool name this structured rendering applies to. */
  toolName: string;
  /** Result field holding the structured content to render in a `.codeBlock` panel. */
  field: string;
  /**
   * Formats `field`'s value into displayable text. Defaults to the raw string, or pretty-printed
   * JSON for anything else (e.g. `generateCzml`'s `czml` array).
   */
  format?: (value: unknown) => string;
  /** Label for the copy button, e.g. "Copy code" / "Copy CZML". */
  copyLabel: string;
  /** Fields shown in their own error panel instead of the generic result output — see {@link StructuredResultErrorField}. */
  errorFields?: StructuredResultErrorField[];
}

function defaultFormat(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

/**
 * Renders a tool result whose `config.field` holds dedicated content (real CesiumJS source,
 * a CZML document, ...): that field gets its own `.codeBlock` panel — unwrapped lines with both
 * vertical AND horizontal scrolling (unlike the generic `.toolResult`, which word-wraps), so long
 * lines/indentation stay readable — plus a copy button. `config.field` and every
 * `config.errorFields` entry are excluded from the generic dump of any other result fields;
 * {@link ToolCard} pulls the error fields out separately and shows each in its own
 * error-styled panel, so a failure reads as clearly distinct from a successful result.
 */
export function StructuredResult({
  result,
  config,
}: {
  result: unknown;
  config: StructuredResultRenderer;
}) {
  if (result === null || typeof result !== "object") {
    return <pre className={styles.toolResult}>{formatToolPayload(result)}</pre>;
  }

  const record = result as Record<string, unknown>;
  const metadata = { ...record };
  delete metadata[config.field];
  for (const errorField of config.errorFields ?? []) {
    delete metadata[errorField.field];
  }
  const hasMetadata = Object.keys(metadata).length > 0;

  const fieldValue = record[config.field];
  const formatted =
    fieldValue !== undefined ? (config.format ?? defaultFormat)(fieldValue) : undefined;

  return (
    <>
      {hasMetadata && <pre className={styles.toolResult}>{formatToolPayload(metadata)}</pre>}
      {formatted && (
        <div className={styles.codeBlockWrapper}>
          <pre className={styles.codeBlock}>{formatted}</pre>
          <CopyTextButton text={formatted} label={config.copyLabel} />
        </div>
      )}
    </>
  );
}

type CopyState = "idle" | "copied" | "error";

/**
 * Copies generated text to the clipboard via the `navigator.clipboard` API.
 * Rendered as a small icon button overlaid in the corner of the content panel
 * (not the `<summary>` toggle, so no click-propagation concerns with the
 * parent `<details>`), swapping to a checkmark icon briefly on success before
 * resetting to the plain copy icon after 1.5s.
 */
export function CopyTextButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<CopyState>("idle");

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 1500);
  };

  const accessibleLabel =
    state === "copied" ? "Copied!" : state === "error" ? "Copy failed" : label;

  return (
    <Tooltip title={accessibleLabel}>
      <IconButton
        aria-label={accessibleLabel}
        size="small"
        className={styles.copyButton}
        onClick={handleClick}
      >
        <Icon href={state === "copied" ? svgCheckmark : svgCopy} />
      </IconButton>
    </Tooltip>
  );
}
