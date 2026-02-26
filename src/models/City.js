import mongoose from 'mongoose';

const citySchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: [true, 'City slug is required'],
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be URL-friendly (lowercase, hyphens only)'],
    },
    label: {
      type: String,
      required: [true, 'City label is required'],
      trim: true,
      maxlength: [100, 'Label cannot exceed 100 characters'],
    },
    regionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Region',
      required: [true, 'Region is required'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: false, versionKey: false },
    toObject: { virtuals: false, versionKey: false },
  }
);

citySchema.index({ regionId: 1 });
citySchema.index({ regionId: 1, slug: 1 }, { unique: true });

export const City = mongoose.model('City', citySchema);
