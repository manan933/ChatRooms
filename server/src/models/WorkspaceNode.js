import mongoose from 'mongoose';

const WorkspaceNodeSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    workspaceId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Group or channel name is required'],
      trim: true,
    },
    parentId: {
      type: String,
      default: null,
      index: true,
    },
    folder: {
      type: String,
      default: null,
    },
    isAnnouncement: {
      type: Boolean,
      default: false,
    },
    children: {
      type: [String],
      default: [],
    },
    memberCount: {
      type: Number,
      default: 1,
    },
    hasConversation: {
      type: Boolean,
      default: true,
    },
    joinCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    members: {
      type: [
        {
          id: { type: String, required: true },
          name: { type: String, required: true },
          username: { type: String, required: true },
          avatar: { type: String, default: null },
          role: {
            type: String,
            enum: ['owner', 'admin', 'moderator', 'member'],
            default: 'member',
          },
          joinedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('WorkspaceNode', WorkspaceNodeSchema);
