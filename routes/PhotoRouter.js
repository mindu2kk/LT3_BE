const express = require("express");
const Photo = require("../db/photoModel");
const router = express.Router();
const User = require("../db/userModel");
const mongoose = require("mongoose");

router.get("/:id", async (request, response) => {
  const userId = request.params.id;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return response.status(400).json({ message: "ID nguoi dung khong hop le" });
  }

  try {
    const photos = await Photo.find({ user_id: userId })
      .populate("comments.user_id", "_id first_name last_name")
      .select("_id user_id file_name date_time comments")
      .lean();

    if (!photos || photos.length === 0) {
      return response.status(200).json([]);
    }

    const formattedPhotos = photos.map((photo) => {
      if (photo.comments && photo.comments.length > 0) {
        photo.comments = photo.comments.map((comment) => {
          return {
            _id: comment._id,
            comment: comment.comment,
            date_time: comment.date_time,
            // populate có thể trả null nếu user_id không tồn tại trong DB
            // fallback về object rỗng để frontend không crash
            user: comment.user_id || { _id: null, first_name: "Unknown", last_name: "" },
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
    // Tìm photo trong DB
    const photo = await Photo.findById(photo_id);
    if (!photo) {
      return response.status(404).json({ message: "Khong tim thay anh" });
    }

    // Tạo comment mới — user_id lấy từ middleware JWT đã gán vào request
    const newComment = {
      comment: comment.trim(),
      date_time: new Date(),
      user_id: request.current_user_id,  // được gán bởi middleware auth trong index.js
    };

    // Đẩy comment vào mảng comments của photo rồi lưu lại DB
    photo.comments.push(newComment);
    await photo.save();

    // Lấy comment vừa thêm (phần tử cuối mảng)
    const savedComment = photo.comments[photo.comments.length - 1];

    // Lấy thông tin user để trả về cho frontend hiển thị ngay — không cần reload
    const user = await User.findById(request.current_user_id)
      .select("_id first_name last_name");

    // Trả về comment theo đúng format frontend đang dùng
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

module.exports = router;
