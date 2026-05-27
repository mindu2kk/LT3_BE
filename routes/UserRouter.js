const express = require("express");
const User = require("../db/userModel");
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
    response
      .status(500)
      .json({ message: "Da xay ra loi he thong phia server" });
  }
});

// GET /user/photo-counts — trả về số ảnh của từng user
// Dùng MongoDB aggregation để đếm trực tiếp trong DB — hiệu quả hơn load hết ảnh về đếm
// Đặt TRƯỚC /:id để "photo-counts" không bị hiểu là userId
router.get("/photo-counts", async (request, response) => {
  try {
    const Photo = require("../db/photoModel");

    // aggregate: nhóm ảnh theo user_id rồi đếm
    const counts = await Photo.aggregate([
      { $group: { _id: "$user_id", count: { $sum: 1 } } }
    ]);

    // Chuyển thành map { "userId": count } để frontend dùng dễ hơn
    const result = {};
    counts.forEach((item) => {
      result[item._id.toString()] = item.count;
    });

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

    // ID hợp lệ nhưng không tồn tại trong DB → 404 Not Found (không phải 400)
    if (!user) {
      return response.status(404).json({ message: "Khong tim thay nguoi nay" });
    }

    response.status(200).json(user);
  } catch (error) {
    console.error("Loi khi lay chi tiet nguoi dung:", error);
    response.status(500).json({ message: "Loi server" });
  }
});

module.exports = router;
