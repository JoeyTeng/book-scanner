/**
 * Validate ISBN-10 format
 */
export function isValidISBN10(isbn: string): boolean {
  const cleaned = isbn.replace(/[^0-9X]/gi, '');
  if (cleaned.length !== 10) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }

  const lastChar = cleaned[9].toUpperCase();
  const checkDigit = lastChar === 'X' ? 10 : parseInt(lastChar);
  sum += checkDigit;

  return sum % 11 === 0;
}

/**
 * Validate ISBN-13 format
 */
export function isValidISBN13(isbn: string): boolean {
  const cleaned = isbn.replace(/[^0-9]/g, '');
  if (cleaned.length !== 13) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * (i % 2 === 0 ? 1 : 3);
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(cleaned[12]);
}

/**
 * Convert ISBN-10 to ISBN-13
 */
export function convertISBN10to13(isbn10: string): string {
  const cleaned = isbn10.replace(/[^0-9X]/gi, '').substring(0, 9);
  const base = '978' + cleaned;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3);
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return base + checkDigit;
}

/**
 * Normalize ISBN to ISBN-13 format
 */
export function normalizeISBN(isbn: string): string {
  const cleaned = isbn.replace(/[^0-9X]/gi, '');

  if (cleaned.length === 10 && isValidISBN10(cleaned)) {
    return convertISBN10to13(cleaned);
  }

  if (cleaned.length === 13 && isValidISBN13(cleaned)) {
    return cleaned;
  }

  return isbn;
}

/**
 * Format ISBN with hyphens for display
 */
export function formatISBN(isbn: string): string {
  const cleaned = isbn.replace(/[^0-9X]/gi, '');

  if (cleaned.length === 13) {
    return `${cleaned.substring(0, 3)}-${cleaned.substring(3, 4)}-${cleaned.substring(4, 9)}-${cleaned.substring(9, 12)}-${cleaned.substring(12)}`;
  }

  if (cleaned.length === 10) {
    return `${cleaned.substring(0, 1)}-${cleaned.substring(1, 5)}-${cleaned.substring(5, 9)}-${cleaned.substring(9)}`;
  }

  return isbn;
}
