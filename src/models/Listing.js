import mongoose from 'mongoose';

const rentPeriodEnum = ['hour', 'day', 'week', 'month'];
const typeEnum = ['sell', 'rent'];
const currencyEnum = ['GEL', 'USD'];
const priceTypeEnum = ['fixed', 'negotiable'];
const conditionEnum = ['new', 'used'];
const statusEnum = ['active', 'sold', 'rented', 'expired'];

const listingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be URL-friendly (lowercase, hyphens only)'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    type: {
      type: String,
      required: [true, 'Listing type is required'],
      enum: { values: typeEnum, message: `Type must be one of: ${typeEnum.join(', ')}` },
    },

    category: {
      name: {
        type: String,
        required: [true, 'Category name is required'],
        trim: true,
      },
      slug: {
        type: String,
        required: [true, 'Category slug is required'],
        trim: true,
        lowercase: true,
      },
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      index: true,
    },

    attributes: {
      type: [
        {
          filterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Filter', required: true },
          value: { type: mongoose.Schema.Types.Mixed, required: true },
        },
      ],
      default: [],
    },

    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    currency: {
      type: String,
      required: [true, 'Currency is required'],
      enum: { values: currencyEnum, message: `Currency must be one of: ${currencyEnum.join(', ')}` },
      default: 'GEL',
    },
    priceType: {
      type: String,
      enum: { values: priceTypeEnum, message: `Price type must be one of: ${priceTypeEnum.join(', ')}` },
      default: 'fixed',
    },
    rentPeriod: {
      type: String,
      enum: { values: rentPeriodEnum, message: `Rent period must be one of: ${rentPeriodEnum.join(', ')}` },
      required: function () {
        return this.type === 'rent';
      },
    },

    images: {
      type: [String],
      default: [],
      validate: {
        validator: (v) => Array.isArray(v) && v.every((url) => typeof url === 'string' && url.length > 0),
        message: 'Images must be an array of non-empty strings',
      },
    },
    thumbnail: {
      type: String,
      default: function () {
        return this.images && this.images[0] ? this.images[0] : undefined;
      },
    },

    specifications: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      // Flexible for: condition, brand, model, year, capacity, power, etc.
      // ElasticSearch-friendly: flat key-value structure
    },

    location: {
      region: {
        type: String,
        required: [true, 'Region is required'],
        trim: true,
      },
      city: {
        type: String,
        required: [true, 'City is required'],
        trim: true,
      },
    },

    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner is required'],
      index: true,
    },

    status: {
      type: String,
      enum: { values: statusEnum, message: `Status must be one of: ${statusEnum.join(', ')}` },
      default: 'active',
    },

    isFeatured: { type: Boolean, default: false },
    featuredUntil: { type: Date, default: null },
    isHighlighted: { type: Boolean, default: false },
    highlightUntil: { type: Date, default: null },
    isHomepageTop: { type: Boolean, default: false },
    homepageUntil: { type: Date, default: null },

    views: { type: Number, default: 0 },
    saves: { type: Number, default: 0 },

    seoTitle: { type: String, trim: true, maxlength: 70 },
    seoDescription: { type: String, trim: true, maxlength: 160 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: false, versionKey: false },
    toObject: { virtuals: false, versionKey: false },
  }
);

// Indexes for filtering, search, and ElasticSearch sync
listingSchema.index({ slug: 1 }, { unique: true });
listingSchema.index({ type: 1 });
listingSchema.index({ 'category.slug': 1 });
listingSchema.index({ 'location.region': 1 });
listingSchema.index({ isFeatured: 1, featuredUntil: 1 });
listingSchema.index({ createdAt: -1 });
listingSchema.index({ status: 1, type: 1 });
listingSchema.index({ ownerId: 1, status: 1 });

// Compound index for common listing list query: active + type + category + sort
listingSchema.index({ status: 1, type: 1, 'category.slug': 1, createdAt: -1 });

listingSchema.index({ categoryId: 1 });
listingSchema.index({ categoryId: 1, 'attributes.filterId': 1, 'attributes.value': 1 });

// Ensure rentPeriod is cleared when type is 'sell'; ensure set when type is 'rent'
listingSchema.pre('save', function (next) {
  if (this.type === 'sell') {
    this.rentPeriod = undefined;
  }
  if (this.type === 'rent' && !this.rentPeriod) {
    next(new Error('Rent period is required when listing type is rent'));
    return;
  }
  if (!this.thumbnail && this.images && this.images.length > 0) {
    this.thumbnail = this.images[0];
  }
  next();
});

export const Listing = mongoose.model('Listing', listingSchema);
