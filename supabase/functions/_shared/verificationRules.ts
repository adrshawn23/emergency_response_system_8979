// Deno/edge-function port of src/utils/verificationRules.js.
// KEEP IN SYNC — same logic, type annotations only. The JS copy is the unit-
// tested reference (e2e/verification_rules.spec.js); mirror any change.

export const OUTCOME_PENDING = 'pending_admin';
export const OUTCOME_CORRECTION = 'correction_required';
export const MIN_DECISION_CONFIDENCE = 60;

export const normalizeText = (s: unknown): string =>
  (s ?? '')
    .toString()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

export const tokenizeName = (s: string) => {
  const tokens = normalizeText(s).split(' ').filter(Boolean);
  const suffixes = tokens.filter((t) => NAME_SUFFIXES.has(t));
  return { tokens: tokens.filter((t) => !NAME_SUFFIXES.has(t)), suffixes };
};

const editDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return prev[n];
};

const tokensEquivalent = (a: string, b: string): boolean => {
  if (a === b) return true;
  if (a.length === 1 && b.startsWith(a)) return true;
  if (b.length === 1 && a.startsWith(b)) return true;
  if (Math.max(a.length, b.length) >= 4 && editDistance(a, b) <= 1) return true;
  return false;
};

export type FieldResult = { status: 'match' | 'uncertain' | 'mismatch' | 'missing'; reason: string };

export const compareNames = (declared: string, extracted: string | null): FieldResult => {
  if (!extracted || !normalizeText(extracted)) {
    return { status: 'missing', reason: 'The name could not be read from the ID.' };
  }
  const d = tokenizeName(declared);
  const e = tokenizeName(extracted);
  if (d.tokens.length === 0) {
    return { status: 'uncertain', reason: 'The registered name is empty or unreadable.' };
  }
  const unused = [...e.tokens];
  let uncertain = false;
  for (const token of d.tokens) {
    const idx = unused.findIndex((t) => tokensEquivalent(token, t));
    if (idx === -1) {
      const isEdge = token === d.tokens[0] || token === d.tokens[d.tokens.length - 1];
      if (isEdge && d.tokens.length >= 2) {
        return { status: 'mismatch', reason: `The name "${token}" in the registration was not found on the ID.` };
      }
      uncertain = true;
      continue;
    }
    unused.splice(idx, 1);
  }
  if (unused.length > 0 || uncertain || d.suffixes.join() !== e.suffixes.join()) {
    return { status: 'uncertain', reason: 'The name appears similar but could not be fully confirmed (middle name, initial, or suffix difference).' };
  }
  return { status: 'match', reason: 'Name matches the ID.' };
};

