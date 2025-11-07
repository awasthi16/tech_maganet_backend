const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    task_id: { type: String, required: true, unique: true },
    keyword: { type: String, required: true },
    language: { type: String, required: true },
    location: { type: String, required: true },
    priority: { type: Number, default: 1 },
    status: { type: String, default: "pending" },
    result: { type: Object, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
