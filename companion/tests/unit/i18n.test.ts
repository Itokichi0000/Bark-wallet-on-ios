import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { translate } from "@/i18n";
import { en } from "@/i18n/en";
import { ja } from "@/i18n/ja";

const root = join(__dirname, "..", "..");
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(ts|tsx)$/.test(name) && !p.includes("/i18n/") ? [p] : [];
  });
}
const code = [...sources(join(root, "src")), ...sources(join(root, "app"))].map((p) => readFileSync(p, "utf8")).join("\n");

describe("i18n", () => {
  it("has the same keys in Japanese and English", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ja).sort());
  });

  it("has no empty strings and the same placeholders in both languages", () => {
    for (const key of Object.keys(ja)) {
      const a = ja[key] ?? "";
      const b = en[key] ?? "";
      expect(a.trim()).not.toBe("");
      expect(b.trim()).not.toBe("");
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      expect([key, ph(b)]).toEqual([key, ph(a)]);
    }
  });

  it("defines every key the code refers to literally", () => {
    const used = new Set<string>();
    for (const m of code.matchAll(/\bt\("([^"]+)"/g)) used.add(m[1] ?? "");
    for (const m of code.matchAll(/lineKey: "([^"]+)"/g)) used.add(m[1] ?? "");
    for (const m of code.matchAll(/"((?:talk\.example|avatar|voice|status)\.[A-Za-z.]+)"/g)) used.add(m[1] ?? "");
    const missing = [...used].filter((k) => !(k in ja));
    expect(missing).toEqual([]);
    expect(used.size).toBeGreaterThan(200);
  });

  it("defines every key built from a template", () => {
    const families: Record<string, string[]> = {
      "avatar.menu.": ["send", "receive", "assets", "archive"],
      "archive.direction.": ["incoming", "outgoing", "internal"],
      "archive.status.": ["succeeded", "pending", "failed", "unknown"],
      "assets.health.": ["ok", "refresh-soon", "refresh-required", "locked"],
      "backup.status.": ["never", "pending", "current", "stale", "failed", "unsupported"],
      "boot.": ["booting", "not-created", "creating", "opening", "syncing", "ready", "degraded", "recovering", "error"],
      "boot.error.": ["orphan-database", "seed-without-database"],
      "method.": ["ark", "lightning", "other"],
      "send.amount.": ["empty", "not-a-number", "negative", "fractional", "too-large", "zero"],
      "send.invalid.": ["empty", "unrecognised", "wrong-network", "other-server", "expired", "method-not-enabled", "amount-mismatch", "needs-connection"],
      "send.max.": ["nothing-spendable", "fee-exceeds-balance"],
      "status.": ["online", "syncing", "degraded", "offline", "maintenanceRequired"],
      "recovery.error.": ["not-a-backup", "unsupported-version", "corrupt", "wrong-seed-or-tampered", "wrong-network", "wallet-already-present", "older-than-current", "different-wallet", "verify-failed", "io"],
      "quest.": ["q1.title", "q1.body", "q2.title", "q2.body", "q3.title", "q3.body", "q4.title", "q4.body", "q5.title", "q5.body", "q6.title", "q6.body"],
    };
    const missing = Object.entries(families).flatMap(([prefix, names]) => names.map((n) => prefix + n)).filter((k) => !(k in ja));
    expect(missing).toEqual([]);
  });

  it("carries the safety-critical messages in both languages", () => {
    const critical = [
      "net.signetLong", "seed.warning", "send.unknown.noResend", "send.pending.body", "review.irreversible",
      "recovery.seedOnly.limits", "backup.explain1", "backup.explain2", "assets.maintenance.caveat",
      "assets.ops.notEnabled", "voice.secretRefused", "boot.error.noAutoCreate", "mock.banner", "status.backupNotExported",
    ];
    for (const key of critical) {
      expect(ja[key]?.length ?? 0).toBeGreaterThan(8);
      expect(en[key]?.length ?? 0).toBeGreaterThan(8);
    }
  });

  it("substitutes parameters and falls back to the key", () => {
    expect(translate("en", "voice.balance", { amount: "500 sats" })).toBe("Your spendable balance is 500 sats.");
    expect(translate("ja", "onb.quizAsk", { n: 3 })).toBe("3 番目の単語はどれ？");
    expect(translate("ja", "no.such.key")).toBe("no.such.key");
  });
});
