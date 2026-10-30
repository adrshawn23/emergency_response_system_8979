// Conservative, explainable field-matching rules for resident ID verification.
//
// Pure functions shared by:
//   - the client (pre-submit hints only — NEVER authoritative), and
//   - the verify-id edge function (authoritative comparison).
//
// These rules can only produce two outcomes:
//   OUTCOME_PENDING    → human review required (matches, ambiguity, low OCR, or failure)
//   OUTCOME_CORRECTION → a high-confidence, definite mismatch the applicant must fix
//
// An exact match NEVER auto-approves — approval is exclusively an admin decision.

export const OUTCOME_PENDING = 'pending_admin';
export const OUTCOME_CORRECTION = 'correction_required';

// Below this OCR confidence nothing is definite — everything stays pending.
export const MIN_DECISION_CONFIDENCE = 60;

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

// Lowercase, strip punctuation, collapse whitespace, preserve unicode letters.
export const normalizeText = (s) =>
  (s ?? '')
    .toString()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

// Split a name into comparable tokens, dropping generational suffixes
// (recorded separately so a suffix CONFLICT can still be noted).
export const tokenizeName = (s) => {
  const tokens = normalizeText(s).split(' ').filter(Boolean);
  const suffixes = tokens.filter((t) => NAME_SUFFIXES.has(t));
  return { tokens: tokens.filter((t) => !NAME_SUFFIXES.has(t)), suffixes };
};

// Levenshtein distance — used to forgive small OCR spelling noise only.
const editDistance = (a, b) => {
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

// Tokens "match" if identical, initial-vs-full equivalent, or within one edit
// for longer tokens (OCR noise like "dela" → "de la" is handled by token merge,
// single-letter differences like "Reyes"→"Reyez" land here).
const tokensEquivalent = (a, b) => {
  if (a === b) return true;
  if (a.length === 1 && b.startsWith(a)) return true;   // declared initial
  if (b.length === 1 && a.startsWith(b)) return true;   // extracted initial
  const longer = Math.max(a.length, b.length);
  if (longer >= 4 && editDistance(a, b) <= 1) return true;
  return false;
};

// ---------------------------------------------------------------------------
// Field comparisons — each returns { status, reason }
//   status: 'match' | 'uncertain' | 'mismatch' | 'missing'
// ---------------------------------------------------------------------------

export const compareNames = (declared, extracted) => {
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
      // A missing declared token is only a problem if it looks like a surname
      // (first or last position). Missing middle names/initials are common.
      const isEdge = token === d.tokens[0] || token === d.tokens[d.tokens.length - 1];
      if (isEdge && d.tokens.length >= 2) {
        return {
          status: 'mismatch',
          reason: `The name "${token}" in the registration was not found on the ID.`,
        };
      }
      uncertain = true;
      continue;
    }
    unused.splice(idx, 1);
  }

  // Leftover extracted tokens that match nothing are usually titles or second
  // surnames — note them but don't fail on them.
  if (unused.length > 0 || uncertain || d.suffixes.join() !== e.suffixes.join()) {
    return {
      status: 'uncertain',
      reason: 'The name appears similar but could not be fully confirmed (middle name, initial, or suffix difference).',
    };
  }
  return { status: 'match', reason: 'Name matches the ID.' };
};

// Parse a date string into ISO yyyy-mm-dd. Returns { iso, ambiguous } —
// ambiguous when both MM/DD and DD/MM interpretations are plausible.
export const parseDateLenient = (s) => {
  if (!s) return { iso: null, ambiguous: false };
  const str = s.toString().trim();

  const isoMatch = str.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return { iso: `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`, ambiguous: false };
  }

  const monthNames = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
    august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9,
    oct: 10, nov: 11, dec: 12,
  };
  const named = str.match(/\b([a-z]+)\s+(\d{1,2}),?\s+(\d{4})\b/i)
    || str.match(/\b(\d{1,2})\s+([a-z]+),?\s+(\d{4})\b/i);
  if (named) {
    let month, day, year;
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
    const [, a, b, y] = numeric.map(Number);
    // PH IDs conventionally print MM/DD/YYYY. If the first number can't be a
    // month it's DD/MM unambiguously; if both could be a month it's ambiguous.
    if (a > 12 && b <= 12) {
      return { iso: `${y}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`, ambiguous: false };
    }
    if (a <= 12 && b <= 12 && a !== b) {
      return { iso: `${y}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`, ambiguous: true };
    }
    if (a <= 12 && b <= 31) {
      return { iso: `${y}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`, ambiguous: false };
    }
  }
  return { iso: null, ambiguous: false };
};