export const parseDateLenient = (s: unknown): { iso: string | null; ambiguous: boolean } => {
  if (!s) return { iso: null, ambiguous: false };
  const str = s.toString().trim();
  const isoMatch = str.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return { iso: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`, ambiguous: false };
  }
  const monthNames: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
    august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9,
    oct: 10, nov: 11, dec: 12,
  };
  const named = str.match(/\b([a-z]+)\s+(\d{1,2}),?\s+(\d{4})\b/i)
    || str.match(/\b(\d{1,2})\s+([a-z]+),?\s+(\d{4})\b/i);
  if (named) {
    let month: number | undefined, day: number, year: string;
    if (isNaN(Number(named[1]))) {
      month = monthNames[named[1].toLowerCase()]; day = Number(named[2]); year = named[3];
    } else {
      day = Number(named[1]); month = monthNames[named[2].toLowerCase()]; year = named[3];
    }
    if (month && day >= 1 && day <= 31) {
      return { iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, ambiguous: false };
    }
  }
  const numeric = str.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/);
  if (numeric) {
    const a = Number(numeric[1]), b = Number(numeric[2]), y = Number(numeric[3]);
    if (a > 12 && b <= 12) return { iso: `${y}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`, ambiguous: false };
    if (a <= 12 && b <= 12 && a !== b) return { iso: `${y}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`, ambiguous: true };
    if (a <= 12 && b <= 31) return { iso: `${y}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`, ambiguous: false };
  }
  return { iso: null, ambiguous: false };
};

export const compareBirthdates = (declaredIso: string, extractedRaw: string | null): FieldResult => {
  if (!extractedRaw || !extractedRaw.toString().trim()) {
    return { status: 'missing', reason: 'The birthdate could not be read from the ID.' };
  }
  const extracted = parseDateLenient(extractedRaw);
  const declared = parseDateLenient(declaredIso);
  if (!extracted.iso) {
    return { status: 'uncertain', reason: 'The date on the ID is unclear or ambiguously formatted.' };
  }
  if (extracted.ambiguous && declared.iso) {
    const alt = extracted.iso.slice(0, 5) + extracted.iso.slice(8, 10) + '-' + extracted.iso.slice(5, 7);
    if (extracted.iso === declared.iso || alt === declared.iso) {
      return { status: 'match', reason: 'Birthdate matches the ID.' };
    }
    return { status: 'uncertain', reason: 'The ID date is ambiguous (day/month order) and needs review.' };
  }
  if (declared.iso && extracted.iso === declared.iso) {
    return { status: 'match', reason: 'Birthdate matches the ID.' };
  }
  if (!declared.iso) {
    return { status: 'uncertain', reason: 'The registered birthdate could not be compared.' };
  }
  return { status: 'mismatch', reason: `The birthdate on the ID (${extracted.iso}) does not match the registered date (${declared.iso}).` };
};

// PSGC 0730600033 (formerly 072217033) — Barangay Kalubihan (Pob.), Cebu City.
export const JURISDICTION = {
  version: 'psgc-0730600033-1',
  barangay: 'Kalubihan',
  city: 'Cebu City',
  province: 'Cebu',
  region: 'Region VII',
  psgc_barangay_code: '0730600033',
  barangay_aliases: ['kalubihan'],
  city_aliases: ['cebu city', 'city of cebu', 'dakbayan sa cebu'],
};

const KNOWN_OUTSIDE_BARANGAYS = new Set([
  'labangon', 'guadalupe', 'lahug', 'tisa', 'bulacao', 'basak', 'mabolo',
  'camputhaw', 'capitol site', 'sambag', 'hipodromo', 'lorega', 'parian',
  'tejero', 'tinago', 'zapatera', 'day-as', 'cogon', 'ergmac', 'carreta',
]);
const KNOWN_CITIES = [
  'mandaue', 'lapu-lapu', 'lapu lapu', 'talisay', 'minglanilla', 'consolacion',
  'liloan', 'compostela', 'danao', 'carcar', 'naga', 'toledo', 'bogo',
  'manila', 'quezon city', 'davao', 'makati', 'pasig', 'taguig', 'iloilo',
  'bacolod', 'cagayan de oro', 'zamboanga', 'dumaguete',
];

export const evaluateJurisdiction = (addressText: string): 'eligible' | 'outside' | 'conflicting' | 'unknown' => {
  const norm = normalizeText(addressText);
  if (!norm) return 'unknown';

  const streetKalubihan = /\bkalubihan\s+(street|st|avenue|ave|road|rd|drive|dr|highway|hwy)\b/.test(norm);
  const explicitKalubihan = /\b(?:brgy|barangay|bgy)\.?\s+kalubihan\b/.test(norm);
  const hasKalubihan = explicitKalubihan
    || (JURISDICTION.barangay_aliases.some((a) => norm.includes(a)) && !streetKalubihan);

  const brgyMatch = norm.match(/\b(?:brgy|barangay|bgy)\.?\s+([a-z][a-z\s]{1,24}?)(?:\s+cebu|\s+ city|\s*$)/);
  const brgyToken = brgyMatch?.[1]?.trim();
  const explicitOtherBrgy = brgyToken && !JURISDICTION.barangay_aliases.includes(brgyToken);

  const knownOutsideBrgy = [...KNOWN_OUTSIDE_BARANGAYS]
    .find((b) => new RegExp(`\\b${b}\\b`).test(norm));
  const otherCity = KNOWN_CITIES.find((c) => norm.includes(c));

  if (hasKalubihan && (explicitOtherBrgy || knownOutsideBrgy || otherCity)) return 'conflicting';
  if (hasKalubihan) return 'eligible';
  if (explicitOtherBrgy || knownOutsideBrgy || otherCity) return 'outside';
  return 'unknown';
};

export const compareAddressJurisdiction = (addressText: string): FieldResult & { outcome: string } => {
  const result = evaluateJurisdiction(addressText);
  switch (result) {
    case 'eligible':
      return { status: 'match', reason: 'Address indicates Barangay Kalubihan, Cebu City.', outcome: 'eligible' };
    case 'outside':
      return { status: 'mismatch', reason: 'The address identifies a jurisdiction outside Barangay Kalubihan, Cebu City.', outcome: 'outside' };
    case 'conflicting':
      return { status: 'uncertain', reason: 'The address contains conflicting jurisdiction information and needs review.', outcome: 'conflicting' };
    default:
      return { status: 'uncertain', reason: 'The address could not be confirmed as Barangay Kalubihan, Cebu City.', outcome: 'unknown' };
  }
};

export const decideVerification = ({ name, birthdate, address, ocrConfidence }: {
  name: FieldResult; birthdate: FieldResult; address: FieldResult; ocrConfidence: number | null;
}) => {
  const reasons: string[] = [];
  const notes: string[] = [];
  const lowConfidence = ocrConfidence != null && ocrConfidence < MIN_DECISION_CONFIDENCE;
  if (lowConfidence) {
    notes.push(`OCR confidence is low (${Math.round(ocrConfidence!)}%) — all fields require human review.`);
  }
  const fields = { name, birthdate, address };
  let correction = false;
  for (const [key, field] of Object.entries(fields)) {
    if (!field) continue;
    if (field.status === 'mismatch' && !lowConfidence) {
      correction = true;
      reasons.push(field.reason);
    } else if (field.status === 'mismatch' && lowConfidence) {
      notes.push(`${key}: possible mismatch but OCR confidence is too low to conclude — needs review.`);
    } else {
      notes.push(`${key}: ${field.reason}`);
    }
  }
  if (correction) return { outcome: OUTCOME_CORRECTION, reasons, notes, fields };
  return { outcome: OUTCOME_PENDING, reasons: [], notes: notes.length ? notes : ['Submission requires administrator review.'], fields };
};
