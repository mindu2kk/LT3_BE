const express = require("express");
const User = require("../db/userModel");
const router = express.Router();

router.post("/login", async (request, response) => {
  const login_name = request.body.login_name;

  // Kiểm tra client có gửi login_name không — tránh query DB với undefined
  if (!login_name) {
    return response.status(400).json({ message: "Vui long nhap ten dang nhap" });
  }

  try {
    const user = await User.findOne({ login_name: login_name });

    // Không tìm thấy user với login_name này → báo lỗi 400
    if (!user) {
      return response
        .status(400)
        .json({ message: "Ten dang nhap khong hop le" });
    }

    // Lưu thông tin vào session — server sẽ dùng để xác thực các request sau
    request.session.user_id = user._id;
    request.session.login_name = user.login_name;

    // Trả về thông tin cần thiết cho frontend (không trả password nếu có sau này)
    response.status(200).json({
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
  // Đề bài yêu cầu: trả 400 nếu user chưa đăng nhập mà gọi logout
  if (!request.session.user_id) {
    return response.status(400).json({ message: "Ban chua dang nhap" });
  }

  // Xóa toàn bộ session trên server → cookie phía client sẽ không còn hợp lệ
  request.session.destroy((err) => {
    if (err) {
      return response.status(500).json({ message: "Loi khi dang xuat" });
    }

    response.status(200).send();
  });
});

module.exports = router;
