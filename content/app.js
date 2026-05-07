const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const iconInput = document.getElementById("iconName");
const radiusInput = document.getElementById("radius");

const icoBtn = document.getElementById("downloadICO");
const zipBtn = document.getElementById("downloadZIP");

let currentIconName = "";
let debounceTimer = null;

// --- Create Pickr instances for both colors ---
let bgPicker, iconPicker;

function initPickers() {
  bgPicker = Pickr.create({
    el: '#bgColorButton',
    theme: 'monolith',
    default: '#320984',
    position: 'left',
    components: {
      preview: true,
      opacity: false,
      hue: true,
      interaction: {
        hex: false,
        rgba: false,
        input: true,
        save: true,
      }
    }
  });

  iconPicker = Pickr.create({
    el: '#iconColorButton',
    theme: 'monolith',
    default: '#ffffff',
    position: 'right',
    components: {
      preview: true,
      opacity: false,
      hue: true,
      interaction: {
        hex: false,
        rgba: false,
        input: true,
        save: true,
      }
    }
  });

  bgPicker.on('change', (color) => setBgColor(color.toHEXA().toString()));
  bgPicker.on('save', (color) => {
    setBgColor(color.toHEXA().toString());
    bgPicker.hide();
  });

  iconPicker.on('change', (color) => setIconColor(color.toHEXA().toString()));
  iconPicker.on('save', (color) => {
    setIconColor(color.toHEXA().toString());
    iconPicker.hide();
  });
}

let bgColor = '#320984';
let iconColor = '#ffffff';
let pickersInitialized = false;

function setBgColor(value) {
  bgColor = value;
  render();
}

function setIconColor(value) {
  iconColor = value;
  render();
}

// --- Fetch icon ---
const iconCache = new Map();

async function fetchIcon(name) {
  if (iconCache.has(name)) return iconCache.get(name);

  const url = `https://raw.githubusercontent.com/google/material-design-icons/refs/heads/master/symbols/web/${name}/materialsymbolssharp/${name}_fill1_24px.svg`;
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
      const off = document.createElement("canvas");
      off.width = 512;
      off.height = 512;
      const octx = off.getContext("2d");

      octx.fillStyle = bgColor;
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

      const padding = 80;
      octx.drawImage(img, padding, padding, 512 - padding * 2, 512 - padding * 2);

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

// Initialize pickers and initial render
initPickers();
scheduleRender();
pickersInitialized = true;

document.body.addEventListener('load', () => {
  const labels = document.querySelectorAll('.color-label');
  labels.forEach(label => {
    label.textContent = label.dataset.value;
  });
  render();
});
