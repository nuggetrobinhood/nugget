import type { IngestAdapter } from "../../lib/types";
import { config } from "../config";
import { MockAdapter } from "./mock";
import { BitqueryAdapter } from "./bitquery";

/**
 * Adapter factory. To move NUGGET off Bitquery (e.g. to a Goldsky subgraph or
 * a raw-RPC ingester), add a class that implements IngestAdapter and register
 * it here. Nothing else in the codebase needs to change.
 */
export function makeAdapter(): IngestAdapter {
  switch (config.adapter) {
    case "bitquery":
      return new BitqueryAdapter();
    case "mock":
      return new MockAdapter();
    default:
      throw new Error(`Unknown INGEST_ADAPTER: ${config.adapter}`);
  }
}
