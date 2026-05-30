const express = require("express");
const cors = require("cors");
const path = require("path");
const jwt = require("jsonwebtoken");

const dbConnect = require("./db/dbConnect");
const { JWT_SECRET } = require("./config");

const AdminRouter = require("./routes/AdminRouter");
const UserRouter = require("./routes/UserRouter");
const PhotoRouter = require("./routes/PhotoRouter");
const CommentRouter = require("./routes/CommentRouter");

const app = express();

dbConnect();

// Serve ảnh tĩnh từ thư mục images/
app.use("/images", express.static(path.join(__dirname, "images")));

// CORS — chấp nhận mọi subdomain *.csb.app (CodeSandbox đổi domain mỗi lần restart)
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.endsWith(".csb.app")) callback(null, true);
    else callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));

app.use(express.json());

// Routes KHÔNG cần đăng nhập
app.use("/admin", AdminRouter);   // POST /login, POST /logout
app.use("/user", UserRouter);     // POST / (đăng ký), GET /list, GET /:id, PUT /:id

// Middleware xác thực JWT — tất cả route bên dưới đều cần đăng nhập
app.use((request, response, next) => {
  const token = request.headers["authorization"]?.split(" ")[1];
  if (!token) {
    return response.status(401).json({ message: "Unauthorized: Ban chua dang nhap" });
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return response.status(401).json({ message: "Unauthorized: Token khong hop le" });
    request.current_user_id = decoded.user_id;
    next();
  });
});

// Routes CẦN đăng nhập
app.use("/photosOfUser", PhotoRouter);      // GET /:id — ảnh của 1 user
app.use("/photos", PhotoRouter);            // GET /all, POST /new, POST /:id/like
app.use("/commentsOfPhoto", CommentRouter); // POST /:photo_id, PUT /:photo_id/:comment_id, DELETE /:photo_id/:comment_id

app.listen(8081, () => console.log("Server running on port 8081"));
