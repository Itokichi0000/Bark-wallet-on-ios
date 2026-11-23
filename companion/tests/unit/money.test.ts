import { MAX_SATS, btcDecimalToSats, formatBtc, formatSats, fromMoney, parseSatsInput, toMoney } from "@/domain/money";

describe("parseSatsInput", () => {
  const ok = (s: string) => {
    const r = parseSatsInput(s);
    if (!r.ok) throw new Error(`expected ok for ${JSON.stringify(s)}, got ${r.reason}`);
    return r.sats;
  };
  const bad = (s: string) => {
    const r = parseSatsInput(s);
    return r.ok ? "ok" : r.reason;
  };

  it("accepts whole numbers", () => {
    expect(ok("1")).toBe(1n);
    expect(ok("0")).toBe(0n);
    expect(ok("000500")).toBe(500n);
    expect(ok("2100000000000000")).toBe(MAX_SATS);
  });
  it("accepts grouping, spaces and full-width digits", () => {
    expect(ok("1,234,567")).toBe(1234567n);
    expect(ok(" 1 000 ")).toBe(1000n);
    expect(ok("１２３")).toBe(123n);
    expect(ok("1_000")).toBe(1000n);
  });
  it("rejects everything that is not a whole non-negative number", () => {
    expect(bad("")).toBe("empty");
    expect(bad("   ")).toBe("empty");
    expect(bad("-5")).toBe("negative");
    expect(bad("1.5")).toBe("fractional");
    expect(bad("0.00001")).toBe("fractional");
    expect(bad("abc")).toBe("not-a-number");
    expect(bad("1e3")).toBe("not-a-number");
    expect(bad("0x10")).toBe("not-a-number");
    expect(bad("12 sats")).toBe("not-a-number");
    expect(bad("+5")).toBe("not-a-number");
  });
  it("rejects amounts above 21M BTC and absurd lengths", () => {
    expect(bad("2100000000000001")).toBe("too-large");
    expect(bad("9".repeat(400))).toBe("too-large");
  });
  it("is exact above Number.MAX_SAFE_INTEGER-sized inputs", () => {
    expect(ok("2099999999999999")).toBe(2099999999999999n);
  });
});

describe("money strings", () => {
  it("round-trips", () => {
    expect(fromMoney(toMoney(123456789n))).toBe(123456789n);
  });
  it("only accepts canonical strings", () => {
    for (const s of ["", "01", "-1", "1.0", " 1", "1e3", "abc"]) expect(() => fromMoney(s)).toThrow();
    expect(() => toMoney(-1n)).toThrow();
  });
});

describe("formatting", () => {
  it("groups sats", () => {
    expect(formatSats(0n)).toBe("0");
    expect(formatSats(999n)).toBe("999");
    expect(formatSats(1234567n)).toBe("1,234,567");
  });
  it("renders BTC exactly", () => {
    expect(formatBtc(1234n)).toBe("0.00001234");
    expect(formatBtc(100_000_000n)).toBe("1.00000000");
    expect(formatBtc(2_100_000_000_000_000n)).toBe("21,000,000.00000000");
  });
  it("converts BIP 321 decimal BTC without floating point", () => {
    expect(btcDecimalToSats("0.1")).toBe(10_000_000n);
    expect(btcDecimalToSats("0.00000001")).toBe(1n);
    expect(btcDecimalToSats("0.29")).toBe(29_000_000n); // 0.29 * 1e8 is 28999999.999999996 in floating point
    expect(btcDecimalToSats("1")).toBe(100_000_000n);
    expect(btcDecimalToSats("0.000000001")).toBeUndefined();
    expect(btcDecimalToSats("1e-8")).toBeUndefined();
    expect(btcDecimalToSats("-1")).toBeUndefined();
    expect(btcDecimalToSats("21000001")).toBeUndefined();
  });
});
