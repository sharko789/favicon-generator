const CANVAS_SIZE = 512;
const ICON_PADDING = 80;

const EXPORT_SIZES = [16, 32, 48, 64, 128, 256, 512];
const ICO_SIZES = [16, 32, 48, 64];

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const iconInput = document.getElementById("iconName");
const styleToggle = document.getElementById("iconStyleToggle");
const radiusInput = document.getElementById("radius");
const scaleInput = document.getElementById("iconScale");

const icoBtn = document.getElementById("downloadICO");
const zipBtn = document.getElementById("downloadZIP");

const offscreen = document.createElement("canvas");
offscreen.width = CANVAS_SIZE;
offscreen.height = CANVAS_SIZE;

const octx = offscreen.getContext("2d");

let bgColor = "#320984";
let iconColor = "#ffffff";
let iconStyle = "sharp";
let iconScale = 1;

let bgPicker;
let iconPicker;

let renderVersion = 0;
let renderScheduled = false;

let currentAbortController = null;

const iconCache = new Map();
const coloredSvgCache = new Map();
const pathCache = new Map();


// --- URL STATE ---

function normalizeColorToURL(color) {
  return color.replace("#", "");
}

function normalizeColorFromURL(value, fallback) {
  if (!value) return fallback;
  return value.startsWith("#") ? value : `#${value}`;
}

function getStateFromURL() {
  const params = new URLSearchParams(location.search);

  return {
    icon: params.get("icon") || "home",
    style: params.get("style") || "sharp",
    bg: normalizeColorFromURL(params.get("bg"), "#320984"),
    fg: normalizeColorFromURL(params.get("fg"), "#ffffff"),
    radius: params.get("radius") || "64",
    scale: params.get("scale") || "1"
  };
}

function updateURLState() {
  const params = new URLSearchParams();

  params.set("icon", iconInput.value.trim());
  params.set("style", iconStyle);
  params.set("bg", normalizeColorToURL(bgColor));
  params.set("fg", normalizeColorToURL(iconColor));
  params.set("radius", radiusInput.value);
  params.set("scale", iconScale.toString());

  const newURL = `${location.pathname}?${params.toString()}`;

  history.replaceState(null, "", newURL);
}


// --- Utilities ---

