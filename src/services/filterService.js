import { Category } from '../models/Category.js';
import { Filter } from '../models/Filter.js';

/**
 * Returns filters applicable to the given category:
 * - filters where categoryId equals the selected category, or
 * - filters where categoryId is in the category's path and applyToChildren is true.
 * Only active filters, sorted by sortOrder.
 * ElasticSearch-ready: same logic can be applied when building filter facets from indexed listings.
 *
 * @param {import('mongoose').Types.ObjectId|string} categoryId
 * @returns {Promise<import('mongoose').LeanDocument[]|null>} Filters or null if category not found
 */
export async function getFiltersByCategory(categoryId) {
  const category = await Category.findById(categoryId).lean();
  if (!category) return null;

  const path = category.path || [];

  const filters = await Filter.find({
    isActive: true,
    $or: [
      { categoryId: category._id },
      {
        categoryId: { $in: path },
        applyToChildren: true,
      },
    ],
  })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  return filters;
}
