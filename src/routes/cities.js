import { Router } from 'express';
import { City } from '../models/City.js';
import { Region } from '../models/Region.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /cities
 * List all cities. Query: ?regionId=id to filter by region
 */
router.get('/', async (req, res) => {
  try {
    const { regionId } = req.query;
    const filter = {};
    if (regionId && typeof regionId === 'string') {
      filter.regionId = regionId;
    }

    const cities = await City.find(filter)
      .populate('regionId', 'slug label')
      .sort({ 'regionId': 1, label: 1 })
      .lean();

    const list = cities.map((c) => ({
      id: c._id.toString(),
      slug: c.slug,
      label: c.label,
      regionId: c.regionId?._id?.toString() ?? c.regionId?.toString(),
      region: c.regionId
        ? {
            id: c.regionId._id.toString(),
            slug: c.regionId.slug,
            label: c.regionId.label,
          }
        : null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    res.json(list);
  } catch (err) {
    console.error('Cities list error:', err);
    res.status(500).json({ error: 'Failed to list cities' });
  }
});

/**
 * GET /cities/:id
 * Get one city by id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const city = await City.findById(id).populate('regionId', 'slug label').lean();
    if (!city) {
      return res.status(404).json({ error: 'City not found' });
    }
    res.json({
      id: city._id.toString(),
      slug: city.slug,
      label: city.label,
      regionId: city.regionId?._id?.toString() ?? city.regionId?.toString(),
      region: city.regionId
        ? {
            id: city.regionId._id.toString(),
            slug: city.regionId.slug,
            label: city.regionId.label,
          }
        : null,
      createdAt: city.createdAt,
      updatedAt: city.updatedAt,
    });
  } catch (err) {
    console.error('City get error:', err);
    res.status(500).json({ error: 'Failed to get city' });
  }
});

/**
 * POST /cities
 * Create a city. Body: { slug?, label, regionId }
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { slug, label, regionId } = req.body;

    if (!label || typeof label !== 'string' || !label.trim()) {
      return res.status(400).json({ error: 'City label is required' });
    }
    if (!regionId) {
      return res.status(400).json({ error: 'Region is required' });
    }

    const region = await Region.findById(regionId);
    if (!region) {
      return res.status(400).json({ error: 'Region not found' });
    }

    const slugValue =
      (typeof slug === 'string' && slug.trim())
        ? slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        : label
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '') || `city-${Date.now()}`;

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugValue)) {
      return res.status(400).json({ error: 'Slug must be URL-friendly (lowercase, hyphens only)' });
    }

    const existing = await City.findOne({ regionId, slug: slugValue });
    if (existing) {
      return res.status(409).json({ error: 'A city with this slug already exists in this region' });
    }

    const city = await City.create({
      slug: slugValue,
      label: label.trim(),
      regionId: region._id,
    });

    const populated = await City.findById(city._id).populate('regionId', 'slug label').lean();
    res.status(201).json({
      id: populated._id.toString(),
      slug: populated.slug,
      label: populated.label,
      regionId: populated.regionId._id.toString(),
      region: {
        id: populated.regionId._id.toString(),
        slug: populated.regionId.slug,
        label: populated.regionId.label,
      },
      createdAt: populated.createdAt,
      updatedAt: populated.updatedAt,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors)
        .map((e) => e.message)
        .join(' ');
      return res.status(400).json({ error: msg });
    }
    console.error('City create error:', err);
    res.status(500).json({ error: 'Failed to create city' });
  }
});

/**
 * PUT /cities/:id
 * Update a city. Body: { slug?, label?, regionId? }
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { slug, label, regionId } = req.body;

    const city = await City.findById(id);
    if (!city) {
      return res.status(404).json({ error: 'City not found' });
    }

    if (label !== undefined) {
      if (typeof label !== 'string' || !label.trim()) {
        return res.status(400).json({ error: 'City label cannot be empty' });
      }
      city.label = label.trim();
    }

    if (regionId !== undefined) {
      const region = await Region.findById(regionId);
      if (!region) {
        return res.status(400).json({ error: 'Region not found' });
      }
      city.regionId = region._id;
    }

    if (slug !== undefined) {
      const slugValue =
        typeof slug === 'string'
          ? slug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
          : city.slug;
      if (!slugValue || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugValue)) {
        return res.status(400).json({ error: 'Slug must be URL-friendly (lowercase, hyphens only)' });
      }
      const regionIdForUnique = city.regionId.toString();
      const existing = await City.findOne({
        _id: { $ne: id },
        regionId: regionIdForUnique,
        slug: slugValue,
      });
      if (existing) {
        return res.status(409).json({ error: 'A city with this slug already exists in this region' });
      }
      city.slug = slugValue;
    }

    await city.save();

    const populated = await City.findById(city._id).populate('regionId', 'slug label').lean();
    res.json({
      id: populated._id.toString(),
      slug: populated.slug,
      label: populated.label,
      regionId: populated.regionId._id.toString(),
      region: {
        id: populated.regionId._id.toString(),
        slug: populated.regionId.slug,
        label: populated.regionId.label,
      },
      createdAt: populated.createdAt,
      updatedAt: populated.updatedAt,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors)
        .map((e) => e.message)
        .join(' ');
      return res.status(400).json({ error: msg });
    }
    console.error('City update error:', err);
    res.status(500).json({ error: 'Failed to update city' });
  }
});

/**
 * DELETE /cities/:id
 * Delete a city
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const city = await City.findById(id);
    if (!city) {
      return res.status(404).json({ error: 'City not found' });
    }

    await City.deleteOne({ _id: id });

    res.status(204).send();
  } catch (err) {
    console.error('City delete error:', err);
    res.status(500).json({ error: 'Failed to delete city' });
  }
});

export default router;
