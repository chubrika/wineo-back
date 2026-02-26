import { Router } from 'express';
import { Filter } from '../models/Filter.js';
import { getFiltersByCategory } from '../services/filterService.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function toFilterJson(f) {
  return {
    id: f._id.toString(),
    name: f.name,
    slug: f.slug,
    type: f.type,
    options: f.options,
    unit: f.unit || '',
    categoryId: f.categoryId.toString(),
    applyToChildren: f.applyToChildren,
    isRequired: f.isRequired,
    sortOrder: f.sortOrder,
    isActive: f.isActive,
  };
}

/**
 * GET /filters/by-category/:categoryId
 * Returns filters applicable to the category (own + inherited from path with applyToChildren).
 */
router.get('/by-category/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const filters = await getFiltersByCategory(categoryId);
    if (filters === null) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(filters.map(toFilterJson));
  } catch (err) {
    console.error('getFiltersByCategory error:', err);
    res.status(500).json({ error: 'Failed to get filters for category' });
  }
});

/**
 * GET /filters
 * List filters. ?categoryId=id filters by category. ?all=1 returns all (including inactive) for admin.
 */
router.get('/', async (req, res) => {
  try {
    const { categoryId, all } = req.query;
    const filter = {};
    if (all !== '1' && all !== 'true') filter.isActive = true;
    if (categoryId) filter.categoryId = categoryId;

    const filters = await Filter.find(filter)
      .sort({ categoryId: 1, sortOrder: 1, name: 1 })
      .lean();

    res.json(filters.map(toFilterJson));
  } catch (err) {
    console.error('Filters list error:', err);
    res.status(500).json({ error: 'Failed to list filters' });
  }
});

/**
 * POST /filters
 * Create a filter (admin).
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, slug, type, options, unit, categoryId, applyToChildren, isRequired, sortOrder, isActive } =
      req.body;

    if (!name || !type || !categoryId) {
      return res.status(400).json({ error: 'name, type, and categoryId are required' });
    }

    const slugValue =
      (typeof slug === 'string' && slug.trim()) ||
      name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '') ||
      `filter-${Date.now()}`;

    const filter = await Filter.create({
      name: name.trim(),
      slug: slugValue,
      type,
      options: type === 'select' ? options || [] : undefined,
      unit: unit || '',
      categoryId,
      applyToChildren: !!applyToChildren,
      isRequired: !!isRequired,
      sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
      isActive: isActive !== false,
    });

    res.status(201).json({
      id: filter._id.toString(),
      name: filter.name,
      slug: filter.slug,
      type: filter.type,
      options: filter.options,
      unit: filter.unit || '',
      categoryId: filter.categoryId.toString(),
      applyToChildren: filter.applyToChildren,
      isRequired: filter.isRequired,
      sortOrder: filter.sortOrder,
      isActive: filter.isActive,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors)
        .map((e) => e.message)
        .join(' ');
      return res.status(400).json({ error: msg });
    }
    console.error('Filter create error:', err);
    res.status(500).json({ error: 'Failed to create filter' });
  }
});

/**
 * PUT /filters/:id
 * Update a filter (admin).
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, type, options, unit, categoryId, applyToChildren, isRequired, sortOrder, isActive } =
      req.body;

    const filter = await Filter.findById(id);
    if (!filter) {
      return res.status(404).json({ error: 'Filter not found' });
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }
      filter.name = name.trim();
    }
    if (slug !== undefined) {
      const slugValue =
        (typeof slug === 'string' && slug.trim()) ||
        filter.name
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '') ||
        `filter-${Date.now()}`;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugValue)) {
        return res.status(400).json({ error: 'Slug must be URL-friendly (lowercase, hyphens only)' });
      }
      filter.slug = slugValue;
    }
    if (type !== undefined) filter.type = type;
    if (options !== undefined) filter.options = filter.type === 'select' ? (options || []) : undefined;
    if (unit !== undefined) filter.unit = unit || '';
    if (categoryId !== undefined) filter.categoryId = categoryId;
    if (applyToChildren !== undefined) filter.applyToChildren = !!applyToChildren;
    if (isRequired !== undefined) filter.isRequired = !!isRequired;
    if (sortOrder !== undefined) filter.sortOrder = typeof sortOrder === 'number' ? sortOrder : filter.sortOrder;
    if (isActive !== undefined) filter.isActive = !!isActive;

    await filter.save();
    res.json(toFilterJson(filter));
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors)
        .map((e) => e.message)
        .join(' ');
      return res.status(400).json({ error: msg });
    }
    console.error('Filter update error:', err);
    res.status(500).json({ error: 'Failed to update filter' });
  }
});

/**
 * DELETE /filters/:id
 * Delete a filter (admin).
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const filter = await Filter.findByIdAndDelete(id);
    if (!filter) {
      return res.status(404).json({ error: 'Filter not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Filter delete error:', err);
    res.status(500).json({ error: 'Failed to delete filter' });
  }
});

export default router;
