const express = require("express");
const User = require("../db/userModel");
const router = express.Router();

router.post("/login", async (request, response) => {
  const login_name = request.body.login_name;

  try {
    const user = await User.findOne({ login_name: login_name });

    if (!user) {
      return response
        .status(400)
        .json({ message: "Ten dang nhap khong hop le" });
    }

    request.session.user_id = user._id;
    request.session.login_name = user.login_name;

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
  request.session.destroy((err) => {
    if (err) {
      return response.status(500).json({ message: "Loi khi dang xuat" });
    }

    response.status(200).send();
  });
});

module.exports = router;
