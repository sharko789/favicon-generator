const CANVAS_SIZE = 512;
const ICON_PADDING = 80;

const EXPORT_SIZES = [16, 32, 48, 64, 128, 256, 512];
const ICO_SIZES = [16, 32, 48, 64];

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const iconInput = document.getElementById("iconName");
const radiusInput = document.getElementById("radius");

const icoBtn = document.getElementById("downloadICO");
const zipBtn = document.getElementById("downloadZIP");

const offscreen = document.createElement("canvas");
offscreen.width = CANVAS_SIZE;
offscreen.height = CANVAS_SIZE;

const octx = offscreen.getContext("2d");

let bgColor = "#320984";
let iconColor = "#ffffff";

let bgPicker;
let iconPicker;

let renderVersion = 0;
let renderScheduled = false;

let currentAbortController = null;

const iconCache = new Map();
const coloredSvgCache = new Map();
const pathCache = new Map();



// --- Utilities ---

function scheduleRender() {
  if (renderScheduled) return;

  renderScheduled = true;

  requestAnimationFrame(async () => {
    renderScheduled = false;
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
    position: "left",
    components: {
      preview: true,
      hue: true,
      interaction: {
        input: true
      }
    }
  });

  iconPicker = Pickr.create({
    el: "#iconColorButton",
    theme: "monolith",
    default: iconColor,
    position: "right",
    components: {
      preview: true,
      hue: true,
      interaction: {
        input: true,
      }
    }
  });

  bgPicker.on("change", color => {
    bgColor = color.toHEXA().toString();
    bgPicker.save();
    scheduleRender();
  });

  iconPicker.on("change", color => {
    iconColor = color.toHEXA().toString();
    scheduleRender();
  });
}


// --- Icon Fetching ---

async function fetchIcon(name) {
  if (iconCache.has(name)) {
    return iconCache.get(name);
  }

  currentAbortController?.abort();

  currentAbortController = new AbortController();

  const url = `https://raw.githubusercontent.com/google/material-design-icons/refs/heads/master/symbols/web/${name}/materialsymbolssharp/${name}_fill1_24px.svg`;

  const res = await fetch(url, {
    cache: "force-cache",
    signal: currentAbortController.signal
  });

  if (!res.ok) {
    throw new Error("Icon not found");
  }

  const svg = await res.text();

  iconCache.set(name, svg);

  return svg;
}


// --- SVG Coloring ---

function getColoredSVG(name, svgText, color) {
  const cacheKey = `${name}:${color}`;

  if (coloredSvgCache.has(cacheKey)) {
    return coloredSvgCache.get(cacheKey);
  }

  const doc = new DOMParser()
    .parseFromString(svgText, "image/svg+xml");

  doc.documentElement.setAttribute("fill", color);

  const svg = new XMLSerializer()
    .serializeToString(doc);

  coloredSvgCache.set(cacheKey, svg);

  return svg;
}


// --- Main Render ---

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

      drawRoundedRect(
        octx,
        CANVAS_SIZE,
        radius,
        bgColor
      );

      octx.drawImage(
        img,
        ICON_PADDING,
        ICON_PADDING,
        CANVAS_SIZE - ICON_PADDING * 2,
        CANVAS_SIZE - ICON_PADDING * 2
      );

      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.drawImage(offscreen, 0, 0);
    };

    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(coloredSVG)}`;

  } catch (err) {
    if (err.name === "AbortError") {
      return;
    }

    console.error(err);
  }
}


// --- Downloads ---

icoBtn.addEventListener("click", async () => {
  try {
    const pngBuffers = await Promise.all(
      ICO_SIZES.map(async size => {

        const blob = await canvasToBlob(size);

        return blob.arrayBuffer();
      })
    );

    const icoBuffer = await pngToIco(pngBuffers);

    const icoBlob = new Blob(
      [icoBuffer],
      { type: "image/x-icon" }
    );

    downloadBlob(icoBlob, "favicon.ico");

  } catch (err) {
    console.error(err);
  }
});

zipBtn.addEventListener("click", async () => {
  try {
    const zip = new JSZip();

    for (const size of EXPORT_SIZES) {
      const blob = await canvasToBlob(size);
      zip.file(`favicon-${size}.png`, blob);
    }

    const content = await zip.generateAsync({
      type: "blob"
    });

    downloadBlob(content, "favicons.zip");

  } catch (err) {
    console.error(err);
  }
});


// --- Events ---

iconInput.addEventListener("input", scheduleRender);
radiusInput.addEventListener("input", scheduleRender);


// --- Init ---

initPickers();

window.addEventListener("load", () => {
  scheduleRender(); 
});