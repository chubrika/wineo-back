import { Router } from 'express';
import mongoose from 'mongoose';
import { Listing } from '../models/Listing.js';
import { Category } from '../models/Category.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/** Build URL-friendly slug from title (lowercase, hyphens, no leading/trailing/consecutive hyphens). */
function slugFromTitle(title) {
  if (!title || typeof title !== 'string') return `listing-${Date.now()}`;
  const s = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || `listing-${Date.now()}`;
}

function toListingJson(doc) {
  const d = doc.toObject ? doc.toObject() : doc;
  const ownerId = d.ownerId && typeof d.ownerId === 'object' && d.ownerId._id
    ? d.ownerId._id.toString()
    : d.ownerId?.toString();
  let ownerName;
  let ownerType;
  if (d.ownerId && typeof d.ownerId === 'object') {
    ownerType = d.ownerId.userType === 'business' ? 'business' : 'physical';
    if (d.ownerId.userType === 'business' && d.ownerId.businessName) {
      ownerName = d.ownerId.businessName.trim();
    } else {
      ownerName = [d.ownerId.firstName, d.ownerId.lastName].filter(Boolean).join(' ').trim() || undefined;
    }
  }
  return {
    id: d._id.toString(),
    _id: d._id.toString(),
    title: d.title,
    slug: d.slug,
    description: d.description,
    type: d.type,

    category: d.category,
    categoryId: d.categoryId?.toString(),
    attributes: d.attributes || [],

    price: d.price,
    currency: d.currency,
    priceType: d.priceType,
    rentPeriod: d.rentPeriod,

    images: d.images || [],
    thumbnail: d.thumbnail,

    specifications: d.specifications || {},
    location: d.location,

    ownerId: ownerId || undefined,
    ownerName: ownerName || undefined,
    ownerType: ownerType || undefined,
    status: d.status,

    isFeatured: d.isFeatured,
    featuredUntil: d.featuredUntil,
    isHighlighted: d.isHighlighted,
    highlightUntil: d.highlightUntil,
    isHomepageTop: d.isHomepageTop,
    homepageUntil: d.homepageUntil,

    views: d.views,
    saves: d.saves,

    seoTitle: d.seoTitle,
    seoDescription: d.seoDescription,

    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

/**
 * GET /products
 * List products (listings). Query: ?status=active&type=sell&categorySlug=...&limit=20&skip=0
 */
router.get('/', async (req, res) => {
  try {
    const { status, type, categorySlug, limit = 50, skip = 0 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (type) filter.type = type;
    if (categorySlug) {
      const slug = typeof categorySlug === 'string' ? categorySlug.trim().toLowerCase() : '';
      if (slug) filter['category.slug'] = slug;
    }

    const list = await Listing.find(filter)
      .populate('ownerId', 'firstName lastName businessName userType')
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Math.min(Number(limit), 100))
      .lean();

    res.json(list.map((d) => toListingJson({ ...d })));
  } catch (err) {
    console.error('Products list error:', err);
    res.status(500).json({ error: 'Failed to list products' });
  }
});

/**
 * GET /products/slug/:slug
 * Get one product (listing) by URL slug (active only). Optionally filter by ?type=sell|rent.
 * Finds by slug + status first; if type is provided and no match, tries without type so
 * the same slug can be resolved and the frontend can redirect to the correct section.
 * Must be before /:id so "slug" is not treated as id.
 */
router.get('/slug/:slug', async (req, res) => {
  try {
    const rawSlug = req.params.slug;
    const slug = typeof rawSlug === 'string' ? rawSlug.trim().toLowerCase() : '';
    if (!slug) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const { type } = req.query;
    let filter = { slug, status: 'active' };
    if (type === 'sell' || type === 'rent') filter.type = type;
    let listing = await Listing.findOne(filter).populate('ownerId', 'firstName lastName businessName userType').lean();
    if (!listing && (type === 'sell' || type === 'rent')) {
      listing = await Listing.findOne({ slug, status: 'active' }).populate('ownerId', 'firstName lastName businessName userType').lean();
    }
    if (!listing) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(toListingJson(listing));
  } catch (err) {
    console.error('Product get by slug error:', err);
    res.status(500).json({ error: 'Failed to get product' });
  }
});

/**
 * GET /products/:id
 * Get one product by id
 */
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const ownerId = req.user._id || new mongoose.Types.ObjectId(req.user.id);
    const list = await Listing.find({ ownerId })
      .populate('ownerId', 'firstName lastName businessName userType')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    res.json(list.map((d) => toListingJson({ ...d })));
  } catch (err) {
    console.error('My products list error:', err);
    res.status(500).json({ error: 'Failed to list your products' });
  }
});

