const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const iconInput = document.getElementById("iconName");
const bgInput = document.getElementById("bgColor");
const iconColorInput = document.getElementById("iconColor");
const radiusInput = document.getElementById("radius");

const icoBtn = document.getElementById("downloadICO");
const zipBtn = document.getElementById("downloadZIP");

let currentIconName = "";
let debounceTimer = null;

// --- Fetch icon ---
const iconCache = new Map();

async function fetchIcon(name) {
  if (iconCache.has(name)) return iconCache.get(name);

  const url = `https://raw.githubusercontent.com/google/material-design-icons/refs/heads/master/symbols/web/${name}/materialsymbolssharp/${name}_fill1_48px.svg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("not found");

  const text = await res.text();
  iconCache.set(name, text);
  return text;
}

// --- Draw background ---
function drawRoundedRect(size, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();
}

// --- Main render ---
async function render() {
  const name = iconInput.value.trim();
  const bg = bgInput.value;
  const iconColor = iconColorInput.value;
  const radius = parseInt(radiusInput.value);

  if (!name) return;

  try {
    const svgText = await fetchIcon(name);

    const coloredSVG = svgText.replace(
      "<svg",
      `<svg fill="${iconColor}"`
    );

    const blob = new Blob([coloredSVG], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);

    const img = new Image();

    img.onload = () => {
      // 👇 draw OFFSCREEN first
      const off = document.createElement("canvas");
      off.width = 512;
      off.height = 512;
      const octx = off.getContext("2d");

      // background
      octx.fillStyle = bg;
      octx.beginPath();
      octx.moveTo(radius, 0);
      octx.lineTo(512 - radius, 0);
      octx.quadraticCurveTo(512, 0, 512, radius);
      octx.lineTo(512, 512 - radius);
      octx.quadraticCurveTo(512, 512, 512 - radius, 512);
      octx.lineTo(radius, 512);
      octx.quadraticCurveTo(0, 512, 0, 512 - radius);
      octx.lineTo(0, radius);
      octx.quadraticCurveTo(0, 0, radius, 0);
      octx.closePath();
      octx.fill();

      // icon
      const padding = 80;
      octx.drawImage(img, padding, padding, 512 - padding * 2, 512 - padding * 2);

      // 👇 swap in ONE operation (no flicker)
      ctx.clearRect(0, 0, 512, 512);
      ctx.drawImage(off, 0, 0);

      URL.revokeObjectURL(url);
    };

    img.src = url;

  } catch {
    // ignore
  }
}

// --- Debounce (avoid spamming GitHub requests) ---
function scheduleRender() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(render, 250);
}

// --- Event listeners (LIVE UPDATE) ---
iconInput.addEventListener("input", scheduleRender);
bgInput.addEventListener("input", render);
iconColorInput.addEventListener("input", render);
radiusInput.addEventListener("input", render);

// --- Canvas resize helper ---
function canvasToBlob(size) {
  const temp = document.createElement("canvas");
  temp.width = size;
  temp.height = size;
  temp.getContext("2d").drawImage(canvas, 0, 0, size, size);
  return new Promise(res => temp.toBlob(res));
}

// --- ICO download ---
icoBtn.onclick = async () => {
  const sizes = [16, 32, 48, 64];
  const blobs = await Promise.all(sizes.map(canvasToBlob));

  const header = new Uint8Array(6 + sizes.length * 16);
  const view = new DataView(header.buffer);

  view.setUint16(2, 1, true);
  view.setUint16(4, sizes.length, true);

  let offset = header.length;
  const parts = [header];

  blobs.forEach((blob, i) => {
    const size = sizes[i];
    view.setUint8(6 + i*16, size);
    view.setUint8(7 + i*16, size);
    view.setUint32(14 + i*16, blob.size, true);
    view.setUint32(18 + i*16, offset, true);

    parts.push(blob);
    offset += blob.size;
  });

  const ico = new Blob(parts, { type: "image/x-icon" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(ico);
  a.download = "favicon.ico";
  a.click();
};

// --- ZIP download ---
zipBtn.onclick = async () => {
  const sizes = [16, 32, 48, 64, 128, 256, 512];

  const files = await Promise.all(
    sizes.map(async size => ({
      name: `favicon-${size}.png`,
      blob: await canvasToBlob(size)
    }))
  );

  let offset = 0;
  const fileParts = [];
  const centralParts = [];

  files.forEach(file => {
    const nameBytes = new TextEncoder().encode(file.name);

    const local = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(local.buffer);

    view.setUint32(0, 0x04034b50, true);
    view.setUint16(26, nameBytes.length, true);

    local.set(nameBytes, 30);

    fileParts.push(local, file.blob);

    const central = new Uint8Array(46 + nameBytes.length);
    const cview = new DataView(central.buffer);

    cview.setUint32(0, 0x02014b50, true);
    cview.setUint16(28, nameBytes.length, true);
    cview.setUint32(42, offset, true);

    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length + file.blob.size;
  });

  const end = new Uint8Array(22);
  new DataView(end.buffer).setUint32(0, 0x06054b50, true);

  const zip = new Blob([...fileParts, ...centralParts, end]);

  const a = document.createElement("a");
  a.href = URL.createObjectURL(zip);
  a.download = "favicons.zip";
  a.click();
};

// initial render
render();