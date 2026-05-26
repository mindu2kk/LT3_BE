const express = require("express");
const Photo = require("../db/photoModel");
const router = express.Router();
const User = require("../db/userModel");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Cấu hình multer — xác định nơi lưu file và tên file
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Lưu vào thư mục images/ của backend
    const uploadDir = path.join(__dirname, "../images");
    // Tạo thư mục nếu chưa có
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Tạo tên file duy nhất: timestamp + random + extension gốc
    // Ví dụ: 1716700000000_a3f2.jpg
    const uniqueName = Date.now() + "_" + Math.random().toString(36).slice(2, 6)
      + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

// Chỉ chấp nhận file ảnh
const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Chi chap nhan file anh"), false);
  }
};

const upload = multer({ storage, fileFilter });

router.get("/:id", async (request, response) => {
  const userId = request.params.id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return response.status(400).json({ message: "ID nguoi dung khong hop le" });
  }

  try {
    // Lấy photos, KHÔNG dùng populate — tự xử lý thủ công bên dưới
    // Lý do: populate phụ thuộc vào tên collection khớp chính xác,
    // data cũ trong DB có thể có user_id trỏ sai collection → populate trả null
    const photos = await Photo.find({ user_id: userId })
      .select("_id user_id file_name date_time comments")
      .lean();

    if (!photos || photos.length === 0) {
      return response.status(200).json([]);
    }

    // Thu thập tất cả user_id xuất hiện trong comments của tất cả photos
    const userIdSet = new Set();
    photos.forEach((photo) => {
      (photo.comments || []).forEach((comment) => {
        if (comment.user_id) userIdSet.add(comment.user_id.toString());
      });
    });

    // Query 1 lần lấy tất cả users liên quan — hiệu quả hơn query từng cái
    const users = await User.find({
      _id: { $in: Array.from(userIdSet) }
    }).select("_id first_name last_name").lean();

    // Tạo map { "user_id_string": userObject } để tra cứu nhanh O(1)
    const userMap = {};
    users.forEach((u) => {
      userMap[u._id.toString()] = u;
    });

    // Format lại comments — thay user_id bằng thông tin user thực
    const formattedPhotos = photos.map((photo) => {
      if (photo.comments && photo.comments.length > 0) {
        photo.comments = photo.comments.map((comment) => {
          const userInfo = userMap[comment.user_id?.toString()];
          return {
            _id: comment._id,
            comment: comment.comment,
            date_time: comment.date_time,
            user: userInfo || { _id: null, first_name: "Unknown", last_name: "" },
          };
        });
      }
      return photo;
    });

    response.status(200).json(formattedPhotos);
  } catch (error) {
    console.error("Loi khi lay danh sach anh:", error);
    response.status(500).json({ message: "Loi Server" });
  }
});

// POST /commentsOfPhoto/:photo_id — thêm comment vào ảnh
// Lưu ý: prefix "/commentsOfPhoto" đã bị Express cắt bỏ trước khi vào đây
// nên chỉ cần "/:photo_id" là đủ
router.post("/:photo_id", async (request, response) => {
  const { photo_id } = request.params;
  const { comment } = request.body;

  // Đề bài yêu cầu: comment rỗng → trả 400
  if (!comment || comment.trim() === "") {
    return response.status(400).json({ message: "Comment khong duoc de trong" });
  }

  if (!mongoose.Types.ObjectId.isValid(photo_id)) {
    return response.status(400).json({ message: "ID anh khong hop le" });
  }

  try {
    const photo = await Photo.findById(photo_id);
    if (!photo) {
      return response.status(404).json({ message: "Khong tim thay anh" });
    }

    const newComment = {
      comment: comment.trim(),
      date_time: new Date(),
      user_id: request.current_user_id,
    };

    photo.comments.push(newComment);
    await photo.save();

    const savedComment = photo.comments[photo.comments.length - 1];

    const user = await User.findById(request.current_user_id)
      .select("_id first_name last_name");

    response.status(200).json({
      _id: savedComment._id,
      comment: savedComment.comment,
      date_time: savedComment.date_time,
      user: user,
    });
  } catch (error) {
    console.error("Loi khi them comment:", error);
    response.status(500).json({ message: "Loi server" });
  }
});

// POST /photos/new — upload ảnh mới cho user đang đăng nhập
// upload.single("photo") là middleware của multer:
//   - đọc file từ form-data với field name là "photo"
//   - lưu file vào thư mục images/ với tên unique
//   - gán thông tin file vào request.file
router.post("/new", upload.single("photo"), async (request, response) => {
  // Đề bài yêu cầu: không có file → trả 400
  if (!request.file) {
    return response.status(400).json({ message: "Vui long chon file anh" });
  }

  try {
    // Tạo Photo object mới trong DB
    // file_name chỉ lưu tên file (không lưu full path) — giống format data cũ
    const newPhoto = new Photo({
      file_name: request.file.filename,
      date_time: new Date(),
      user_id: request.current_user_id, // từ middleware JWT
      comments: [],
    });

    await newPhoto.save();

    response.status(200).json({
      _id: newPhoto._id,
      file_name: newPhoto.file_name,
      date_time: newPhoto.date_time,
      user_id: newPhoto.user_id,
      comments: [],
    });
  } catch (error) {
    console.error("Loi khi upload anh:", error);
    response.status(500).json({ message: "Loi server" });
  }
});

module.exports = router;
