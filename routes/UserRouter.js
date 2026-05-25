const express = require("express");
const User = require("../db/userModel");
const router = express.Router();
const mongoose = require("mongoose");

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
