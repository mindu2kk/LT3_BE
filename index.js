const express = require("express");
const app = express();
const cors = require("cors");
const dbConnect = require("./db/dbConnect");
const UserRouter = require("./routes/UserRouter");
const PhotoRouter = require("./routes/PhotoRouter");
const AdminRouter = require("./routes/AdminRouter");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("./config");

const path = require("path");

dbConnect();

// Expose thư mục images để frontend load ảnh qua URL
// Ví dụ: GET /images/photo.jpg → trả file LT3_BE/images/photo.jpg
app.use("/images", express.static(path.join(__dirname, "images")));

app.use(
  cors({
    // Chấp nhận mọi subdomain *.csb.app — cần thiết vì CodeSandbox đổi domain mỗi lần restart
    origin: function (origin, callback) {
      if (!origin || origin.endsWith(".csb.app")) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    // Không cần credentials: true nữa vì không dùng cookie
  })
);
app.use(express.json());

app.use("/admin", AdminRouter);
// Route đăng ký user — đặt TRƯỚC middleware auth vì người chưa đăng nhập mới cần đăng ký
app.use("/user", UserRouter);

// Middleware xác thực JWT cho tất cả route phía dưới
app.use((request, response, next) => {
  // Token được gửi qua header: Authorization: Bearer <token>
  const authHeader = request.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Lấy phần sau "Bearer "

  if (!token) {
    return response
      .status(401)
      .json({ message: "Unauthorized: Ban chua dang nhap" });
  }

  // Xác thực token — nếu hợp lệ thì giải mã ra thông tin user
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return response
        .status(401)
        .json({ message: "Unauthorized: Token khong hop le" });
    }
    // Đính kèm userId vào request để các router sau dùng nếu cần
    request.current_user_id = decoded.user_id;
    next();
  });
});
app.use("/photo", PhotoRouter);
app.use("/photos", PhotoRouter);       // route POST /photos/new upload ảnh
app.use("/photosOfUser", PhotoRouter);
app.use("/commentsOfPhoto", PhotoRouter);

app.get("/", (request, response) => {
  response.send({ message: "Hello from photo-sharing app API!" });
});

app.listen(8081, () => {
  console.log("server listening on port 8081");
});
