import mongoose from 'mongoose';

const regionSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: [true, 'Region slug is required'],
      trim: true,
      lowercase: true,
      unique: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be URL-friendly (lowercase, hyphens only)'],
    },
    label: {
      type: String,
      required: [true, 'Region label is required'],
      trim: true,
      maxlength: [100, 'Label cannot exceed 100 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: false, versionKey: false },
    toObject: { virtuals: false, versionKey: false },
  }
);

regionSchema.index({ slug: 1 }, { unique: true });

export const Region = mongoose.model('Region', regionSchema);
