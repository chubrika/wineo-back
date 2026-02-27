import { Router } from 'express';
import { Category } from '../models/Category.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /categories
 * List all categories (optional query: ?parentId=id for children only, ?roots=1 for top-level only)
 */
router.get('/', async (req, res) => {
  try {
    const { parentId, roots } = req.query;
    const filter = {};

    if (roots === '1' || roots === 'true') {
      filter.parentId = null;
    } else if (parentId) {
      filter.parentId = parentId;
    }

    const categories = await Category.find(filter)
      .sort({ parentId: 1, name: 1 })
      .lean();

    const list = categories.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      slug: c.slug,
      description: c.description || '',
      active: c.active,
      parentId: c.parentId ? c.parentId.toString() : null,
      level: c.level ?? 0,
      path: (c.path || []).map((id) => id.toString()),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    res.json(list);
  } catch (err) {
    console.error('Categories list error:', err);
    res.status(500).json({ error: 'Failed to list categories' });
  }
});

/**
 * GET /categories/slug/:slug
 * Get one category by URL slug (active only). Must be before /:id so "slug" is not treated as id.
 * Slug is normalized to lowercase to match DB (schema has lowercase: true).
 */
router.get('/slug/:slug', async (req, res) => {
  try {
    const rawSlug = req.params.slug;
    const slug = typeof rawSlug === 'string' ? rawSlug.trim().toLowerCase() : '';
    if (!slug) {
      return res.status(404).json({ error: 'Category not found' });
    }
    const category = await Category.findOne({ slug, active: true }).lean();
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({
      id: category._id.toString(),
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      active: category.active,
      parentId: category.parentId ? category.parentId.toString() : null,
      level: category.level ?? 0,
      path: (category.path || []).map((id) => id.toString()),
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    });
  } catch (err) {
    console.error('Category get by slug error:', err);
    res.status(500).json({ error: 'Failed to get category' });
  }
});

/**
 * GET /categories/:id
 * Get one category by id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id).lean();
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({
      id: category._id.toString(),
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      active: category.active,
      parentId: category.parentId ? category.parentId.toString() : null,
      level: category.level ?? 0,
      path: (category.path || []).map((id) => id.toString()),
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    });
  } catch (err) {
    console.error('Category get error:', err);
    res.status(500).json({ error: 'Failed to get category' });
  }
});

/**
 * POST /categories
 * Create a category (add). Body: { name, slug?, description?, active?, parentId? }
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, slug, description, active, parentId } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const slugValue =
      (typeof slug === 'string' && slug.trim()) ||
      name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '') ||
      `category-${Date.now()}`;

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugValue)) {
      return res.status(400).json({ error: 'Slug must be URL-friendly (lowercase, hyphens only)' });
    }

    const parentIdObj = parentId ? parentId : null;
    if (parentIdObj) {
      const parent = await Category.findById(parentId);
      if (!parent) {
        return res.status(400).json({ error: 'Parent category not found' });
      }
    }

    const existing = await Category.findOne({ parentId: parentIdObj || null, slug: slugValue });
    if (existing) {
      return res.status(409).json({ error: 'A category with this slug already exists under this parent' });
    }

    const category = await Category.create({
      name: name.trim(),
      slug: slugValue,
      description: typeof description === 'string' ? description.trim() : '',
      active: active !== false,
      parentId: parentIdObj || null,
    });

    res.status(201).json({
      id: category._id.toString(),
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      active: category.active,
      parentId: category.parentId ? category.parentId.toString() : null,
      level: category.level ?? 0,
      path: (category.path || []).map((id) => id.toString()),
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors)
        .map((e) => e.message)
        .join(' ');
      return res.status(400).json({ error: msg });
    }
    console.error('Category create error:', err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

/**
 * PUT /categories/:id
 * Update a category (edit). Body: { name?, slug?, description?, active?, parentId? }
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, active, parentId } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Category name cannot be empty' });
      }
      category.name = name.trim();
    }

    if (slug !== undefined) {
      const slugValue = typeof slug === 'string' ? slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : category.slug;
      if (!slugValue || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugValue)) {
        return res.status(400).json({ error: 'Slug must be URL-friendly (lowercase, hyphens only)' });
      }
      const parentIdForUnique = parentId !== undefined ? parentId : (category.parentId && category.parentId.toString()) || null;
      const existing = await Category.findOne({
        _id: { $ne: id },
        parentId: parentIdForUnique || null,
        slug: slugValue,
      });
      if (existing) {
        return res.status(409).json({ error: 'A category with this slug already exists under this parent' });
      }
      category.slug = slugValue;
    }

    if (description !== undefined) {
      category.description = typeof description === 'string' ? description.trim() : '';
    }
    if (active !== undefined) {
      category.active = !!active;
    }
    if (parentId !== undefined) {
      if (parentId === null || parentId === '') {
        category.parentId = null;
      } else {
        const parent = await Category.findById(parentId);
        if (!parent) {
          return res.status(400).json({ error: 'Parent category not found' });
        }
        if (parent._id.toString() === id) {
          return res.status(400).json({ error: 'Category cannot be its own parent' });
        }
        category.parentId = parent._id;
      }
    }

    await category.save();

    res.json({
      id: category._id.toString(),
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      active: category.active,
      parentId: category.parentId ? category.parentId.toString() : null,
      level: category.level ?? 0,
      path: (category.path || []).map((id) => id.toString()),
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors)
        .map((e) => e.message)
        .join(' ');
      return res.status(400).json({ error: msg });
    }
    console.error('Category update error:', err);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

/**
 * DELETE /categories/:id
 * Delete a category
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const childrenCount = await Category.countDocuments({ parentId: category._id });
    if (childrenCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete category that has subcategories. Delete or move children first.',
      });
    }

    await Category.deleteOne({ _id: id });

    res.status(204).send();
  } catch (err) {
    console.error('Category delete error:', err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
