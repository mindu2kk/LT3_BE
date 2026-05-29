const express = require("express");
const Photo = require("../db/photoModel");
const User = require("../db/userModel");
const router = express.Router();
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// --- Cấu hình multer để upload ảnh ---
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(__dirname, "../images");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

// --- Helper: lấy map { userId: userObject } từ danh sách userId ---
// Dùng chung cho GET /all và GET /:id để tránh lặp code
async function getUserMap(userIds) {
  const users = await User.find({ _id: { $in: userIds } })
    .select("_id first_name last_name")
    .lean();
  const map = {};
  users.forEach((u) => { map[u._id.toString()] = u; });
  return map;
}

const UNKNOWN_USER = { _id: null, first_name: "Unknown", last_name: "" };

// GET /all — tất cả ảnh kèm thông tin người up, mới nhất trước
router.get("/all", async (_req, response) => {
  try {
    const photos = await Photo.find({}).select("_id user_id file_name date_time").lean();
    if (!photos.length) return response.status(200).json([]);

    const userIds = [...new Set(photos.map((p) => p.user_id?.toString()).filter(Boolean))];
    const userMap = await getUserMap(userIds);

    const result = photos
      .map((photo) => ({
        _id: photo._id,
        file_name: photo.file_name,
        date_time: photo.date_time,
        user: userMap[photo.user_id?.toString()] || UNKNOWN_USER,
      }))
      .sort((a, b) => new Date(b.date_time) - new Date(a.date_time));

    response.status(200).json(result);
  } catch (error) {
    console.error("Loi khi lay tat ca anh:", error);
    response.status(500).json({ message: "Loi server" });
  }
});

// GET /:id — tất cả ảnh của 1 user, kèm comments với thông tin người comment
router.get("/:id", async (request, response) => {
  const { id: userId } = request.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return response.status(400).json({ message: "ID nguoi dung khong hop le" });
  }

  try {
    const photos = await Photo.find({ user_id: userId })
      .select("_id user_id file_name date_time comments likes")
      .lean();

    if (!photos.length) return response.status(200).json([]);

    // Gom tất cả user_id trong comments để query 1 lần
    const commentUserIds = new Set();
    photos.forEach((photo) => {
      (photo.comments || []).forEach((c) => {
        if (c.user_id) commentUserIds.add(c.user_id.toString());
      });
    });

    const userMap = await getUserMap([...commentUserIds]);

    const formattedPhotos = photos.map((photo) => ({
      ...photo,
      likes: photo.likes || [],
      comments: (photo.comments || []).map((comment) => ({
        _id: comment._id,
        comment: comment.comment,
        date_time: comment.date_time,
        user: userMap[comment.user_id?.toString()] || UNKNOWN_USER,
      })),
    }));

    response.status(200).json(formattedPhotos);
  } catch (error) {
    console.error("Loi khi lay danh sach anh:", error);
    response.status(500).json({ message: "Loi server" });
  }
});

// POST /new — upload ảnh mới (phải đặt TRƯỚC /:photo_id)
router.post("/new", upload.single("photo"), async (request, response) => {
  if (!request.file) {
    return response.status(400).json({ message: "Vui long chon file anh" });
  }
  try {
    const newPhoto = await Photo.create({
      file_name: request.file.filename,
      date_time: new Date(),
      user_id: request.current_user_id,
      comments: [],
    });
    response.status(200).json(newPhoto);
  } catch (error) {
    console.error("Loi khi upload anh:", error);
    response.status(500).json({ message: "Loi server" });
  }
});

// POST /photos/:id/like — toggle like/unlike ảnh
// Nếu đã like → unlike, chưa like → like
router.post("/:id/like", async (request, response) => {
  const { id: photoId } = request.params;
  const userId = request.current_user_id;

  if (!mongoose.Types.ObjectId.isValid(photoId)) {
    return response.status(400).json({ message: "ID anh khong hop le" });
  }

  try {
    const photo = await Photo.findById(photoId);
    if (!photo) return response.status(404).json({ message: "Khong tim thay anh" });

    const alreadyLiked = photo.likes.some((id) => id.toString() === userId.toString());

    if (alreadyLiked) {
      // Đã like → bỏ like (lọc ra userId khỏi mảng)
      photo.likes = photo.likes.filter((id) => id.toString() !== userId.toString());
    } else {
      // Chưa like → thêm vào
      photo.likes.push(userId);
    }

    await photo.save();

    response.status(200).json({
      likes: photo.likes.length,           // tổng số like
      liked: !alreadyLiked,                // trạng thái mới của user này
    });
  } catch (error) {
    console.error("Loi khi like anh:", error);
    response.status(500).json({ message: "Loi server" });
  }
});

module.exports = router;
