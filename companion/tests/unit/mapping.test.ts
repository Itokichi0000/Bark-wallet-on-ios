import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BARK_SDK_VERSION, SIGNET } from "@/infrastructure/bark/barkConfig";
import { type SdkMovementLike, maintenanceSeverity, mapMovement, mapMovementStatus, vtxoHealth } from "@/infrastructure/bark/mapping";
import { ENABLED_SEND_METHODS } from "@/domain/wallet";

const movement = (over: Partial<SdkMovementLike> = {}): SdkMovementLike => ({
  id: 7, status: "successful", subsystemName: "bark.arkoor", subsystemKind: "send", effectiveBalanceSats: -500n,
  offchainFeeSats: 0n, sentToAddresses: ["tark1dest"], receivedOnAddresses: [], createdAt: "2026-01-01T00:00:00Z", ...over,
});

describe("Bark mapping", () => {
  it("maps the SDK's status words without inventing success", () => {
    expect(mapMovementStatus("successful")).toBe("succeeded");
    expect(mapMovementStatus("pending")).toBe("pending");
    expect(mapMovementStatus("failed")).toBe("failed");
    expect(mapMovementStatus("canceled")).toBe("failed");
    expect(mapMovementStatus("some-future-status")).toBe("unknown");
    expect(mapMovementStatus("")).toBe("unknown");
  });

  it("maps an outgoing arkoor movement", () => {
    expect(mapMovement(movement())).toMatchObject({
      id: "7", method: "ark", kind: "arkoor.send", direction: "outgoing", amountSats: "500", status: "succeeded", rawStatus: "successful", counterparty: "tark1dest",
    });
  });

  it("maps incoming, lightning and internal movements", () => {
    expect(mapMovement(movement({ effectiveBalanceSats: 1200n, subsystemKind: "receive", receivedOnAddresses: ["tark1me"], sentToAddresses: [] }))).toMatchObject({ direction: "incoming", amountSats: "1200", counterparty: "tark1me" });
    expect(mapMovement(movement({ subsystemName: "bark.lightning_send", subsystemKind: "send" })).method).toBe("lightning");
    expect(mapMovement(movement({ subsystemName: "bark.round", subsystemKind: "refresh", effectiveBalanceSats: 0n }))).toMatchObject({ method: "other", direction: "internal", amountSats: "0" });
  });

  it("grades VTXO health from the SDK's verdict first", () => {
    expect(vtxoHealth({ locked: true, sdkSaysRefresh: true, blocksToExpiry: 1 })).toBe("locked");
    expect(vtxoHealth({ locked: false, sdkSaysRefresh: true, blocksToExpiry: 5000 })).toBe("refresh-required");
    expect(vtxoHealth({ locked: false, sdkSaysRefresh: false, blocksToExpiry: 432 })).toBe("refresh-soon");
    expect(vtxoHealth({ locked: false, sdkSaysRefresh: false, blocksToExpiry: 433 })).toBe("ok");
    expect(vtxoHealth({ locked: false, sdkSaysRefresh: false })).toBe("ok");
  });

  it("grades maintenance severity", () => {
    expect(maintenanceSeverity({ vtxosToRefresh: 1 })).toBe("urgent");
    expect(maintenanceSeverity({ vtxosToRefresh: 0, tipHeight: 1000, firstExpiryHeight: 1100 })).toBe("urgent");
    expect(maintenanceSeverity({ vtxosToRefresh: 0, tipHeight: 1000, firstExpiryHeight: 5000, nextRequiredRefreshHeight: 1400 })).toBe("notice");
    expect(maintenanceSeverity({ vtxosToRefresh: 0, tipHeight: 1000, firstExpiryHeight: 5000, nextRequiredRefreshHeight: 4000 })).toBe("none");
    expect(maintenanceSeverity({ vtxosToRefresh: 0, firstExpiryHeight: 5 })).toBe("none");
  });
});

describe("build configuration", () => {
  const root = join(__dirname, "..", "..");
  it("records the SDK version that is actually installed", () => {
    const pkg = JSON.parse(readFileSync(join(root, "node_modules/@secondts/bark-react-native/package.json"), "utf8")) as { version: string };
    expect(BARK_SDK_VERSION).toBe(pkg.version);
  });

  it("is Signet-only: no mainnet endpoint or network constant anywhere in the app", () => {
    expect(SIGNET.serverAddress).toBe("https://ark.signet.2nd.dev");
    expect(SIGNET.esploraAddress).toBe("https://esplora.signet.2nd.dev");
    const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
    const offenders = [...walk(join(root, "src")), ...walk(join(root, "app")), join(root, "app.config.ts")].filter((p) => {
      const text = readFileSync(p, "utf8");
      return /Network\.Bitcoin|ark\.second\.tech|mempool\.second\.tech/.test(text);
    });
    expect(offenders).toEqual([]);
  });

  it("only enables the Ark rail", () => {
    expect([...ENABLED_SEND_METHODS]).toEqual(["ark"]);
  });

  it("keeps the avatar and voice layers away from keys and payment execution", () => {
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    const forbidden = /SecureSeedRepository|bark-react-native|sendReviewedPayment|confirmSend|BackupManager|expo-secure-store/;
    for (const dir of ["src/game", "src/voice"]) {
      for (const name of readdirSync(join(root, dir))) {
        const text = readFileSync(join(root, dir, name), "utf8");
        expect([name, forbidden.test(text)]).toEqual([name, false]);
      }
    }
  });

  it("never logs from wallet code", () => {
    const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
    const offenders = [...walk(join(root, "src")), ...walk(join(root, "app"))].filter((p) => /console\.(log|info|debug|warn|error)/.test(readFileSync(p, "utf8")));
    expect(offenders).toEqual([]);
  });
});
