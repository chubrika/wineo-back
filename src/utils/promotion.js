export const PROMOTION_TYPES = /** @type {const} */ (['none', 'highlighted', 'featured', 'homepageTop']);

/** @typedef {(typeof PROMOTION_TYPES)[number]} PromotionType */

/**
 * Returns true when promotionType is not 'none' and promotionExpiresAt is in the future.
 * @param {{ promotionType?: string, promotionExpiresAt?: Date | string | null }} listing
 */
export function isPromotionActive(listing) {
  const type = listing?.promotionType;
  if (type == null || type === 'none') return false;
  const expiresAt = listing?.promotionExpiresAt ? new Date(listing.promotionExpiresAt) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) return false;
  return expiresAt.getTime() > Date.now();
}

/**
 * Expired promotions are treated as 'none'.
 * @param {{ promotionType?: string, promotionExpiresAt?: Date | string | null }} listing
 * @returns {PromotionType}
 */
export function getEffectivePromotionType(listing) {
  const raw = listing?.promotionType;
  if (raw === 'homepageTop' || raw === 'featured' || raw === 'highlighted') {
    return isPromotionActive(listing) ? raw : 'none';
  }
  return 'none';
}

/**
 * Promotion rank for sorting (lower = higher priority).
 * Active: homepageTop(0) > featured(1) > highlighted(2) > none(3)
 * Inactive/expired always ranks as none(3).
 * @param {{ promotionType?: string, promotionExpiresAt?: Date | string | null }} listing
 */
export function getPromotionRank(listing) {
  const type = getEffectivePromotionType(listing);
  if (type === 'homepageTop') return 0;
  if (type === 'featured') return 1;
  if (type === 'highlighted') return 2;
  return 3;
}

/**
 * Sort comparator: promotion rank ASC, then createdAt DESC.
 * @param {{ promotionType?: string, promotionExpiresAt?: Date | string | null, createdAt?: Date | string }} a
 * @param {{ promotionType?: string, promotionExpiresAt?: Date | string | null, createdAt?: Date | string }} b
 */
export function compareByPromotionThenCreatedAtDesc(a, b) {
  const ra = getPromotionRank(a);
  const rb = getPromotionRank(b);
  if (ra !== rb) return ra - rb;
  const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
  const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
  return tb - ta;
}

/**
 * Normalizes incoming promotion payload.
 * - Unknown types become 'none'
 * - If type === 'none' => expiresAt null
 * - If type !== 'none' but expiresAt is invalid/not in future => becomes 'none'
 *
 * @param {{ promotionType?: unknown, promotionExpiresAt?: unknown }} body
 * @returns {{ promotionType: PromotionType, promotionExpiresAt: Date | null }}
 */
export function normalizePromotionInput(body) {
  const rawType = typeof body?.promotionType === 'string' ? body.promotionType : 'none';
  const type =
    rawType === 'homepageTop' || rawType === 'featured' || rawType === 'highlighted' || rawType === 'none'
      ? rawType
      : 'none';

  if (type === 'none') {
    return { promotionType: 'none', promotionExpiresAt: null };
  }

  const rawExpiresAt = body?.promotionExpiresAt;
  const expiresAt =
    rawExpiresAt instanceof Date
      ? rawExpiresAt
      : typeof rawExpiresAt === 'string' || typeof rawExpiresAt === 'number'
        ? new Date(rawExpiresAt)
        : null;

  if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return { promotionType: 'none', promotionExpiresAt: null };
  }

  return { promotionType: type, promotionExpiresAt: expiresAt };
}

