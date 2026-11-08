import mongoose from 'mongoose';

const MediaSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    contentType: {
      type: String,
      required: true,
      default: 'application/octet-stream',
    },
    data: {
      type: Buffer,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    uploadedBy: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Optimize retrieval by id and uploadedBy
MediaSchema.index({ uploadedBy: 1, createdAt: -1 });

export const Media = mongoose.model('Media', MediaSchema);
export default Media;
