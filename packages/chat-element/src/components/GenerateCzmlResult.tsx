import { formatToolPayload } from "../utils/format-tool-payload";
import styles from "./AiChatPanel.module.css";
import { CopyTextButton } from "./ExecuteCesiumCodeResult";

/**
 * Renders generated CZML as formatted JSON with the same copy affordance used
 * for generated CesiumJS code, while keeping result metadata separate.
 */
export function GenerateCzmlResult({ result }: { result: unknown }) {
  if (result === null || typeof result !== "object") {
    return <pre className={styles.toolResult}>{formatToolPayload(result)}</pre>;
  }

  const { czml, ...metadata } = result as Record<string, unknown>;
  const hasMetadata = Object.keys(metadata).length > 0;
  const formattedCzml = Array.isArray(czml) ? JSON.stringify(czml, null, 2) : undefined;

  return (
    <>
      {hasMetadata && <pre className={styles.toolResult}>{formatToolPayload(metadata)}</pre>}
      {formattedCzml && (
        <div className={styles.codeBlockWrapper}>
          <pre className={styles.codeBlock}>{formattedCzml}</pre>
          <CopyTextButton text={formattedCzml} label="Copy CZML" />
        </div>
      )}
    </>
  );
}
