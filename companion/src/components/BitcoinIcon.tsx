import { SvgXml } from "react-native-svg";
import { bitcoinIcons } from "../../assets/bitcoin-icons/icons";
import { theme } from "@/theme";

export type BitcoinIconName = keyof typeof bitcoinIcons;

/** Decorative; the enclosing control supplies the translated accessible name. */
export function BitcoinIcon({ name, size = 24, color = theme.colors.primary }: {
  name: BitcoinIconName; size?: number; color?: string;
}) {
  return <SvgXml xml={bitcoinIcons[name]} width={size} height={size} color={color} accessible={false} pointerEvents="none" />;
}
