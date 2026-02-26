/**
 * One-time script to backfill path and level on existing categories.
 * Run after deploying the Category schema changes: node src/scripts/backfill-category-path.js
 * Requires MONGODB_URI in env.
 */
import mongoose from 'mongoose';
import { config } from '../config.js';
import { Category } from '../models/Category.js';

async function backfill() {
  await mongoose.connect(config.mongodbUri);
  const categories = await Category.find({}).lean();
  const byId = new Map(categories.map((c) => [c._id.toString(), { ...c }]));

  function getPathAndLevel(id) {
    const c = byId.get(id.toString());
    if (!c) return null;
    const path = [];
    let cur = c;
    while (cur && cur.parentId) {
      path.unshift(cur.parentId);
      cur = byId.get(cur.parentId.toString());
    }
    return { path, level: path.length };
  }

  let updated = 0;
  for (const c of categories) {
    const result = getPathAndLevel(c._id);
    if (result === null) {
      console.warn(`Skipping category ${c._id}: parent missing or cycle`);
      continue;
    }
    const { path, level } = result;
    if (c.path && c.path.length === path.length && c.level === level) continue;
    await Category.updateOne(
      { _id: c._id },
      { $set: { path, level } }
    );
    updated++;
  }
  console.log(`Updated path/level for ${updated} categories`);
  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});