export const compareBirthdates = (declaredIso, extractedRaw) => {
  if (!extractedRaw || !extractedRaw.toString().trim()) {
    return { status: 'missing', reason: 'The birthdate could not be read from the ID.' };
  }
  const extracted = parseDateLenient(extractedRaw);
  const declared = parseDateLenient(declaredIso);
  if (!extracted.iso) {
    return { status: 'uncertain', reason: 'The date on the ID is unclear or ambiguously formatted.' };
  }
  if (extracted.ambiguous && declared.iso) {
    // Ambiguous date that COULD equal the declared one under another
    // interpretation is not a mismatch — send to review.
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
  return {
    status: 'mismatch',
    reason: `The birthdate on the ID (${extracted.iso}) does not match the registered date (${declared.iso}).`,
  };
};

// ---------------------------------------------------------------------------
// Jurisdiction — Kalubihan, Cebu City
// ---------------------------------------------------------------------------

// Versioned place record. PSGC 0730600033 is the current PSA code for
// Barangay Kalubihan (Pob.), Cebu City; the legacy 9-digit code 072217033
// still appears in older IDs and directories.
export const JURISDICTION = {
  version: 'psgc-0730600033-1',
  barangay: 'Kalubihan',
  city: 'Cebu City',
  province: 'Cebu',
  region: 'Region VII',
  psgc_barangay_code: '0730600033',
  // Reviewed aliases only. Unknown spellings must NOT establish residency.
  barangay_aliases: ['kalubihan'],
  city_aliases: ['cebu city', 'city of cebu', 'dakbayan sa cebu'],
};

// A small registry of clearly-outside jurisdictions for definite detection.
// This is intentionally NOT exhaustive — anything unrecognized is 'unknown',
// which stays pending for admin review rather than being rejected.
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

// Returns 'eligible' | 'outside' | 'conflicting' | 'unknown'
export const evaluateJurisdiction = (addressText) => {
  const norm = normalizeText(addressText);
  if (!norm) return 'unknown';

  // "Kalubihan" used as a STREET name ("123 Kalubihan Street") is not
  // barangay evidence — a same-named street cannot establish residency.
  const streetKalubihan = /\bkalubihan\s+(street|st|avenue|ave|road|rd|drive|dr|highway|hwy)\b/.test(norm);
  const explicitKalubihan = /\b(?:brgy|barangay|bgy)\.?\s+kalubihan\b/.test(norm);
  const hasKalubihan = explicitKalubihan
    || (JURISDICTION.barangay_aliases.some((a) => norm.includes(a)) && !streetKalubihan);

  // An explicit different barangay ("brgy X" / "barangay X") is definite.
  const brgyMatch = norm.match(/\b(?:brgy|barangay|bgy)\.?\s+([a-z][a-z\s]{1,24}?)(?:\s+cebu|\s+ city|\s*$)/);
  const brgyToken = brgyMatch?.[1]?.trim();
  const explicitOtherBrgy = brgyToken && !JURISDICTION.barangay_aliases.includes(brgyToken);

  // A barangay from the reviewed registry is definite even without a marker.
  const knownOutsideBrgy = [...KNOWN_OUTSIDE_BARANGAYS]
    .find((b) => new RegExp(`\\b${b}\\b`).test(norm));

  const otherCity = KNOWN_CITIES.find((c) => norm.includes(c));

  if (hasKalubihan && (explicitOtherBrgy || knownOutsideBrgy || otherCity)) return 'conflicting';
  if (hasKalubihan) return 'eligible';                        // reviewed alias, no conflict
  if (explicitOtherBrgy || knownOutsideBrgy || otherCity) return 'outside';
  return 'unknown';                                           // right city maybe — can't tell barangay
};

export const compareAddressJurisdiction = (addressText) => {
  const result = evaluateJurisdiction(addressText);
  switch (result) {
    case 'eligible':
      return { status: 'match', reason: 'Address indicates Barangay Kalubihan, Cebu City.', outcome: 'eligible' };
    case 'outside':
      return {
        status: 'mismatch',
        reason: 'The address identifies a jurisdiction outside Barangay Kalubihan, Cebu City.',
        outcome: 'outside',
      };
    case 'conflicting':
      return {
        status: 'uncertain',
        reason: 'The address contains conflicting jurisdiction information and needs review.',
        outcome: 'conflicting',
      };
    default:
      return {
        status: 'uncertain',
        reason: 'The address could not be confirmed as Barangay Kalubihan, Cebu City.',
        outcome: 'unknown',
      };
  }
};

// ---------------------------------------------------------------------------
// Decision — combine field results into an outcome + explainable reasons.
// NEVER approves. Only definite mismatches produce correction_required.
// ---------------------------------------------------------------------------

export const decideVerification = ({ name, birthdate, address, ocrConfidence }) => {
  const reasons = [];
  const notes = [];

  if (ocrConfidence != null && ocrConfidence < MIN_DECISION_CONFIDENCE) {
    notes.push(`OCR confidence is low (${Math.round(ocrConfidence)}%) — all fields require human review.`);
  }
  const lowConfidence = ocrConfidence != null && ocrConfidence < MIN_DECISION_CONFIDENCE;

  const fields = { name, birthdate, address };
  let correction = false;

  for (const [key, field] of Object.entries(fields)) {
    if (!field) continue;
    if (field.status === 'mismatch' && !lowConfidence) {
      correction = true;
      reasons.push(field.reason);
    } else if (field.status === 'mismatch' && lowConfidence) {
      notes.push(`${key}: possible mismatch but OCR confidence is too low to conclude — needs review.`);
    } else if (field.status === 'uncertain' || field.status === 'missing') {
      notes.push(`${key}: ${field.reason}`);
    } else {
      notes.push(`${key}: ${field.reason}`);
    }
  }

  if (correction) {
    return { outcome: OUTCOME_CORRECTION, reasons, notes, fields };
  }
  return {
    outcome: OUTCOME_PENDING,
    reasons: [],
    notes: notes.length ? notes : ['Submission requires administrator review.'],
    fields,
  };
};
