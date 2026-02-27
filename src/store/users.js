import { User } from '../models/User.js';

export async function findByEmail(email) {
  return User.findOne({ email: email.toLowerCase().trim() }).lean();
}

export async function findById(id) {
  const user = await User.findById(id).lean();
  if (!user) return null;
  return { ...user, id: user._id.toString() };
}

export async function create(data) {
  const user = await User.create({
    email: data.email.toLowerCase().trim(),
    password: data.password,
    firstName: data.firstName?.trim() || '',
    lastName: data.lastName?.trim() || '',
    businessName: data.businessName?.trim() || '',
    role: data.role === 'admin' ? 'admin' : 'customer',
    phone: data.phone?.trim() || '',
    userType: data.userType === 'business' ? 'business' : 'physical',
  });
  return { ...user.toObject(), id: user._id.toString() };
}

export async function updateById(id, data) {
  const update = {};
  if (data.firstName !== undefined) update.firstName = String(data.firstName).trim();
  if (data.lastName !== undefined) update.lastName = String(data.lastName).trim();
  if (data.phone !== undefined) update.phone = String(data.phone).trim();
  if (data.businessName !== undefined) update.businessName = String(data.businessName).trim();
  if (data.userType === 'business' || data.userType === 'physical') update.userType = data.userType;
  const user = await User.findByIdAndUpdate(
    id,
    { $set: update },
    { new: true, runValidators: true }
  ).lean();
  if (!user) return null;
  return { ...user, id: user._id.toString() };
}
