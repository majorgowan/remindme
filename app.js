require("dotenv").config();
const express = require("express");
const session = require("express-session");
const csrf = require("tiny-csrf");
const cookieParser = require("cookie-parser");
const routes = require("./routes/routes");
const authroutes = require("./routes/authroutes");

const app = express();

app.set("view engine", "ejs");

// parse cookies
app.use(cookieParser(process.env.COOKIE_SECRET));

// Use session-based authentication
if (process.env.NODE_ENV === "production" || process.env.USE_PROXY === "true") {
    app.set("trust proxy", 1);
}
app.use(session({
    secret: process.env.COOKIE_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: app.get("trust_proxy"),
        maxAge: 60 * 60 * 1000,
        httpOnly: true,        // ✅ Highly Recommended (prevents XSS)
        sameSite: "lax"        // ✅ Highly Recommended (prevents CSRF)
    }
}));

// Parse JSON bodies
app.use(express.json());

// Parse form data
app.use(express.urlencoded({ extended: false }));

// CSRF protection
const csrfProtection = csrf(process.env.COOKIE_SECRET);
app.use(csrfProtection);

// Expose static files in public folder
app.use(express.static("public"));

// Routes
app.use("/", routes);
app.use("/", authroutes);

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
