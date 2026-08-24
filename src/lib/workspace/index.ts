import crypto from "crypto";

/**
 * WorkspaceProvider abstraction (Phase 7).
 *
 * The academy never talks to infrastructure directly — it asks a provider to
 * provision a workspace and records the result. Swap the provider (or route by
 * config) to move from the internal placeholder to a real cloud environment
 * (containers, dev boxes, git-backed sandboxes) without touching the UI.
 */

export interface ProvisionResult {
  provider: string;
  externalId: string;
  url: string | null;
  status: "PROVISIONING" | "READY";
}

export interface WorkspaceProvider {
  name: string;
  provision(input: { userId: string; email: string }): Promise<ProvisionResult>;
  status(externalId: string): Promise<"PROVISIONING" | "READY" | "SUSPENDED">;
}

/** Internal provider: provisions a logical workspace instantly. */
class InternalWorkspaceProvider implements WorkspaceProvider {
  name = "INTERNAL";

  async provision(): Promise<ProvisionResult> {
    return {
      provider: this.name,
      externalId: `ws_${crypto.randomBytes(8).toString("hex")}`,
      url: null, // no external console yet — environment boots inside UCA Sandbox
      status: "READY",
    };
  }

  async status() {
    return "READY" as const;
  }
}

export function getWorkspaceProvider(): WorkspaceProvider {
  // Provider selection is config-driven so infrastructure can change later.
  switch (process.env.WORKSPACE_PROVIDER) {
    default:
      return new InternalWorkspaceProvider();
  }
}
