const express = require("express");
const User = require("../db/userModel");
const Photo = require("../db/photoModel");
const router = express.Router();
const mongoose = require("mongoose");

// POST /user — đăng ký user mới
// Đặt TRƯỚC GET /:id để "POST /" không bị nhầm với GET /:id
router.post("/", async (request, response) => {
  const { login_name, password, first_name, last_name, location, description, occupation } = request.body;

  // Kiểm tra các field bắt buộc theo đề bài
  if (!login_name || !login_name.trim()) {
    return response.status(400).json({ message: "login_name khong duoc de trong" });
  }
  if (!password || !password.trim()) {
    return response.status(400).json({ message: "Password khong duoc de trong" });
  }
  if (!first_name || !first_name.trim()) {
    return response.status(400).json({ message: "First name khong duoc de trong" });
  }
  if (!last_name || !last_name.trim()) {
    return response.status(400).json({ message: "Last name khong duoc de trong" });
  }

  try {
    // Kiểm tra login_name đã tồn tại chưa
    const existing = await User.findOne({ login_name: login_name.trim() });
    if (existing) {
      return response.status(400).json({ message: "Ten dang nhap nay da ton tai" });
    }

    // Tạo user mới
    const newUser = new User({
      login_name: login_name.trim(),
      password: password,       // đề bài lưu plain text, không yêu cầu hash
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      location: location || "",
      description: description || "",
      occupation: occupation || "",
    });

    await newUser.save();

    // Đề bài yêu cầu response phải có login_name
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

router.get("/list", async (request, response) => {
  try {
    const usersList = await User.find({}).select("_id first_name last_name");
    response.status(200).json(usersList);
  } catch (error) {
    console.error("Loi khi tai danh sach nguoi dung:", error);
    response.status(500).json({ message: "Da xay ra loi he thong phia server" });
  }
});

// GET /user/search?q=... — tìm user theo tên
// Đặt TRƯỚC /:id để "search" không bị hiểu là userId
router.get("/search", async (request, response) => {
  const { q } = request.query;

  if (!q || !q.trim()) {
    return response.status(400).json({ message: "Vui long nhap tu khoa tim kiem" });
  }

  try {
    // Dùng regex để tìm không phân biệt hoa thường
    // Tìm trong cả first_name lẫn last_name
    const keyword = q.trim();
    const users = await User.find({
      $or: [
        { first_name: { $regex: keyword, $options: "i" } },
        { last_name:  { $regex: keyword, $options: "i" } },
      ],
    }).select("_id first_name last_name occupation");

    response.status(200).json(users);
  } catch (error) {
    console.error("Loi khi tim kiem user:", error);
    response.status(500).json({ message: "Loi server" });
  }
});

// GET /user/photo-counts — trả về số ảnh của từng user
// Dùng MongoDB aggregation để đếm trực tiếp trong DB — hiệu quả hơn load hết ảnh về đếm
// Đặt TRƯỚC /:id để "photo-counts" không bị hiểu là userId
router.get("/photo-counts", async (request, response) => {
  try {
    const counts = await Photo.aggregate([
      { $group: { _id: "$user_id", count: { $sum: 1 } } }
    ]);
    const result = {};
    counts.forEach((item) => { result[item._id.toString()] = item.count; });
    response.status(200).json(result);
  } catch (error) {
    console.error("Loi khi dem anh:", error);
    response.status(500).json({ message: "Loi server" });
  }
});

router.get("/:id", async (request, response) => {
  const userId = request.params.id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return response.status(400).json({ message: "ID nguoi dung khong hop le" });
  }

  try {
    const user = await User.findById(userId).select(
      "_id first_name last_name location description occupation"
    );

    if (!user) {
      return response.status(404).json({ message: "Khong tim thay nguoi nay" });
    }

    response.status(200).json(user);
  } catch (error) {
    console.error("Loi khi lay chi tiet nguoi dung:", error);
    response.status(500).json({ message: "Loi server" });
  }
});

// PUT /user/:id — cập nhật hồ sơ cá nhân
// Chỉ cho phép user sửa hồ sơ của chính mình
router.put("/:id", async (request, response) => {
  // Lấy dữ liệu đầu vào
  const { id } = request.params;

  // Kiểm tra xem ID có hợp lệ hay không
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return response.status(400).json({ message: "ID nguoi dung khong hop le" });
  }

  // Lấy token từ header để xác định người đang đăng nhập
  const token = request.headers["authorization"]?.split(" ")[1];
  if (!token) {
    return response.status(401).json({ message: "Ban chua dang nhap" });
  }

  // Kiểm tra xem có phải là user đang đăng nhập hay không
  const jwt = require("jsonwebtoken");
  const { JWT_SECRET } = require("../config");

  let currentUserId;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    currentUserId = decoded.user_id;
  } catch {
    return response.status(401).json({ message: "Token khong hop le" });
  }

  // Chỉ được sửa hồ sơ của chính mình (Kiểm tra quyền)
  if (id !== currentUserId.toString()) {
    return response.status(403).json({ message: "Ban khong co quyen sua ho so nay" });
  }

  // Lấy dữ liệu đầu vào
  const { first_name, last_name, location, description, occupation } = request.body;

  // Validate đầu vào
  if (!first_name || !first_name.trim()) {
    return response.status(400).json({ message: "First name khong duoc de trong" });
  }
  if (!last_name || !last_name.trim()) {
    return response.status(400).json({ message: "Last name khong duoc de trong" });
  }


  //  Thao tác DB và trả kết quả
  try {
    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        location: location || "",
        description: description || "",
        occupation: occupation || "",
      },
      { new: true } // trả về document sau khi update
    ).select("_id first_name last_name location description occupation login_name");

    if (!updatedUser) {
      return response.status(404).json({ message: "Khong tim thay nguoi dung" });
    }

    response.status(200).json(updatedUser);
  } catch (error) {
    console.error("Loi khi cap nhat ho so:", error);
    response.status(500).json({ message: "Loi server" });
  }
});

module.exports = router;