function scheduleRender() {
  if (renderScheduled) return;

  renderScheduled = true;

  requestAnimationFrame(async () => {
    renderScheduled = false;

    updateURLState();
    await render();
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function canvasToBlob(size, type = "image/png") {
  const temp = document.createElement("canvas");

  temp.width = size;
  temp.height = size;

  const tctx = temp.getContext("2d");

  tctx.drawImage(canvas, 0, 0, size, size);

  return new Promise(resolve => {
    temp.toBlob(resolve, type);
  });
}


// --- Rounded Rect Path Cache ---

function getRoundedRectPath(size, radius) {
  const key = `${size}:${radius}`;

  if (pathCache.has(key)) {
    return pathCache.get(key);
  }

  const path = new Path2D();

  path.moveTo(radius, 0);

  path.lineTo(size - radius, 0);
  path.quadraticCurveTo(size, 0, size, radius);

  path.lineTo(size, size - radius);
  path.quadraticCurveTo(size, size, size - radius, size);

  path.lineTo(radius, size);
  path.quadraticCurveTo(0, size, 0, size - radius);

  path.lineTo(0, radius);
  path.quadraticCurveTo(0, 0, radius, 0);

  path.closePath();

  pathCache.set(key, path);

  return path;
}

function drawRoundedRect(ctx, size, radius, color) {
  ctx.fillStyle = color;
  ctx.fill(getRoundedRectPath(size, radius));
}


// --- Pickers ---

function initPickers() {
  bgPicker = Pickr.create({
    el: "#bgColorButton",
    theme: "monolith",
    default: bgColor,
    position: "left-middle",
    components: {
      preview: true,
      hue: true,
      interaction: { input: true }
    }
  });

  iconPicker = Pickr.create({
    el: "#iconColorButton",
    theme: "monolith",
    default: iconColor,
    position: "left-middle",
    components: {
      preview: true,
      hue: true,
      interaction: { input: true }
    }
  });

  bgPicker.on("change", color => {
    bgColor = color.toHEXA().toString();
    scheduleRender();
  });

  bgPicker.on("hide", () => bgPicker.applyColor());

  iconPicker.on("change", color => {
    iconColor = color.toHEXA().toString();
    scheduleRender();
  });

  iconPicker.on("hide", () => iconPicker.applyColor());
}


// --- Icon Fetching ---

async function fetchIcon(name) {
  const cacheKey = `${name}:${iconStyle}`;

  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey);
  }

  currentAbortController?.abort();
  currentAbortController = new AbortController();

  const url = `https://raw.githubusercontent.com/google/material-design-icons/refs/heads/master/symbols/web/${name}/materialsymbols${iconStyle}/${name}_fill1_24px.svg`;

  const res = await fetch(url, {
    cache: "force-cache",
    signal: currentAbortController.signal
  });

  if (!res.ok) throw new Error("Icon not found");

  const svg = await res.text();
  iconCache.set(cacheKey, svg);

  return svg;
}


// --- SVG Coloring ---

function getColoredSVG(name, svgText, color) {
  const cacheKey = `${name}:${iconStyle}:${color}`;

  if (coloredSvgCache.has(cacheKey)) {
    return coloredSvgCache.get(cacheKey);
  }

  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  doc.documentElement.setAttribute("fill", color);

  const svg = new XMLSerializer().serializeToString(doc);

  coloredSvgCache.set(cacheKey, svg);
  return svg;
}


// --- MAIN RENDER ---

async function render() {
  const version = ++renderVersion;
  const name = iconInput.value.trim();

  if (!name) return;

  const radius = parseInt(radiusInput.value, 10);

  try {
    const svgText = await fetchIcon(name);

    if (version !== renderVersion) return;

    const coloredSVG = getColoredSVG(name, svgText, iconColor);

    const img = new Image();

    img.onload = () => {
      if (version !== renderVersion) return;

      octx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      drawRoundedRect(octx, CANVAS_SIZE, radius, bgColor);

      const baseSize = CANVAS_SIZE - ICON_PADDING * 2;
      const scaledSize = baseSize * iconScale;
      const offset = (CANVAS_SIZE - scaledSize) / 2;

      octx.drawImage(img, offset, offset, scaledSize, scaledSize);

      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.drawImage(offscreen, 0, 0);
    };

    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(coloredSVG)}`;

  } catch (err) {
    if (err.name === "AbortError") return;
    console.error(err);
  }
}


// --- DOWNLOADS ---

async function createICO(sizes) {
  const pngs = await Promise.all(
    sizes.map(async size => {
      const blob = await canvasToBlob(size);
      return {
        size,
        data: new Uint8Array(await blob.arrayBuffer())
      };
    })
  );

  const headerSize = 6;
  const dirSize = 16 * pngs.length;

  let imageOffset = headerSize + dirSize;
  let totalSize = imageOffset;

  for (const p of pngs) totalSize += p.data.length;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  let offset = 0;

  view.setUint16(offset, 0, true); offset += 2;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, pngs.length, true); offset += 2;

  for (const png of pngs) {
    const size = png.size;

    view.setUint8(offset++, size === 256 ? 0 : size);
    view.setUint8(offset++, size === 256 ? 0 : size);
    view.setUint8(offset++, 0);
    view.setUint8(offset++, 0);

    view.setUint16(offset, 1, true); offset += 2;
    view.setUint16(offset, 32, true); offset += 2;

    view.setUint32(offset, png.data.length, true); offset += 4;
    view.setUint32(offset, imageOffset, true); offset += 4;

    imageOffset += png.data.length;
  }

  let writeOffset = headerSize + dirSize;

  for (const png of pngs) {
    new Uint8Array(buffer, writeOffset).set(png.data);
    writeOffset += png.data.length;
  }

  return buffer;
}


// --- BUTTONS ---

icoBtn.addEventListener("click", async () => {
  const icoBuffer = await createICO(ICO_SIZES);
  const blob = new Blob([icoBuffer], { type: "image/x-icon" });
  downloadBlob(blob, "favicon.ico");
});

zipBtn.addEventListener("click", async () => {
  const zip = new JSZip();

  for (const size of EXPORT_SIZES) {
    const blob = await canvasToBlob(size);
    zip.file(`favicon-${size}.png`, blob);
  }

  const content = await zip.generateAsync({ type: "blob" });
  downloadBlob(content, "favicons.zip");
});


// --- EVENTS ---

iconInput.addEventListener("input", scheduleRender);

styleToggle.addEventListener("change", () => {
  iconStyle = styleToggle.checked ? "rounded" : "sharp";
  scheduleRender();
});

radiusInput.addEventListener("input", scheduleRender);

scaleInput.addEventListener("input", () => {
  iconScale = parseFloat(scaleInput.value);
  scheduleRender();
});


// --- INIT ---

initPickers();

window.addEventListener("load", () => {
  const initial = getStateFromURL();

  iconInput.value = initial.icon;

  iconStyle = initial.style;
  styleToggle.checked = iconStyle === "rounded";

  bgColor = initial.bg;
  iconColor = initial.fg;
  iconScale = parseFloat(initial.scale);

  radiusInput.value = initial.radius;

  // sync scale input early
  scaleInput.value = iconScale;

  // wait 1 frame so Pickr is fully mounted
  requestAnimationFrame(() => {
    bgPicker.setColor(bgColor);
    bgPicker.applyColor();

    iconPicker.setColor(iconColor);
    iconPicker.applyColor();
  });

  scheduleRender();
});