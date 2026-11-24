import { useEffect, useMemo } from "react";
import Svg, { Path, Rect } from "react-native-svg";

// The encoder already bundled by react-native-qrcode-svg. Work in module coordinates,
// so every address/version gets exactly four quiet modules, not a version-1 estimate.
const encoder = require("qrcode") as {
  create(value: string, options: { errorCorrectionLevel: "M" }): { modules: { size: number; data: Uint8Array } };
};

export function BoardQr({ value, size, onError }: { value: string; size: number; onError(): void }) {
  const symbol = useMemo(() => {
    try {
      const { size: n, data } = encoder.create(value, { errorCorrectionLevel: "M" }).modules;
      const runs: string[] = [];
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n;) {
          if (!data[y * n + x]) { x++; continue; }
          const start = x;
          while (x < n && data[y * n + x]) x++;
          runs.push(`M${start + 4} ${y + 4}h${x - start}v1h-${x - start}z`);
        }
      }
      return { extent: n + 8, path: runs.join("") };
    } catch { return undefined; }
  }, [value]);
  useEffect(() => { if (!symbol) onError(); }, [symbol, onError]);
  if (!symbol) return null;
  return <Svg width={size} height={size} viewBox={`0 0 ${symbol.extent} ${symbol.extent}`} accessible={false}>
    <Rect width={symbol.extent} height={symbol.extent} fill="#FFFFFF" />
    <Path d={symbol.path} fill="#000000" />
  </Svg>;
}
