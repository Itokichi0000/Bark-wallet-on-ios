import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

export function QrCode({ value, alt }: { value: string; alt: string }) {
  const [svg, setSvg] = useState<string>('');
  useEffect(() => {
    let alive = true;
    QRCode.toString(value, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#111111', light: '#ffffff' } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(''));
    return () => {
      alive = false;
    };
  }, [value]);
  return (
    <div role="img" aria-label={alt} className="mx-auto aspect-square w-full max-w-60 overflow-hidden rounded-xl bg-white p-1 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
