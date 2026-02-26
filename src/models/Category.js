import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be URL-friendly (lowercase, hyphens only)'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    active: {
      type: Boolean,
      default: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    level: {
      type: Number,
      default: 0,
      min: 0,
    },
    path: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Category',
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: false, versionKey: false },
    toObject: { virtuals: false, versionKey: false },
  }
);

categorySchema.index({ slug: 1 });
categorySchema.index({ parentId: 1, slug: 1 }, { unique: true });
categorySchema.index({ parentId: 1 });
categorySchema.index({ active: 1 });
categorySchema.index({ path: 1 });
categorySchema.index({ level: 1 });

categorySchema.pre('save', async function (next) {
  if (!this.parentId) {
    this.level = 0;
    this.path = [];
    return next();
  }
  const parent = await mongoose.model('Category').findById(this.parentId).lean();
  if (!parent) {
    return next(new Error('Parent category not found'));
  }
  this.path = [...(parent.path || []), parent._id];
  this.level = (parent.level ?? 0) + 1;
  next();
});

export const Category = mongoose.model('Category', categorySchema);
