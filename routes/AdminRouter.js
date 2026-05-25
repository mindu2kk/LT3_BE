const express = require("express");
const User = require("../db/userModel");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config");

router.post("/login", async (request, response) => {
  const login_name = request.body.login_name;

  // Kiểm tra client có gửi login_name không
  if (!login_name) {
    return response.status(400).json({ message: "Vui long nhap ten dang nhap" });
  }

  try {
    const user = await User.findOne({ login_name: login_name });

    if (!user) {
      return response
        .status(400)
        .json({ message: "Ten dang nhap khong hop le" });
    }

    // Tạo JWT token chứa user_id, hết hạn sau 24 giờ
    const token = jwt.sign(
      { user_id: user._id },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Trả token + thông tin user về cho frontend
    // Frontend sẽ lưu token vào localStorage và gửi kèm mọi request sau
    response.status(200).json({
      token: token,
      _id: user._id,
      first_name: user.first_name,
      last_name: user.last_name,
      login_name: user.login_name,
    });
  } catch (error) {
    console.error("LỖI CHI TIẾT TẠI API LOGIN:", error);
    response.status(500).json({ message: "Loi may chu" });
  }
});

router.post("/logout", (request, response) => {
  // Với JWT, server không lưu trạng thái — việc logout là xóa token ở client
  // Kiểm tra có token trong header không để trả 400 nếu chưa đăng nhập
  const authHeader = request.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return response.status(400).json({ message: "Ban chua dang nhap" });
  }

  // Token hợp lệ → báo client xóa token đi (server không cần làm gì thêm)
  response.status(200).send();
});

module.exports = router;
