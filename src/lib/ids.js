// M-Pesa transaction IDs: 10 characters, start with U, contain at least one digit (e.g. UJ12J8UBO2)
export const ID_RE = /^U(?=[A-Z0-9]*\d)[A-Z0-9]{9}$/;
export const ID_FIND = /\bU(?=[A-Z0-9]*\d)[A-Z0-9]{9}\b/;

const clean = (t) => t.toUpperCase().replace(/[^A-Z0-9]/g, '');

// A system cell can hold several IDs ("UJ1,UJ2" or "UJ1/UJ2"), lowercase IDs, trailing dots, or notes.
export function idsFromCell(value) {
  if (value == null) return [];
  return String(value)
    .split(/[,\/;\s]+/)
    .map(clean)
    .filter((t) => ID_RE.test(t));
}
