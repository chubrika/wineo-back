import mongoose from 'mongoose';

const filterTypeEnum = ['select', 'range', 'checkbox', 'number', 'text'];

const filterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Filter name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Filter slug is required'],
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be URL-friendly (lowercase, hyphens only)'],
    },
    type: {
      type: String,
      required: [true, 'Filter type is required'],
      enum: { values: filterTypeEnum, message: `Type must be one of: ${filterTypeEnum.join(', ')}` },
    },
    options: {
      type: [String],
      default: undefined,
      validate: {
        validator(v) {
          if (this.type !== 'select') return true;
          return Array.isArray(v) && v.length > 0 && v.every((o) => typeof o === 'string' && o.length > 0);
        },
        message: 'Select filters must have at least one option',
      },
    },
    unit: {
      type: String,
      trim: true,
      maxlength: [20, 'Unit cannot exceed 20 characters'],
      default: '',
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
      // index omitted: compound indexes below use categoryId as leftmost prefix
    },
    applyToChildren: {
      type: Boolean,
      default: false,
    },
    isRequired: {
      type: Boolean,
      default: false,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: false, versionKey: false },
    toObject: { virtuals: false, versionKey: false },
  }
);

filterSchema.index({ categoryId: 1, sortOrder: 1 });
filterSchema.index({ categoryId: 1, isActive: 1 });
filterSchema.index({ categoryId: 1, applyToChildren: 1 });
filterSchema.index({ slug: 1, categoryId: 1 }, { unique: true });

export const Filter = mongoose.model('Filter', filterSchema);
