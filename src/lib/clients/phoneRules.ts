export const PLACEHOLDER_PHONE = '0000000';
export const SHOP_PHONES = ['018729165', '3711170919'] as const;

export const normalizePhone = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const cleaned = value.replace(/\D/g, '');
  return cleaned.length > 0 ? cleaned : null;
};

export const isPlaceholderPhone = (value: string | null | undefined): boolean => {
  const normalized = normalizePhone(value);
  return normalized === PLACEHOLDER_PHONE;
};

export const isShopPhone = (value: string | null | undefined): boolean => {
  const normalized = normalizePhone(value);
  return normalized !== null && SHOP_PHONES.includes(normalized as typeof SHOP_PHONES[number]);
};

export const isRealCustomerPhone = (value: string | null | undefined): boolean => {
  const normalized = normalizePhone(value);
  if (!normalized) return false;
  if (normalized === PLACEHOLDER_PHONE) return false;
  if (SHOP_PHONES.includes(normalized as typeof SHOP_PHONES[number])) return false;
  return true;
};

export const isOtticaBianchiName = (nome?: string | null, cognome?: string | null): boolean => {
  const combined = `${nome ?? ''} ${cognome ?? ''}`.toLowerCase();
  return combined.includes('ottica') && combined.includes('bianchi');
};
