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
            user: comment.user_id,
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

module.exports = router;
