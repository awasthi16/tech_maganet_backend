// const mongoose = require("mongoose");

// const taskSchema = new mongoose.Schema(
//   {
//     task_id: { type: String, required: true, unique: true },
//     keyword: { type: String, required: true },
//     language: { type: String, required: true },
//     location: { type: String, required: true },
//     priority: { type: Number, default: 1 },
//     status: { type: String, default: "pending" },
//     result: { type: Object, default: null },
//   },
//   { timestamps: true }
// );

// module.exports = mongoose.model("Task", taskSchema);


// const mongoose = require("mongoose");

// const taskSchema = new mongoose.Schema(
//   {
//     task_id: { type: String, required: true, unique: true },

//     // Core task input
//     keyword: { type: String, required: true },

//     // Language
//     language_name: { type: String }, // e.g., "English"
//     language_code: { type: String, required: true }, // e.g., "en"

//     // Location
//     location_name: { type: String }, // e.g., "United States"
//     location_code: { type: Number, required: true }, // e.g., 2840

//     // Other info
//     priority: { type: Number, default: 1 },
//     status: { type: String, default: "pending" },
//     result: { type: Object, default: null },

//     // Optional: for tracking DataForSEO response
//     raw_response: { type: Object, default: null },
//   },
//   { timestamps: true }
// );

// module.exports = mongoose.model("Task", taskSchema);







// ---------------------------------------------HYBRID SCHEMA-------------------------------
const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    task_id: { type: String, required: true, unique: true },

    // ✅ Keyword
    keyword: { type: String, required: true },

    // ✅ Language (support both formats)
    language: { type: String }, // old data — "en" or "English"
    language_name: { type: String }, // new data — "English"
    language_code: { type: String }, // new data — "en"

    // ✅ Location (support both formats)
    location: { type: String }, // old data — "India"
    location_name: { type: String }, // new data — "India"
    location_code: { type: Number }, // new data — 2840

    // ✅ Other fields
    priority: { type: Number, default: 1 },
    status: { type: String, default: "pending" },
    result: { type: Object, default: null },
    raw_response: { type: Object, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
