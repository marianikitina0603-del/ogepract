export function download(blob, name) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function rasterize(node) {
  const { width, height } = node.getBoundingClientRect();
  const copy = node.cloneNode(true);
  const originals = [node, ...node.querySelectorAll('*')];
  const clones = [copy, ...copy.querySelectorAll('*')];
  const namespace = 'http://www.w3.org/1999/xhtml';
  const wrapper = document.createElementNS(namespace, 'div');
  wrapper.style.cssText = 'background:#fffefa;display:flow-root';
  wrapper.append(copy);
  originals.forEach((original, index) => {
    const clone = clones[index];
    const computed = getComputedStyle(original);
    for (const property of computed) {
      if (!property.startsWith('--')) clone.style.setProperty(property, computed.getPropertyValue(property));
    }
    if (original instanceof HTMLInputElement) clone.setAttribute('value', original.value);
    if (original instanceof HTMLCanvasElement) {
      const image = document.createElement('img');
      image.src = original.toDataURL();
      image.style.cssText = clone.style.cssText;
      clone.replaceWith(image);
    }
    if (clone instanceof HTMLButtonElement || clone instanceof HTMLInputElement) {
      const label = document.createElement('span');
      label.style.cssText = clone.style.cssText;
      if (clone instanceof HTMLInputElement) label.textContent = original.value;
      else label.append(...clone.childNodes);
      clone.replaceWith(label);
    }
  });
  copy.style.margin = '0';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width)}" height="${Math.ceil(height)}">
    <foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(wrapper)}</foreignObject></svg>`;
  const image = new Image();
  image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await image.decode();
  const canvas = document.createElement('canvas');
  const scale = Math.min(2, 8192 / width, 8192 / height);
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const svgPresentation = [
  'background-color', 'border-radius', 'color', 'fill', 'fill-opacity', 'fill-rule', 'stroke',
  'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray',
  'stroke-dashoffset', 'paint-order', 'opacity', 'font-family', 'font-size', 'font-weight',
  'font-style', 'text-anchor', 'dominant-baseline', 'letter-spacing', 'visibility',
];

function diagramImage(source) {
  const { width, height } = source.getBoundingClientRect();
  if (!width || !height) return null;
  const svg = source.cloneNode(true);
  const originals = [source, ...source.querySelectorAll('*')];
  const targets = [svg, ...svg.querySelectorAll('*')];
  originals.forEach((element, index) => {
    const style = getComputedStyle(element);
    if (style.display === 'none') targets[index].style.display = 'none';
    for (const property of svgPresentation) targets[index].style.setProperty(property, style.getPropertyValue(property));
  });
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.style.width = width + 'px';
  svg.style.height = height + 'px';
  svg.style.margin = '0';
  const bytes = new XMLSerializer().serializeToString(svg);
  const layout = getComputedStyle(source);
  return {
    src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(bytes),
    width: width + 'px', height: height + 'px', display: layout.display,
    margin: layout.margin, verticalAlign: layout.verticalAlign,
  };
}

export async function capture(node) {
  let canvas;
  if (window.html2canvas) {
    try {
      const originals = [...node.querySelectorAll('svg')].filter(svg => !svg.parentElement.closest('svg'));
      const diagrams = originals.map(diagramImage);
      const scale = Math.min(2, 8192 / Math.max(node.offsetWidth, node.offsetHeight));
      canvas = await window.html2canvas(node, {
        scale, backgroundColor: '#fffefa', logging: false,
        async onclone(document, copy) {
          const replacements = [...copy.querySelectorAll('svg')].filter(svg => !svg.parentElement.closest('svg'));
          await Promise.all(replacements.map(async (svg, index) => {
            const diagram = diagrams[index];
            if (!diagram) return;
            const { src, ...layout } = diagram;
            const image = document.createElement('img');
            Object.assign(image.style, layout);
            image.alt = svg.getAttribute('aria-label') || '';
            image.src = src;
            svg.replaceWith(image);
            await image.decode();
          }));
        },
      });
    } catch { canvas = await rasterize(node); }
  } else {
    canvas = await rasterize(node);
  }
  return new Promise((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(new Error('Не удалось сохранить изображение.')), 'image/png'));
}

export function preparePrint(nodes, { size = 'A4', slide = false } = {}) {
  document.querySelector('#lesson-print')?.remove();
  document.querySelector('#lesson-print-style')?.remove();
  const root = document.createElement('div');
  root.id = 'lesson-print';
  root.classList.toggle('print-slide', slide);
  root.append(...nodes);
  document.body.append(root);
  const style = document.createElement('style');
  style.id = 'lesson-print-style';
  style.textContent = `@page { size: ${size === 'A5' ? 'A5' : 'A4'}; margin: 10mm; }`;
  document.head.append(style);
  window.addEventListener('afterprint', () => { root.remove(); style.remove(); }, { once: true });
  window.print();
}

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  for (let bit = 0; bit < 8; bit++) index = (index >>> 1) ^ (index & 1 ? 0xedb88320 : 0);
  return index;
});

export async function pngArchive(files) {
  const entries = [];
  const directory = [];
  let offset = 0;
  let directorySize = 0;
  for (const { name, blob } of files) {
    const encoded = new TextEncoder().encode(name);
    const data = new Uint8Array(await blob.arrayBuffer());
    let crc = 0xffffffff;
    for (const byte of data) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
    crc ^= 0xffffffff;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, encoded.length, true);
    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    new Uint8Array(central.buffer, 6, 26).set(new Uint8Array(local.buffer, 4, 26));
    central.setUint32(42, offset, true);
    entries.push(local.buffer, encoded, data);
    directory.push(central.buffer, encoded);
    offset += 30 + encoded.length + data.length;
    directorySize += 46 + encoded.length;
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, offset, true);
  return new Blob([...entries, ...directory, end.buffer], { type: 'application/zip' });
}
