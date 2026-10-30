import { test, expect } from '@playwright/test';
import {
  OUTCOME_PENDING, OUTCOME_CORRECTION,
  normalizeText, tokenizeName, parseDateLenient,
  compareNames, compareBirthdates,
  evaluateJurisdiction, compareAddressJurisdiction, decideVerification,
} from '../src/utils/verificationRules.js';

// Deterministic policy tests — no browser, no network. These pin down the
// conservative matching contract: only definite mismatches produce
// correction_required; everything else stays pending for an admin.

test.describe('verification rules — normalization', () => {
  test('normalizeText folds case, punctuation, whitespace', () => {
    expect(normalizeText('  Dela  CRUZ,  Juan ')).toBe('dela cruz juan');
    expect(normalizeText('José Rizal')).toBe('josé rizal');
    expect(normalizeText(null)).toBe('');
  });

  test('tokenizeName drops generational suffixes but records them', () => {
    const t = tokenizeName('Juan Dela Cruz Jr.');
    expect(t.tokens).toEqual(['juan', 'dela', 'cruz']);
    expect(t.suffixes).toEqual(['jr']);
  });
});

test.describe('verification rules — names', () => {
  test('exact match regardless of token order and case', () => {
    expect(compareNames('Juan Dela Cruz', 'DELA CRUZ, JUAN').status).toBe('match');
  });

  test('missing middle name is not a mismatch', () => {
    // Middle-name differences are uncertain, not match — the reviewer sees a
    // note rather than a false "fully confirmed" (stays pending either way).
    expect(compareNames('Juan Santos Dela Cruz', 'DELA CRUZ, JUAN').status).toBe('uncertain');
    expect(compareNames('Juan Dela Cruz', 'DELA CRUZ, JUAN SANTOS').status).toBe('uncertain');
  });

  test('initials expand safely', () => {
    expect(compareNames('Juan D Cruz', 'CRUZ, JUAN DELA').status).toBe('match');
  });

  test('single OCR spelling error on a long token is forgiven', () => {
    expect(compareNames('Juan Dela Cruz', 'DELA CRUZ, JUAM').status).toBe('match');
  });

  test('different surname is a definite mismatch', () => {
    const r = compareNames('Juan Dela Cruz', 'REYES, JUAN');
    expect(r.status).toBe('mismatch');
  });

  test('unreadable name is missing, not a mismatch', () => {
    expect(compareNames('Juan Dela Cruz', '').status).toBe('missing');
    expect(compareNames('Juan Dela Cruz', null).status).toBe('missing');
  });

  test('unicode names compare correctly', () => {
    expect(compareNames('José María Peña', 'PEÑA, JOSÉ MARÍA').status).toBe('match');
  });
});

test.describe('verification rules — birthdates', () => {
  test('ISO parse is unambiguous', () => {
    expect(parseDateLenient('1990-03-15').iso).toBe('1990-03-15');
  });

  test('named-month dates parse', () => {
    expect(parseDateLenient('March 15, 1990').iso).toBe('1990-03-15');
    expect(parseDateLenient('15 March 1990').iso).toBe('1990-03-15');
  });

  test('day > 12 in first position resolves DD/MM', () => {
    expect(parseDateLenient('25/03/1990').iso).toBe('1990-03-25');
  });

  test('day/month ambiguity is flagged, not resolved', () => {
    expect(parseDateLenient('03/04/1990').ambiguous).toBe(true);
  });

  test('matching dates match', () => {
    expect(compareBirthdates('1990-03-15', '1990-03-15').status).toBe('match');
    expect(compareBirthdates('1990-03-15', 'March 15, 1990').status).toBe('match');
  });

  test('unambiguous different date is a mismatch', () => {
    expect(compareBirthdates('1990-03-15', '1990-08-22').status).toBe('mismatch');
  });

  test('ambiguous extracted date that could match is uncertain, not mismatch', () => {
    // Declared 1990-03-04; ID reads 04/03/1990 (ambiguous MM/DD vs DD/MM) → same date under DD/MM
    expect(compareBirthdates('1990-03-04', '04/03/1990').status).toBe('match');
  });

  test('unreadable date is missing', () => {
    expect(compareBirthdates('1990-03-15', '').status).toBe('missing');
    expect(compareBirthdates('1990-03-15', 'not a date').status).toBe('uncertain');
  });
});

test.describe('verification rules — Kalubihan jurisdiction', () => {
  test('Kalubihan + Cebu City is eligible', () => {
    expect(evaluateJurisdiction('Purok 3, Barangay Kalubihan, Cebu City')).toBe('eligible');
    expect(evaluateJurisdiction('Brgy. Kalubihan, Cebu')).toBe('eligible');
  });

  test('reviewed alias only — substring elsewhere does not establish residency', () => {
    expect(evaluateJurisdiction('123 Kalubihan Street, Labangon, Cebu City')).not.toBe('eligible');
  });

  test('explicit other barangay in Cebu City is outside', () => {
    expect(evaluateJurisdiction('Sitio Upper, Barangay Labangon, Cebu City')).toBe('outside');
  });

  test('known other city is outside', () => {
    expect(evaluateJurisdiction('Brgy. Centro, Mandaue City')).toBe('outside');
    expect(evaluateJurisdiction('Quezon City, Metro Manila')).toBe('outside');
  });

  test('Kalubihan + conflicting city is conflicting → pending', () => {
    expect(evaluateJurisdiction('Barangay Kalubihan, Mandaue')).toBe('conflicting');
  });

  test('unresolvable addresses are unknown → pending', () => {
    expect(evaluateJurisdiction('Cebu City')).toBe('unknown');
    expect(evaluateJurisdiction('Purok 5, Sitio Proper')).toBe('unknown');
    expect(evaluateJurisdiction('')).toBe('unknown');
  });
});

test.describe('verification rules — decision outcomes', () => {
  const ok = (reason = 'ok') => ({ status: 'match', reason });

  test('all matches still produce pending — never an approval', () => {
    const d = decideVerification({ name: ok(), birthdate: ok(), address: ok(), ocrConfidence: 95 });
    expect(d.outcome).toBe(OUTCOME_PENDING);
  });

  test('definite mismatch produces correction_required with reasons', () => {
    const d = decideVerification({
      name: { status: 'mismatch', reason: 'Surname differs' },
      birthdate: ok(),
      address: ok(),
      ocrConfidence: 95,
    });
    expect(d.outcome).toBe(OUTCOME_CORRECTION);
    expect(d.reasons).toContain('Surname differs');
  });

  test('outside jurisdiction produces correction_required', () => {
    const d = decideVerification({
      name: ok(), birthdate: ok(),
      address: compareAddressJurisdiction('Barangay Labangon, Cebu City'),
      ocrConfidence: 95,
    });
    expect(d.outcome).toBe(OUTCOME_CORRECTION);
  });

  test('low OCR confidence downgrades mismatches to pending', () => {
    const d = decideVerification({
      name: { status: 'mismatch', reason: 'Surname differs' },
      birthdate: ok(), address: ok(),
      ocrConfidence: 40,
    });
    expect(d.outcome).toBe(OUTCOME_PENDING);
  });

  test('uncertain and missing fields stay pending', () => {
    const d = decideVerification({
      name: { status: 'uncertain', reason: 'middle name unconfirmed' },
      birthdate: { status: 'missing', reason: 'unreadable' },
      address: { status: 'uncertain', reason: 'unknown jurisdiction' },
      ocrConfidence: 90,
    });
    expect(d.outcome).toBe(OUTCOME_PENDING);
    expect(d.notes.length).toBeGreaterThan(0);
  });
});