/**
 * GET /products/:id
 * Get one product by id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const listing = await Listing.findById(id).populate('ownerId', 'firstName lastName businessName userType').lean();
    if (!listing) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(toListingJson(listing));
  } catch (err) {
    console.error('Product get error:', err);
    res.status(500).json({ error: 'Failed to get product' });
  }
});

/**
 * POST /products
 * Create a product (listing). Body: ListingCreatePayload. ownerId set from auth.
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const body = req.body;
    const ownerId = req.user._id || new mongoose.Types.ObjectId(req.user.id);
    if (!ownerId) {
      return res.status(401).json({ error: 'Owner is required' });
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Slug from title when not provided; must match schema: [a-z0-9]+(?:-[a-z0-9]+)*
    const slug =
      typeof body.slug === 'string' && body.slug.trim()
        ? body.slug
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') || slugFromTitle(title)
        : slugFromTitle(title);

    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return res.status(400).json({ error: 'Slug must be URL-friendly (lowercase, hyphens only)' });
    }

    const existingSlug = await Listing.findOne({ slug }).lean();
    if (existingSlug) {
      return res.status(409).json({ error: 'A listing with this slug already exists' });
    }

    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const type = body.type === 'rent' ? 'rent' : 'sell';
    const category = body.category && typeof body.category === 'object' ? body.category : null;
    if (!category || !category.name || !category.slug) {
      return res.status(400).json({ error: 'Category with name and slug is required' });
    }

    let categoryId = body.categoryId ? new mongoose.Types.ObjectId(body.categoryId) : null;
    if (categoryId) {
      const cat = await Category.findById(categoryId).lean();
      if (!cat) {
        return res.status(400).json({ error: 'Category not found' });
      }
    }

    const price = Number(body.price);
    const priceType = body.priceType === 'negotiable' ? 'negotiable' : 'fixed';
    if (priceType === 'fixed' && (Number.isNaN(price) || price < 0)) {
      return res.status(400).json({ error: 'Valid price is required' });
    }
    const priceValue = priceType === 'negotiable' ? (Number.isNaN(price) || price < 0 ? 0 : price) : price;
    const currency = body.currency === 'USD' ? 'USD' : 'GEL';
    const rentPeriod = type === 'rent' ? (body.rentPeriod || null) : undefined;
    if (type === 'rent' && !rentPeriod) {
      return res.status(400).json({ error: 'Rent period is required for rent listings' });
    }

    const location = body.location && typeof body.location === 'object' ? body.location : null;
    if (!location || !location.region || !location.city) {
      return res.status(400).json({ error: 'Location with region and city is required' });
    }

    const attributes = Array.isArray(body.attributes)
      ? body.attributes
          .filter((a) => a && a.filterId && a.value !== undefined && a.value !== null)
          .map((a) => ({
            filterId: new mongoose.Types.ObjectId(a.filterId),
            value: a.value,
          }))
      : [];

    const images = Array.isArray(body.images) ? body.images.filter((u) => typeof u === 'string' && u.trim()) : [];
    const thumbnail = typeof body.thumbnail === 'string' && body.thumbnail.trim() ? body.thumbnail.trim() : images[0] || '';

    const specifications = body.specifications && typeof body.specifications === 'object' ? body.specifications : {};
    const status = body.status || 'active';
    const seoTitle = typeof body.seoTitle === 'string' ? body.seoTitle.trim() : undefined;
    const seoDescription = typeof body.seoDescription === 'string' ? body.seoDescription.trim() : undefined;

    const listing = await Listing.create({
      title,
      slug,
      description,
      type,
      category: { name: category.name, slug: category.slug },
      categoryId: categoryId || undefined,
      attributes,
      price: priceValue,
      currency,
      priceType,
      rentPeriod: type === 'rent' ? rentPeriod : undefined,
      images,
      thumbnail: thumbnail || undefined,
      specifications,
      location: { region: location.region.trim(), city: location.city.trim() },
      ownerId,
      status,
      seoTitle: seoTitle || undefined,
      seoDescription: seoDescription || undefined,
    });

    res.status(201).json(toListingJson(listing));
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors)
        .map((e) => e.message)
        .join(' ');
      return res.status(400).json({ error: msg });
    }
    if (err.code === 11000) {
      return res.status(409).json({ error: 'A listing with this slug already exists' });
    }
    console.error('Product create error:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

/**
 * PUT /products/:id
 * Update a product. Body: partial ListingCreatePayload.
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const listing = await Listing.findById(id);
    if (!listing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (body.title !== undefined) {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title) return res.status(400).json({ error: 'Title cannot be empty' });
      listing.title = title;
    }

    if (body.slug !== undefined) {
      const slug =
        (typeof body.slug === 'string' && body.slug.trim()) ||
        listing.title
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
      if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return res.status(400).json({ error: 'Slug must be URL-friendly (lowercase, hyphens only)' });
      }
      const existing = await Listing.findOne({ slug, _id: { $ne: id } }).lean();
      if (existing) return res.status(409).json({ error: 'A listing with this slug already exists' });
      listing.slug = slug;
    }

    if (body.description !== undefined) {
      const description = typeof body.description === 'string' ? body.description.trim() : '';
      if (!description) return res.status(400).json({ error: 'Description cannot be empty' });
      listing.description = description;
    }

    if (body.type !== undefined) {
      listing.type = body.type === 'rent' ? 'rent' : 'sell';
      if (listing.type === 'sell') listing.rentPeriod = undefined;
      else if (body.rentPeriod) listing.rentPeriod = body.rentPeriod;
    }
    if (body.rentPeriod !== undefined && listing.type === 'rent') {
      listing.rentPeriod = body.rentPeriod;
    }

    if (body.category !== undefined && body.category?.name && body.category?.slug) {
      listing.category = { name: body.category.name, slug: body.category.slug };
    }
    if (body.categoryId !== undefined) {
      listing.categoryId = body.categoryId ? new mongoose.Types.ObjectId(body.categoryId) : undefined;
    }

    if (body.attributes !== undefined) {
      listing.attributes = Array.isArray(body.attributes)
        ? body.attributes
            .filter((a) => a && a.filterId && a.value !== undefined && a.value !== null)
            .map((a) => ({
              filterId: new mongoose.Types.ObjectId(a.filterId),
              value: a.value,
            }))
        : [];
    }

    if (body.price !== undefined) {
      const price = Number(body.price);
      if (!Number.isNaN(price) && price >= 0) listing.price = price;
    }
    if (body.currency !== undefined) listing.currency = body.currency === 'USD' ? 'USD' : 'GEL';
    if (body.priceType !== undefined) listing.priceType = body.priceType === 'negotiable' ? 'negotiable' : 'fixed';

    if (body.location !== undefined && body.location?.region && body.location?.city) {
      listing.location = { region: body.location.region.trim(), city: body.location.city.trim() };
    }

    if (body.images !== undefined) {
      listing.images = Array.isArray(body.images) ? body.images.filter((u) => typeof u === 'string' && u.trim()) : listing.images;
    }
    if (body.thumbnail !== undefined) {
      listing.thumbnail = typeof body.thumbnail === 'string' && body.thumbnail.trim() ? body.thumbnail.trim() : listing.images?.[0];
    }

    if (body.specifications !== undefined && typeof body.specifications === 'object') {
      listing.specifications = body.specifications;
    }
    if (body.status !== undefined) listing.status = body.status;
    if (body.seoTitle !== undefined) listing.seoTitle = typeof body.seoTitle === 'string' ? body.seoTitle.trim() : undefined;
    if (body.seoDescription !== undefined) listing.seoDescription = typeof body.seoDescription === 'string' ? body.seoDescription.trim() : undefined;

    await listing.save();

    res.json(toListingJson(listing));
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors)
        .map((e) => e.message)
        .join(' ');
      return res.status(400).json({ error: msg });
    }
    if (err.code === 11000) {
      return res.status(409).json({ error: 'A listing with this slug already exists' });
    }
    console.error('Product update error:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

/**
 * DELETE /products/:id
 * Delete a product
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const listing = await Listing.findById(id);
    if (!listing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await Listing.deleteOne({ _id: id });

    res.status(204).send();
  } catch (err) {
    console.error('Product delete error:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export default router;
