import { preparePrint } from './export.js?v=8';

export const printFormats = {
  A4: { width: 190, height: 276 },
  A5: { width: 128, height: 189 },
};
const mmToPx = 96 / 25.4;

export function writingCapacity({ width, height }, statementHeight, bitmapWidth) {
  const interiorWidth = (width - 6) * mmToPx;
  const interiorHeight = (height - 6) * mmToPx;
  return Math.max(0, Math.floor((interiorHeight - statementHeight - 3) * bitmapWidth / interiorWidth));
}

function chunkImage(bitmap, top, height) {
  const slice = document.createElement('canvas');
  slice.width = bitmap.width;
  slice.height = height;
  slice.getContext('2d').drawImage(bitmap, 0, -top);
  const image = document.createElement('img');
  image.alt = 'Решение от руки';
  image.src = slice.toDataURL();
  return image;
}

export async function printNotebook(pages, size) {
  const format = printFormats[size] || printFormats.A4;
  const stage = document.createElement('div');
  stage.className = 'capture-stage';
  stage.style.width = format.width + 'mm';
  document.body.append(stage);
  const sheets = [];
  try {
    await document.fonts?.ready;
    for (const { article, bitmap: renderBitmap, title } of pages) {
      const bitmap = renderBitmap();
      article.classList.add('lesson-print-paper');
      article.style.width = format.width + 'mm';
      stage.replaceChildren(article);
      await Promise.allSettled([...article.querySelectorAll('img')].map(image => image.decode()));
      const statementHeight = article.firstElementChild.getBoundingClientRect().height;
      const first = Math.min(bitmap.height, writingCapacity(format, statementHeight, bitmap.width));
      if (first) article.append(chunkImage(bitmap, 0, first));
      sheets.push(article);
      let top = first;
      while (top < bitmap.height) {
        const continuation = article.cloneNode(false);
        const caption = document.createElement('p');
        caption.className = 'print-continuation';
        caption.textContent = title + ' · продолжение';
        continuation.append(caption);
        stage.replaceChildren(continuation);
        const captionHeight = caption.getBoundingClientRect().height;
        const amount = Math.min(bitmap.height - top, Math.max(1, writingCapacity(format, captionHeight, bitmap.width)));
        continuation.append(chunkImage(bitmap, top, amount));
        sheets.push(continuation);
        top += amount;
      }
    }
    await preparePrint(sheets, { size });
  } finally { stage.remove(); }
}
