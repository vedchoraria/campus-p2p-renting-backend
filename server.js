const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cors = require("cors");
require("dotenv").config();

const app = express();

/* ================== GLOBAL SERVER SETUP ================== */
app.use(cors({
  origin: "*",               // allow all origins (global access)
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "10mb" }));
app.set("trust proxy", 1);

/* ================== ENV CHECK ================== */
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI missing in .env");
  process.exit(1);
}

/* ================== DATABASE ================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
    console.error("❌ MongoDB Error:", err);
    process.exit(1);
  });

/* ================== USER MODEL ================== */
const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    required: true
  },
  password: {
    type: String,
    required: true
  }
});

const User = mongoose.model("User", UserSchema);

/* ================== REGISTER ================== */
app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 8);

    await new User({
      email,
      password: hashedPassword
    }).save();

    res.status(201).json({ msg: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

/* ================== LOGIN ================== */
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid email or password" });
    }

    res.json({ msg: "Login successful" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

/* ================== ITEM MODEL ================== */
const ItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  pricePerDay: { type: Number, required: true },
  category: { type: String, required: true },
  imageUrl: String,
  available: { type: Boolean, default: true },
  ownerEmail: { type: String, required: true },
  rentedFrom: Date,
  rentedTill: Date,
  createdAt: { type: Date, default: Date.now }
});

const Item = mongoose.model("Item", ItemSchema);

/* ================== ADD ITEM ================== */
app.post("/items", async (req, res) => {
  try {
    const { title, description, pricePerDay, category, imageUrl, ownerEmail } = req.body;

    if (!title || !pricePerDay || !category || !ownerEmail) {
      return res.status(400).json({ msg: "Missing required fields" });
    }

    const item = await new Item({
      title,
      description,
      pricePerDay,
      category,
      imageUrl,
      ownerEmail
    }).save();

    res.status(201).json({ msg: "Item added successfully", itemId: item._id });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

/* ================== GET ITEMS ================== */
app.get("/items", async (req, res) => {
  try {
    const { category, minPrice, maxPrice, available, ownerEmail } = req.query;
    let filter = {};

    if (category) filter.category = category;
    if (available !== undefined) filter.available = available === "true";
    if (ownerEmail) filter.ownerEmail = ownerEmail;

    if (minPrice || maxPrice) {
      filter.pricePerDay = {};
      if (minPrice) filter.pricePerDay.$gte = Number(minPrice);
      if (maxPrice) filter.pricePerDay.$lte = Number(maxPrice);
    }

    res.json(await Item.find(filter));
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

/* ================== SEARCH ================== */
app.get("/items/search", async (req, res) => {
  try {
    const { q } = req.query;
    res.json(await Item.find({ title: { $regex: q, $options: "i" } }));
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

/* ================== BOOK ================== */
app.post("/items/:id/book", async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ msg: "Item not found" });
    if (!item.available) return res.status(400).json({ msg: "Item already rented" });

    item.available = false;
    item.rentedFrom = new Date(req.body.startDate);
    item.rentedTill = new Date(req.body.endDate);

    await item.save();
    res.json({ msg: "Item booked successfully" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

/* ================== RETURN ================== */
app.post("/items/:id/return", async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ msg: "Item not found" });

    item.available = true;
    item.rentedFrom = null;
    item.rentedTill = null;

    await item.save();
    res.json({ msg: "Item returned successfully" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

/* ================== SERVER ================== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🌍 Server running globally on port ${PORT}`)
);
