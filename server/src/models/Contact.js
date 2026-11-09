import mongoose from 'mongoose';

const ContactSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      index: true,
    },
    ownerId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['online', 'away', 'offline'],
      default: 'offline',
    },
    lastMessage: {
      type: String,
      default: '',
    },
    lastMessageTime: {
      type: Date,
      default: Date.now,
    },
    bio: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

ContactSchema.index({ ownerId: 1, username: 1 });

const PersonalGroupSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      default: 'personal-group',
    },
    membersCount: {
      type: Number,
      default: 1,
    },
    lastMessage: {
      type: String,
      default: '',
    },
    lastMessageTime: {
      type: Date,
      default: Date.now,
    },
    description: {
      type: String,
      default: '',
    },
    parentGroupId: {
      type: String,
      default: null,
      index: true,
    },
    creatorId: {
      type: String,
      default: null,
      index: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    members: [
      {
        id: { type: String, default: '' },
        username: { type: String, default: '' },
        name: { type: String, default: '' },
        avatar: { type: String, default: null },
        role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const Contact = mongoose.model('Contact', ContactSchema);
export const PersonalGroup = mongoose.model('PersonalGroup', PersonalGroupSchema);
