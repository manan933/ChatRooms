import mongoose from 'mongoose';

const PolicySchema = new mongoose.Schema(
  {
    emoji: { type: Boolean, default: true },
    reactions: { type: Boolean, default: true },
    editMessage: { type: Boolean, default: true },
    deleteMessage: { type: Boolean, default: true },
    title: { type: String, default: 'Standard Collaboration Policy' },
  },
  { _id: false }
);

const WorkspaceMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member'],
      default: 'member',
    },
    contextualUsername: {
      type: String,
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const WorkspaceSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Workspace name is required'],
      trim: true,
    },
    joinCode: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
      default: '',
    },
    parentWorkspaceId: {
      type: String,
      default: null,
      index: true,
    },
    rootNodeId: {
      type: String,
      required: true,
    },
    defaultNodeId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      default: 'organization',
    },
    memberCount: {
      type: Number,
      default: 1,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    creatorName: {
      type: String,
      default: 'Workspace Admin',
    },
    contextualUsername: {
      type: String,
      default: '',
    },
    policy: {
      type: PolicySchema,
      default: () => ({}),
    },
    members: [WorkspaceMemberSchema],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Workspace', WorkspaceSchema);
