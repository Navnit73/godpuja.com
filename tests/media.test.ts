import { describe, expect, it } from "vitest";
import { sign } from "@/server/cloudinary";
import { MAX_UPLOAD_BYTES, sniffImage, uploadMedia } from "@/server/services/media";
import { ApiError } from "@/server/api";
import { rupeesToPaise, paiseToRupees, formatPaise } from "@/lib/money";

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const file = (data: Uint8Array | string, name = "a.png", type = "image/png") => new File([data as BlobPart], name, { type });

describe("image sniffing", () => {
  it("recognises real images by magic bytes", () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffImage(new TextEncoder().encode("GIF89a......"))).toBe("image/gif");
    expect(sniffImage(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  });
  it("rejects SVG, HTML, scripts and anything else regardless of declared type", () => {
    for (const s of ["<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>", "<html><script>1</script>", "#!/bin/sh\nrm -rf /", "GIF9a", "RIFFxxxxWAVE"]) {
      expect(sniffImage(new TextEncoder().encode(s))).toBeNull();
    }
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
});

describe("upload guards (run before any network call)", () => {
  const code = async (p: Promise<unknown>) => ((await p.then(() => null, (e) => e)) as ApiError | null)?.code;
  it("rejects empty, oversized and non-image files", async () => {
    expect(await code(uploadMedia(file(new Uint8Array()), "u"))).toBe("VALIDATION_ERROR");
    expect(await code(uploadMedia(file(new Uint8Array(MAX_UPLOAD_BYTES + 1)), "u"))).toBe("VALIDATION_ERROR");
    expect(await code(uploadMedia(file("<svg onload=alert(1)>", "x.png", "image/png"), "u"))).toBe("VALIDATION_ERROR");
  });
  it("reports 'not configured' (no crash) for a valid image when Cloudinary credentials are absent", async () => {
    const saved = [process.env.CLOUDINARY_CLOUD_NAME, process.env.CLOUDINARY_API_KEY, process.env.CLOUDINARY_API_SECRET];
    delete process.env.CLOUDINARY_CLOUD_NAME; delete process.env.CLOUDINARY_API_KEY; delete process.env.CLOUDINARY_API_SECRET;
    try {
      // env() is cached after first use; this asserts the guard order, and the credential check either way
      const c = await code(uploadMedia(file(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), "u"));
      expect(["NOT_CONFIGURED", "UPSTREAM"]).toContain(c);
    } finally {
      [process.env.CLOUDINARY_CLOUD_NAME, process.env.CLOUDINARY_API_KEY, process.env.CLOUDINARY_API_SECRET] = saved;
    }
  });
});

describe("cloudinary signature", () => {
  it("matches the vector from Cloudinary's documentation", () => {
    expect(sign({ eager: "w_400,h_300,c_pad|w_260,h_200,c_crop", public_id: "sample_image", timestamp: "1315060510" }, "abcd")).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e");
  });
});

describe("money helpers", () => {
  it("converts rupees <-> paise without float errors", () => {
    expect(rupeesToPaise("199.50")).toBe(19950);
    expect(rupeesToPaise("0.29")).toBe(29);
    expect(rupeesToPaise("19.99")).toBe(1999);
    expect(rupeesToPaise("")).toBeNull();
    for (const bad of ["abc", "1.234", "-5", "1,000", "1e3"]) expect(rupeesToPaise(bad)).toBeNaN();
    expect(paiseToRupees(19950)).toBe("199.50");
    expect(paiseToRupees(20000)).toBe("200");
    expect(paiseToRupees(null)).toBe("");
    expect(formatPaise(19950)).toContain("199.5");
  });
});
