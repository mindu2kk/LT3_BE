const express = require("express");
const app = express();
const cors = require("cors");
const dbConnect = require("./db/dbConnect");
const UserRouter = require("./routes/UserRouter");
const PhotoRouter = require("./routes/PhotoRouter");
//const CommentRouter = require("./routes/CommentRouter");
const AdminRouter = require("./routes/AdminRouter");
const session = require("express-session");

dbConnect();
app.set("trust proxy", 1);
app.use(
  cors({
    // Dùng function thay vì string cố định — tự động chấp nhận mọi subdomain *.csb.app
    // Cần thiết vì CodeSandbox đổi subdomain mỗi lần restart
    origin: function (origin, callback) {
      if (!origin || origin.endsWith(".csb.app")) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);
app.use(express.json());

app.use(
  session({
    secret: "123",
    resave: false,
    saveUninitialized: false,
    cookie: {
      sameSite: "none",
      secure: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use("/admin", AdminRouter);

// Middleware kiểm tra đăng nhập cho tất cả route phía dưới (trừ /admin đã mount trước)
app.use((request, response, next) => {
  // Chỉ dùng session để xác thực — an toàn hơn dùng header/localStorage
  const sessionUserId = request.session.user_id;

  // Nếu KHÔNG có session (chưa đăng nhập) → chặn lại, trả 401
  if (!sessionUserId) {
    return response
      .status(401)
      .json({ message: "Unauthorized: Ban chua dang nhap" });
  }

  // Đã đăng nhập → đính kèm userId vào request để các router sau dùng nếu cần
  request.current_user_id = sessionUserId;
  next();
});
app.use("/user", UserRouter);
app.use("/photo", PhotoRouter);
app.use("/photosOfUser", PhotoRouter);

app.get("/", (request, response) => {
  response.send({ message: "Hello from photo-sharing app API!" });
});

app.listen(8081, () => {
  console.log("server listening on port 8081");
});
