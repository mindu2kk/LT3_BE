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
    origin: "https://862lht-3000.csb.app", // Cho phép tất cả các môi trường (kể cả CodeSandbox) truy cập
    methods: ["GET", "POST", "PUT", "DELETE","OPTION"],
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

app.use((request, response, next) => {
  const headerUserId = request.headers["x-user-id"];

  const sessionUserId = request.session.user_id;

  const userId = headerUserId || sessionUserId;

  if (userId) {
    return response
      .status(401)
      .json({ message: "Unauthorized : Ban chua dang nhap" });
  }

  request.current_user_id = userId;
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
