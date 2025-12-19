/**
 * Phone Number Formatting Utilities
 *
 * These functions handle Italian phone number formatting:
 * - Input: Any format (347-7282793, 3477282793, 347 7282793, +39 347 7282793, etc.)
 * - Storage: Normalized without spaces/dashes (3477282793)
 * - Display: Formatted as "347 7282793" (3-digit prefix + space + remaining digits)
 */

/**
 * Normalizes phone number for storage (removes all non-digit characters except optional leading +)
 * @param phone - Raw phone number input
 * @returns Normalized phone string (e.g., "3477282793" or "+393477282793")
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;

  const trimmed = phone.trim();
  if (!trimmed) return null;

  // Remove all spaces, dashes, dots, parentheses
  const normalized = trimmed.replace(/[\s\-\.()]/g, '');

  // Keep only digits (and optional leading +)
  const cleaned = normalized.replace(/[^\d+]/g, '');

  return cleaned || null;
}

/**
 * Formats phone number for display as "347 7282793"
 * Italian mobile format: 3-digit prefix + space + remaining digits
 *
 * @param phone - Phone number (any format)
 * @returns Formatted phone string or original if invalid format
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return '';

  // First normalize to get only digits
  const normalized = normalizePhone(phone);
  if (!normalized) return phone; // Return original if normalization failed

  // Remove leading + and country code if present
  let digits = normalized;
  if (digits.startsWith('+39')) {
    digits = digits.substring(3); // Remove +39
  } else if (digits.startsWith('+')) {
    digits = digits.substring(1); // Remove other + prefix
  }

  // Italian mobile numbers are 10 digits (3XX XXXXXXX)
  if (digits.length === 10 && digits.startsWith('3')) {
    const prefix = digits.substring(0, 3);  // First 3 digits
    const rest = digits.substring(3);        // Remaining 7 digits
    return `${prefix} ${rest}`;
  }

  // Italian landline numbers are 9-11 digits with various formats
  // For simplicity, if 9-11 digits, format as: first 3 + space + rest
  if (digits.length >= 9 && digits.length <= 11) {
    const prefix = digits.substring(0, 3);
    const rest = digits.substring(3);
    return `${prefix} ${rest}`;
  }

  // For other lengths, return as-is (international, short codes, etc.)
  return digits;
}

/**
 * Validates if a phone number is valid for storage
 * @param phone - Phone number to validate
 * @returns true if valid (at least 9 digits)
 */
export function isValidPhone(phone: string | null | undefined): boolean {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;

  // Remove any country code prefix
  const digits = normalized.replace(/^\+\d+/, '');

  // Italian numbers should be 9-11 digits
  return digits.length >= 9 && digits.length <= 11;
}
