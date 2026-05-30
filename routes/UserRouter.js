const express = require("express");
const User = require("../db/userModel");
const Photo = require("../db/photoModel");
const router = express.Router();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config");

// POST / — đăng ký user mới (không cần đăng nhập)
router.post("/", async (request, response) => {
  const { login_name, password, first_name, last_name, location, description, occupation } = request.body;

  if (!login_name?.trim()) return response.status(400).json({ message: "login_name khong duoc de trong" });
  if (!password?.trim()) return response.status(400).json({ message: "Password khong duoc de trong" });
  if (!first_name?.trim()) return response.status(400).json({ message: "First name khong duoc de trong" });
  if (!last_name?.trim()) return response.status(400).json({ message: "Last name khong duoc de trong" });

  try {
    const existing = await User.findOne({ login_name: login_name.trim() });
    if (existing) return response.status(400).json({ message: "Ten dang nhap nay da ton tai" });

    const newUser = await User.create({
      login_name: login_name.trim(),
      password,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      location: location || "",
      description: description || "",
      occupation: occupation || "",
    });

    response.status(200).json({
      _id: newUser._id,
      login_name: newUser.login_name,
      first_name: newUser.first_name,
      last_name: newUser.last_name,
    });
  } catch (error) {
    console.error("Loi khi dang ky:", error);
    response.status(500).json({ message: "Loi server" });
  }
});

// GET /list — danh sách tất cả user (không cần đăng nhập)
router.get("/list", async (_req, response) => {
  try {
    const users = await User.find({}).select("_id first_name last_name");
    response.status(200).json(users);
  } catch (error) {
    response.status(500).json({ message: "Loi server" });
  }
});

// GET /photo-counts — số ảnh của từng user (không cần đăng nhập)
// Đặt TRƯỚC /:id để "photo-counts" không bị hiểu là userId
router.get("/photo-counts", async (_req, response) => {
  try {
    const counts = await Photo.aggregate([
      { $group: { _id: "$user_id", count: { $sum: 1 } } }
    ]);
    const result = {};
    counts.forEach((item) => { result[item._id.toString()] = item.count; });
    response.status(200).json(result);
  } catch (error) {
    response.status(500).json({ message: "Loi server" });
  }
});

// GET /search?q=... — tìm user theo tên (không cần đăng nhập)
// Đặt TRƯỚC /:id để "search" không bị hiểu là userId
router.get("/search", async (request, response) => {
  const { q } = request.query;
  if (!q?.trim()) return response.status(400).json({ message: "Vui long nhap tu khoa" });

  try {
    const users = await User.find({
      $or: [
        { first_name: { $regex: q.trim(), $options: "i" } },
        { last_name:  { $regex: q.trim(), $options: "i" } },
      ],
    }).select("_id first_name last_name occupation");
    response.status(200).json(users);
  } catch (error) {
    response.status(500).json({ message: "Loi server" });
  }
});

// GET /:id — chi tiết 1 user (không cần đăng nhập)
router.get("/:id", async (request, response) => {
  const { id } = request.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return response.status(400).json({ message: "ID nguoi dung khong hop le" });
  }
  try {
    const user = await User.findById(id).select("_id first_name last_name location description occupation");
    if (!user) return response.status(404).json({ message: "Khong tim thay nguoi nay" });
    response.status(200).json(user);
  } catch (error) {
    response.status(500).json({ message: "Loi server" });
  }
});

// PUT /:id — cập nhật hồ sơ (chỉ người dùng của chính mình)
router.put("/:id", async (request, response) => {
  const { id } = request.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return response.status(400).json({ message: "ID nguoi dung khong hop le" });
  }

  // Xác thực token để biết ai đang gọi
  const token = request.headers["authorization"]?.split(" ")[1];
  if (!token) return response.status(401).json({ message: "Ban chua dang nhap" });

  let currentUserId;
  try {
    currentUserId = jwt.verify(token, JWT_SECRET).user_id;
  } catch {
    return response.status(401).json({ message: "Token khong hop le" });
  }

  if (id !== currentUserId.toString()) {
    return response.status(403).json({ message: "Ban khong co quyen sua ho so nay" });
  }

  const { first_name, last_name, location, description, occupation } = request.body;
  if (!first_name?.trim()) return response.status(400).json({ message: "First name khong duoc de trong" });
  if (!last_name?.trim()) return response.status(400).json({ message: "Last name khong duoc de trong" });

  try {
    const updated = await User.findByIdAndUpdate(
      id,
      { first_name: first_name.trim(), last_name: last_name.trim(), location, description, occupation },
      { new: true }
    ).select("_id first_name last_name location description occupation login_name");

    if (!updated) return response.status(404).json({ message: "Khong tim thay nguoi dung" });
    response.status(200).json(updated);
  } catch (error) {
    response.status(500).json({ message: "Loi server" });
  }
});

module.exports = router;
