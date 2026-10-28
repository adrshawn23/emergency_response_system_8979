import { createWorker } from 'tesseract.js';

// Downscale a photo for storage — a crisp readable copy without multi-MB payloads.
export const fileToDataUrl = (file, maxSide = 1280) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(img.src);
    resolve(canvas.toDataURL('image/jpeg', 0.82));
  };
  img.onerror = reject;
  img.src = URL.createObjectURL(file);
});

// Folds case, diacritics and punctuation so "DELA CRUZ, Juan" matches "Juan Dela Cruz".
const normalizeOcr = s => (s ?? '').toString()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ').trim();

// Every declared name token (len >= 2) must appear as a whole word in the OCR text.
export const nameMatchesOcr = (declaredName, ocrText) => {
  const tokens = normalizeOcr(declaredName).split(' ').filter(t => t.length >= 2);
  if (!tokens.length || !ocrText) return false;
  const text = ` ${normalizeOcr(ocrText)} `;
  return tokens.every(t => text.includes(` ${t} `));
};

// Extracts ISO-ambiguous date forms from OCR text and tests them against the declared date.
// Accepts "Month D, YYYY" and numeric D/M/Y, M/D/Y, Y/M/D — whichever form matches the declared DOB.
export const dateMatchesOcr = (declaredDob, ocrText) => {
  const declared = new Date(declaredDob);
  if (Number.isNaN(declared.getTime()) || !ocrText) return false;
  const d = declared.getDate(), m = declared.getMonth() + 1, y = declared.getFullYear();
  const norm = (v) => `${v.getFullYear()}-${v.getMonth() + 1}-${v.getDate()}`;
  const target = norm(declared);

  const monthNames = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
  const text = ocrText.toLowerCase();

  // "Month Day, Year" e.g. "October 4, 2004" / "Oct 4 2004"
  const monthRe = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})[,\s]+(\d{4})/g;
  const short = { jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  let match;
  while ((match = monthRe.exec(text))) {
    const mm = monthNames[match[1]] || short[match[1]];
    if (mm === m && Number(match[2]) === d && Number(match[3]) === y) return true;
  }

  // Numeric patterns a-b-c(ddd); test both day-first and month-first readings.
  const numRe = /\b(\d{1,4})[\s\-/\.](\d{1,2})[\s\-/\.](\d{1,4})\b/g;
  while ((match = numRe.exec(text))) {
    const parts = [Number(match[1]), Number(match[2]), Number(match[3])];
    const orders = [
      [parts[0], parts[1], parts[2]],   // yyyy mm dd or dd mm yyyy
      [parts[2], parts[1], parts[0]],   // mm dd yyyy reading
      [parts[2], parts[0], parts[1]],   // yyyy dd mm
    ];
    for (const [yy, mm, dd] of orders) {
      if (yy === y && mm === m && dd === d) return true;
    }
  }
  return false;
};

// Runs OCR on an ID photo and returns the data-url copy, parsed text, confidence
// and match flags against the declared profile fields.
export const ocrIdDocument = async (file, { fullName, birthdate }) => {
  const [docDataUrl, worker] = await Promise.all([
    fileToDataUrl(file),
    createWorker('eng')
  ]);
  try {
    const { data } = await worker.recognize(docDataUrl);
    const text = data?.text ?? '';
    const confidence = Math.round(data?.confidence ?? 0);
    return {
      docDataUrl,
      ocrData: {
        extracted_name: nameMatchesOcr(fullName, text) ? fullName : null,
        extracted_dob: dateMatchesOcr(birthdate, text) ? birthdate : null,
        name_match: nameMatchesOcr(fullName, text),
        dob_match: dateMatchesOcr(birthdate, text)
      },
      confidence
    };
  } finally {
    await worker.terminate();
  }
};
