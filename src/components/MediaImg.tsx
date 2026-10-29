import type { ImgHTMLAttributes } from "react";
import { useMediaSrc } from "../hooks/useMediaSrc";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
};

/** Drop-in <img> that bypasses free-ngrok interstitial on phones. */
export function MediaImg({ src, alt = "", ...rest }: Props) {
  const resolved = useMediaSrc(src);
  if (!resolved) return null;
  return <img src={resolved} alt={alt} {...rest} />;
}
