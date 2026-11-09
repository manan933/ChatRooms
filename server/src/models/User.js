import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const ContextSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ['personal', 'workplace'], required: true },
    name: { type: String, required: true },
    username: { type: String, required: true },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide your full name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address',
      ],
    },
    primaryUsername: {
      type: String,
      required: [true, 'Primary username is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 6,
      select: false, // Don't return password by default
    },
    avatar: {
      type: String,
      default: null,
    },
    avatarType: {
      type: String,
      default: 'ai',
    },
    bio: {
      type: String,
      default: 'ChatRooms user · Exploring contextual communication',
    },
    contexts: {
      type: [ContextSchema],
      default: [
        {
          id: 'ctx-personal',
          type: 'personal',
          name: 'Personal',
          username: 'user.personal',
        },
      ],
    },
    status: {
      type: String,
      enum: ['online', 'away', 'offline'],
      default: 'online',
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Encrypt password before save
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare entered password with hashed password
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('User', UserSchema);
