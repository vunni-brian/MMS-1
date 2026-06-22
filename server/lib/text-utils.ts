/**
 * @file Text validation constants and helpers.
 * Defines maximum lengths for common input fields and provides a single
 * `validateText` function that enforces those limits with descriptive error
 * messages.
 */

export const MAX_NAME_LENGTH = 200;
export const MAX_EMAIL_LENGTH = 255;
export const MAX_PHONE_LENGTH = 20;
export const MAX_MESSAGE_LENGTH = 5000;
export const MAX_SUBJECT_LENGTH = 200;
export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 5000;
export const MAX_NOTE_LENGTH = 2000;
export const MAX_REASON_LENGTH = 500;
export const MAX_ADDRESS_LENGTH = 500;
export const MAX_STALL_NAME_LENGTH = 100;
export const MAX_ZONE_LENGTH = 100;
export const MAX_SIZE_LENGTH = 50;
export const MAX_IDENTIFIER_LENGTH = 100;
export const MAX_DEPARTMENT_LENGTH = 100;
export const MAX_REGION_LENGTH = 100;
export const MAX_UNIT_LENGTH = 50;
export const MAX_BILLING_PERIOD_LENGTH = 50;
export const MAX_INPUT_LENGTH = 500;
export const MAX_REFERENCE_LENGTH = 100;

/** Throw a 400 error if `value` exceeds `maxLength` characters. */
export const assertMaxLength = (value: string | undefined | null, maxLength: number, fieldName: string) => {
  if (value && value.length > maxLength) {
    throw Object.assign(new Error(`${fieldName} must be at most ${maxLength} characters.`), { statusCode: 400 });
  }
};

/** Escape HTML special characters (`<`, `>`, `"`, `'`, `/`) for safe output. */
export const sanitizeText = (value: string | undefined | null): string => {
  if (!value) return "";
  return value
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
};
