import { Router } from 'express';
import { Region } from '../models/Region.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /regions
 * List all regions
 */
router.get('/', async (req, res) => {
  try {
    const regions = await Region.find({}).sort({ label: 1 }).lean();

    const list = regions.map((r) => ({
      id: r._id.toString(),
      slug: r.slug,
      label: r.label,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    res.json(list);
  } catch (err) {
    console.error('Regions list error:', err);
    res.status(500).json({ error: 'Failed to list regions' });
  }
});

/**
 * GET /regions/:id
 * Get one region by id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const region = await Region.findById(id).lean();
    if (!region) {
      return res.status(404).json({ error: 'Region not found' });
    }
    res.json({
      id: region._id.toString(),
      slug: region.slug,
      label: region.label,
      createdAt: region.createdAt,
      updatedAt: region.updatedAt,
    });
  } catch (err) {
    console.error('Region get error:', err);
    res.status(500).json({ error: 'Failed to get region' });
  }
});

/**
 * POST /regions
 * Create a region. Body: { slug, label }
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { slug, label } = req.body;

    if (!label || typeof label !== 'string' || !label.trim()) {
      return res.status(400).json({ error: 'Region label is required' });
    }

    const slugValue =
      (typeof slug === 'string' && slug.trim())
        ? slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        : label
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '') || `region-${Date.now()}`;

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugValue)) {
      return res.status(400).json({ error: 'Slug must be URL-friendly (lowercase, hyphens only)' });
    }

    const existing = await Region.findOne({ slug: slugValue });
    if (existing) {
      return res.status(409).json({ error: 'A region with this slug already exists' });
    }

    const region = await Region.create({
      slug: slugValue,
      label: label.trim(),
    });

    res.status(201).json({
      id: region._id.toString(),
      slug: region.slug,
      label: region.label,
      createdAt: region.createdAt,
      updatedAt: region.updatedAt,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors)
        .map((e) => e.message)
        .join(' ');
      return res.status(400).json({ error: msg });
    }
    console.error('Region create error:', err);
    res.status(500).json({ error: 'Failed to create region' });
  }
});

/**
 * PUT /regions/:id
 * Update a region. Body: { slug?, label? }
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { slug, label } = req.body;

    const region = await Region.findById(id);
    if (!region) {
      return res.status(404).json({ error: 'Region not found' });
    }

    if (label !== undefined) {
      if (typeof label !== 'string' || !label.trim()) {
        return res.status(400).json({ error: 'Region label cannot be empty' });
      }
      region.label = label.trim();
    }

    if (slug !== undefined) {
      const slugValue =
        typeof slug === 'string'
          ? slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
          : region.slug;
      if (!slugValue || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugValue)) {
        return res.status(400).json({ error: 'Slug must be URL-friendly (lowercase, hyphens only)' });
      }
      const existing = await Region.findOne({ _id: { $ne: id }, slug: slugValue });
      if (existing) {
        return res.status(409).json({ error: 'A region with this slug already exists' });
      }
      region.slug = slugValue;
    }

    await region.save();

    res.json({
      id: region._id.toString(),
      slug: region.slug,
      label: region.label,
      createdAt: region.createdAt,
      updatedAt: region.updatedAt,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors)
        .map((e) => e.message)
        .join(' ');
      return res.status(400).json({ error: msg });
    }
    console.error('Region update error:', err);
    res.status(500).json({ error: 'Failed to update region' });
  }
});

/**
 * DELETE /regions/:id
 * Delete a region
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const region = await Region.findById(id);
    if (!region) {
      return res.status(404).json({ error: 'Region not found' });
    }

    await Region.deleteOne({ _id: id });

    res.status(204).send();
  } catch (err) {
    console.error('Region delete error:', err);
    res.status(500).json({ error: 'Failed to delete region' });
  }
});

export default router;
