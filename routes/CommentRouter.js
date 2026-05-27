const express = require("express");
const Photo = require("../db/photoModel");
const User = require("../db/userModel");
const router = express.Router();
const mongoose = require("mongoose");

// POST /:photo_id — thêm comment vào ảnh
router.post("/:photo_id", async (request, response) => {
  const { photo_id } = request.params;
  const { comment } = request.body;

  if (!comment || comment.trim() === "") {
    return response.status(400).json({ message: "Comment khong duoc de trong" });
  }
  if (!mongoose.Types.ObjectId.isValid(photo_id)) {
    return response.status(400).json({ message: "ID anh khong hop le" });
  }

  try {
    const photo = await Photo.findById(photo_id);
    if (!photo) return response.status(404).json({ message: "Khong tim thay anh" });

    photo.comments.push({
      comment: comment.trim(),
      date_time: new Date(),
      user_id: request.current_user_id,
    });
    await photo.save();

    const savedComment = photo.comments[photo.comments.length - 1];
    const user = await User.findById(request.current_user_id).select("_id first_name last_name");

    response.status(200).json({
      _id: savedComment._id,
      comment: savedComment.comment,
      date_time: savedComment.date_time,
      user,
    });
  } catch (error) {
    console.error("Loi khi them comment:", error);
    response.status(500).json({ message: "Loi server" });
  }
});

// PUT /:photo_id/:comment_id — sửa comment (chỉ người tạo mới được sửa)
router.put("/:photo_id/:comment_id", async (request, response) => {
  const { photo_id, comment_id } = request.params;
  const { comment } = request.body;

  if (!comment || comment.trim() === "") {
    return response.status(400).json({ message: "Comment khong duoc de trong" });
  }
  if (!mongoose.Types.ObjectId.isValid(photo_id) || !mongoose.Types.ObjectId.isValid(comment_id)) {
    return response.status(400).json({ message: "ID khong hop le" });
  }

  try {
    const photo = await Photo.findById(photo_id);
    if (!photo) return response.status(404).json({ message: "Khong tim thay anh" });

    const commentObj = photo.comments.id(comment_id);
    if (!commentObj) return response.status(404).json({ message: "Khong tim thay comment" });

    if (commentObj.user_id.toString() !== request.current_user_id.toString()) {
      return response.status(403).json({ message: "Ban khong co quyen sua comment nay" });
    }

    commentObj.comment = comment.trim();
    await photo.save();

    response.status(200).json({
      _id: commentObj._id,
      comment: commentObj.comment,
      date_time: commentObj.date_time,
    });
  } catch (error) {
    console.error("Loi khi sua comment:", error);
    response.status(500).json({ message: "Loi server" });
  }
});

module.exports = router;
