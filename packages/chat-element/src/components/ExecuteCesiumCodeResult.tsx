import { useState } from "react";
import { IconButton, Tooltip } from "@mui/material";
import { Icon } from "@stratakit/mui";
import svgCopy from "@stratakit/icons/copy.svg";
import svgCheckmark from "@stratakit/icons/checkmark.svg";
import { formatToolPayload } from "../utils/format-tool-payload";
import styles from "./AiChatPanel.module.css";

/**
 * Specialized result renderer for the `executeCesiumCode` tool: its `code`
 * field is real CesiumJS source (often long), so it gets a dedicated
 * `.codeBlock` style — unwrapped lines with both vertical AND horizontal
 * scrolling (unlike the generic `.toolResult`, which word-wraps), so long
 * lines/indentation stay readable instead of being squeezed or breaking
 * mid-token — plus a copy button. `error` (AST-verification/generation
 * failure) and `executionError` (runtime failure) are intentionally NOT
 * rendered here — {@link ToolCard} (see `ToolCard.tsx`) pulls both out and
 * shows them in their own separate, error-styled panels instead (see
 * `ToolResultErrorPanel`), so a failure reads as clearly distinct from a
 * successful result rather than blending into the plain result text. Any
 * other result field still renders via the generic {@link formatToolPayload}.
 */
export function ExecuteCesiumCodeResult({ result }: { result: unknown }) {
  if (result === null || typeof result !== "object") {
    return <pre className={styles.toolResult}>{formatToolPayload(result)}</pre>;
  }
  const {
    code,
    executionError: _executionError,
    error: _error,
    ...rest
  } = result as Record<string, unknown>;
  const hasOtherFields = Object.keys(rest).length > 0;
  return (
    <>
      {hasOtherFields && <pre className={styles.toolResult}>{formatToolPayload(rest)}</pre>}
      {typeof code === "string" && (
        <div className={styles.codeBlockWrapper}>
          <pre className={styles.codeBlock}>{code}</pre>
          <CopyCodeButton code={code} />
        </div>
      )}
    </>
  );
}

type CopyState = "idle" | "copied" | "error";

/**
 * Copies generated code to the clipboard via the `navigator.clipboard` API.
 * Rendered as a small icon button overlaid in the corner of the code panel
 * (not the `<summary>` toggle, so no click-propagation concerns with the
 * parent `<details>`), swapping to a checkmark icon briefly on success before
 * resetting to the plain copy icon after 1.5s.
 */
function CopyCodeButton({ code }: { code: string }) {
  const [state, setState] = useState<CopyState>("idle");

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setState("copied");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 1500);
  };

  const label = state === "copied" ? "Copied!" : state === "error" ? "Copy failed" : "Copy code";

  return (
    <Tooltip title={label}>
      <IconButton
        aria-label={label}
        size="small"
        className={styles.copyButton}
        onClick={handleClick}
      >
        <Icon href={state === "copied" ? svgCheckmark : svgCopy} />
      </IconButton>
    </Tooltip>
  );
}
