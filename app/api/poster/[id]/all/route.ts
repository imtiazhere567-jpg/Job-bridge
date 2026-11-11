import { db } from "@/lib/db";
import { GET as posterImage } from "../route";

export const runtime = "nodejs";

const SIZES = [
  ["portrait", "instagram-post-1080x1350"],
  ["square", "facebook-square-1080x1080"],
  ["linkedin", "linkedin-1200x627"],
  ["story", "whatsapp-status-1080x1920"],
] as const;

/** The same images, named for where they go in an ad (Meta, LinkedIn, Google, TikTok). */
const AD_FILES = [
  ["portrait", "1-facebook-instagram-feed-4x5-1080x1350"],
  ["story", "2-facebook-instagram-stories-reels-9x16-1080x1920"],
  ["square", "3-square-1x1-1080x1080-facebook-linkedin-google"],
  ["linkedin", "4-landscape-1.91x1-1200x627-linkedin-google"],
] as const;

const AD_GUIDE = `JobBridge ad pack: which image goes where
==========================================

Facebook & Instagram ads (Meta Ads Manager)
  Feed (best):            1-facebook-instagram-feed-4x5
  Stories & Reels:        2-facebook-instagram-stories-reels-9x16
  Tip: in the ad, turn on "Placement asset customisation" and add both,
  so each placement shows the right shape.

LinkedIn ads (single image ad)
  Feed:                   4-landscape-1.91x1  (standard)
  or                      3-square-1x1        (stands out more on mobile)

Google Display ads (responsive)
  Upload both:            4-landscape-1.91x1 and 3-square-1x1

TikTok, YouTube Shorts, WhatsApp Status
  Use:                    2-...-9x16

Tips
  - Less text on the image usually means more reach for the same budget.
  - In Stories (9:16), keep important things away from the top and bottom edges.
  - Use the job's Facebook / LinkedIn apply link as the ad's website URL,
    so applicants from the ad show in "Where applicants come from".
`;

/** All four poster sizes in one .zip download (?pack=ads: named for ad placements, with a guide). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const role = await db.one<{ slug: string }>("select slug from roles where id = $1", [Number(id)]);
  if (!role) return new Response("Not found", { status: 404 });
  const ads = new URL(req.url).searchParams.get("pack") === "ads";
  const files: { name: string; data: Buffer }[] = [];
  for (const [size, name] of ads ? AD_FILES : SIZES) {
    const url = new URL(req.url);
    url.pathname = `/api/poster/${id}`;
    url.search = `?size=${size}`;
    const res = await posterImage(new Request(url, { headers: req.headers }), { params: Promise.resolve({ id }) });
    if (!res.ok) return new Response("Not found", { status: 404 });
    files.push({ name: ads ? `${name}.png` : `jobbridge-${role.slug}-${name}.png`, data: Buffer.from(await res.arrayBuffer()) });
  }
  if (ads) files.push({ name: "WHERE-EACH-IMAGE-GOES.txt", data: Buffer.from(AD_GUIDE, "utf8") });
  return new Response(zip(files), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="jobbridge-${role.slug}-${ads ? "ad-pack" : "posters"}.zip"`,
      "cache-control": "no-store",
    },
  });
}

// ---------- A tiny .zip writer (files are stored as-is: PNGs are already compressed) ----------
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zip(files: { name: string; data: Buffer }[]) {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8");
    const crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt32LE(0, 10); // time/date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(f.data.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, name, f.data);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(0, 10);
    cen.writeUInt32LE(0, 12);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(f.data.length, 20);
    cen.writeUInt32LE(f.data.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, name);
    offset += 30 + name.length + f.data.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, centralBuf, end]);
}
