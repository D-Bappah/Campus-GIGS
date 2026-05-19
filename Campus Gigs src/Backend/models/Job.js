const mongoose = require("mongoose");

const JobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Job title is required."],
      trim: true,
      minlength: [10, "Title must be at least 10 characters."],
      maxlength: [120, "Title cannot exceed 120 characters."],
    },
    description: {
      type: String,
      required: [true, "Job description is required."],
      trim: true,
      minlength: [30, "Description must be at least 30 characters."],
      maxlength: [5000, "Description cannot exceed 5000 characters."],
    },
    category: {
      type: String,
      required: [true, "Category is required."],
      enum: [
        "Design & Creative",
        "Writing & Content",
        "Programming & Tech",
        "Marketing & Social Media",
        "Video & Animation",
        "Data & Research",
        "Tutoring & Academic",
        "Admin & Virtual Assistant",
        "Other",
      ],
    },
    skills: {
      type: [String],
      default: [],
      set: (arr) => arr.map((s) => s.trim()).filter(Boolean),
    },
    budget: {
      type: Number,
      required: [true, "Budget is required."],
      min: [100, "Budget must be at least ₦1."],
    },
    deliveryDays: {
      type: Number,
      required: [true, "Expected delivery days is required."],
      min: [1, "Delivery must be at least 1 day."],
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "completed", "cancelled"],
      default: "open",
      index: true,
    },
    location: {
      type: String,
      default: "Remote",
      trim: true,
    },
    isUrgent: {
      type: Boolean,
      default: false,
    },
    attachmentUrl: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, 
    toJSON: { virtuals: true }, 
  }
);

JobSchema.index({ status: 1, category: 1, createdAt: -1 });
JobSchema.index(
  { title: "text", description: "text", skills: "text" },
  { weights: { title: 10, skills: 5, description: 1 }, name: "job_text_search" }
);

JobSchema.virtual("budgetInNaira").get(function () {
  return this.budget / 100;
});

module.exports = mongoose.model("Job", JobSchema);