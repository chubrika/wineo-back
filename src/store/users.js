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
    role: data.role === 'admin' ? 'admin' : 'customer',
  });
  return { ...user.toObject(), id: user._id.toString() };
}
