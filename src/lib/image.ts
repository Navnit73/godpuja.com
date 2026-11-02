// Responsive storefront images without routing every pasted URL through an image optimizer.
// Cloudinary delivery URLs get on-the-fly transforms (modern format, automatic quality, capped width) plus a srcset;
// any other URL is used as-is.

const CLOUDINARY = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(v\d+\/.+)$/;
const WIDTHS = [320, 480, 640, 960, 1280, 1600];

/** Cloudinary URL resized to `width` (never upscaled), or the original URL for other hosts / already-transformed URLs. */
export function sized(url: string, width: number) {
  const m = CLOUDINARY.exec(url);
  return m ? `${m[1]}f_auto,q_auto,c_limit,w_${width}/${m[2]}` : url;
}

/**
 * `src` / `srcSet` / `sizes` for an <img>. `maxWidth` is the largest CSS width the image is ever shown at; srcset
 * candidates go up to twice that for high-density screens.
 */
export function responsive(url: string, sizes: string, maxWidth: number) {
  if (!CLOUDINARY.test(url)) return { src: url };
  const widths = WIDTHS.filter((w) => w <= maxWidth * 2);
  if (!widths.length) widths.push(WIDTHS[0]);
  return {
    src: sized(url, widths[Math.min(widths.length - 1, 2)]),
    srcSet: widths.map((w) => `${sized(url, w)} ${w}w`).join(", "),
    sizes,
  };
}
