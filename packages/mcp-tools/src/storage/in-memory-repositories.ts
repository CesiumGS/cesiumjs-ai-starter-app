import type { ConnectedMcpConnection, PendingMcpConnection } from "./models.js";
import type {
  McpConnectedConnectionRepository,
  McpPendingConnectionRepository,
} from "./repositories.js";

export function createInMemoryPendingRepository(): McpPendingConnectionRepository {
  const byId = new Map<string, PendingMcpConnection>();
  const byState = new Map<string, PendingMcpConnection>();

  return {
    findById: (id) => byId.get(id),
    findByState: (state) => byState.get(state),
    save(id, entry) {
      byId.set(id, entry);
      byState.set(entry.state, entry);
    },
    delete(id) {
      const entry = byId.get(id);
      if (!entry) return;
      byId.delete(id);
      byState.delete(entry.state);
    },
  };
}

export function createInMemoryConnectedRepository(): McpConnectedConnectionRepository {
  const byId = new Map<string, ConnectedMcpConnection>();

  return {
    findById: (id) => byId.get(id),
    save(id, entry) {
      byId.set(id, entry);
    },
    delete(id) {
      byId.delete(id);
    },
    listAll: () => [...byId.values()],
  };
}
