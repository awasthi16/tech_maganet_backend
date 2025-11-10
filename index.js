

const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const Task = require("./models/Task");

dotenv.config();

const app = express();

// Middleware
app.use(express.json({ limit: "2mb" }));
app.use(cors());
app.use(morgan("dev"));

// ENV vars
const {
  PORT = 5000,
  MONGO_URI,
  DATAFORSEO_LOGIN,
  DATAFORSEO_PASSWORD,
} = process.env;

// ------------------------------------
//  MongoDB Connection
// ------------------------------------
mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
  })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error(" MongoDB Error:", err.message));

const authConfig = {
  auth: {
    username: DATAFORSEO_LOGIN,
    password: DATAFORSEO_PASSWORD,
  },
};

// ------------------------------------
//  Rate Limiter
// ------------------------------------
const apiLimiter = rateLimit({
  windowMs: 10 * 1000, 
  max: 5, // 
  message: { message: "Too many requests. Please wait 10 seconds." },
});

// ------------------------------------
// Health Route
// ------------------------------------
app.get("/", (req, res) => res.send("DataForSEO Backend Running!"));

// ------------------------------------
//  Get Languages
// ------------------------------------
app.get("/api/languages", async (req, res) => {
  try {
    const { data } = await axios.get(
      "https://api.dataforseo.com/v3/serp/google/languages",
      authConfig
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch languages." });
  }
});

// ------------------------------------
//  Get Locations
// ------------------------------------
app.get("/api/locations", async (req, res) => {
  try {
    const { data } = await axios.get(
      "https://api.dataforseo.com/v3/serp/google/locations",
      authConfig
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch locations." });
  }
});

// ------------------------------------
//  Create Task (POST)
// ------------------------------------
app.post("/api/tasks", async (req, res) => {
  try {
    const {
      keyword,
      language_name,
      language_code,
      location_name,
      location_code,
      priority = 1,
    } = req.body;

    // Validate Required Fields
    if (!keyword || !language_code || !location_code) {
      return res.status(400).json({
        message:
          "Missing required fields: keyword, language_code, and location_code are required.",
      });
    }

    //  Ensure location_code is number
    const locCode = Number(location_code);
    if (isNaN(locCode)) {
      return res.status(400).json({ message: "Invalid location_code format." });
    }

    //  DataForSEO expects array of tasks
    const payload = [
      {
        keyword: keyword.trim(),
        language_code: language_code.trim(),
        location_code: locCode,
        priority: Number(priority),
      },
    ];

    const { data } = await axios.post(
      "https://api.dataforseo.com/v3/serp/google/organic/task_post",
      payload,
      authConfig
    );

    const apiTask = data?.tasks?.[0];
    if (!apiTask?.id) {
      return res
        .status(500)
        .json({ message: "Invalid response from DataForSEO API." });
    }

    //  Store task in DB
    const newTask = await Task.create({
      task_id: apiTask.id,
      keyword,
      language_name,
      language_code,
      location_name,
      location_code: locCode,
      priority,
      status: apiTask.status_message || "created",
      raw_response: data,
    });

    res.status(201).json(newTask);
  } catch (error) {
    console.error("Task Creation Error:", error.response?.data || error.message);
    res.status(500).json({
      message: error.response?.data?.status_message || "Task creation failed.",
    });
  }
});

// ------------------------------------
//  Get Task by ID
// ------------------------------------
app.get("/api/tasks/:task_id", async (req, res) => {
  try {
    const task = await Task.findOne({ task_id: req.params.task_id });
    if (!task) return res.status(404).json({ message: "Task not found." });

    const { data } = await axios.get(
      `https://api.dataforseo.com/v3/serp/google/organic/task_get/advanced/${task.task_id}`,
      authConfig
    );

    const apiTask = data?.tasks?.[0];
    if (apiTask?.result) {
      task.result = apiTask.result;
      task.status = "completed";
      task.raw_response = data;
      await task.save();
    }

    res.json(task);
  } catch (error) {
    console.error("Fetch Task Error:", error.message);
    res.status(500).json({
      message: error.response?.data?.status_message || "Failed to fetch task.",
    });
  }
});

// ------------------------------------
//  Get All Tasks (Paginated)
// ------------------------------------
app.get("/api/tasks", apiLimiter, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const total = await Task.countDocuments();
    const tasks = await Task.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      page,
      totalPages: Math.ceil(total / limit),
      results: tasks,
    });
  } catch (error) {
    console.error("Error fetching tasks:", error.message);
    res.status(500).json({ message: "Failed to fetch tasks." });
  }
});

// ------------------------------------
//  Postback Handler
// ------------------------------------
app.post("/api/postback", async (req, res) => {
  try {
    const task_id = req.body?.tasks?.[0]?.id;
    const result = req.body?.tasks?.[0]?.result;

    if (!task_id) return res.status(400).send("Missing task_id.");

    const task = await Task.findOne({ task_id });
    if (task) {
      task.status = "completed";
      task.result = result;
      await task.save();
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Postback Error:", error.message);
    res.status(500).send("Postback error.");
  }
});

// ------------------------------------
//  Search Tasks (keyword, lang, location)
// ------------------------------------
app.get("/api/tasks/search/:key", apiLimiter, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 2;
    const skip = (page - 1) * limit;

    const regex = new RegExp(req.params.key, "i");
    const query = {
      $or: [
        { keyword: regex },
        { language_name: regex },
        { language_code: regex },
        { location_name: regex },
        { status: regex },
      ],
    };

    const total = await Task.countDocuments(query);
    const results = await Task.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    if (!results.length)
      return res.status(404).json({ message: "No matching tasks found." });

    res.json({
      page,
      totalPages: Math.ceil(total / limit),
      results,
    });
  } catch (error) {
    console.error("Search Error:", error.message);
    res.status(500).json({ message: "Error while searching tasks." });
  }
});

// ------------------------------------
//  Database Status Route
// ------------------------------------
app.get("/api/db-status", async (req, res) => {
  const state = mongoose.connection.readyState;
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({
    status: states[state],
    message:
      state === 1
        ? " MongoDB is connected successfully!"
        : "MongoDB is not connected.",
  });
});

// ------------------------------------
//  Start Server
// ------------------------------------
app.listen(PORT, () =>
  console.log(` Server running on http://localhost:${PORT}`)
);
