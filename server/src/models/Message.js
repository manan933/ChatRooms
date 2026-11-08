import mongoose from 'mongoose';

const ReactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    count: { type: Number, default: 1 },
    users: { type: [String], default: [] },
  },
  { _id: false }
);

const AttachmentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['image', 'file'], default: 'file' },
    name: { type: String, required: true },
    size: { type: String, default: '' },
    url: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    dataUrl: { type: String, default: '' },
  },
  { _id: false }
);

const MessageSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    chatId: {
      type: String,
      required: true,
      index: true,
    },
    chatType: {
      type: String,
      enum: ['direct', 'personal-group', 'workspace-node'],
      default: 'workspace-node',
    },
    senderId: {
      type: String,
      required: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    senderUsername: {
      type: String,
      default: '',
    },
    senderAvatar: {
      type: String,
      default: null,
    },
    content: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      enum: ['text', 'image', 'file', 'system', 'call'],
      default: 'text',
    },
    callDetails: {
      isVideo: { type: Boolean, default: false },
      duration: { type: Number, default: 0 },
      status: { type: String, enum: ['ended', 'missed', 'declined'], default: 'ended' },
    },
    attachment: {
      type: AttachmentSchema,
      default: null,
    },
    reactions: {
      type: [ReactionSchema],
      default: [],
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readBy: {
      type: [String],
      default: [],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Message', MessageSchema);
