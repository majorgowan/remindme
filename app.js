require("dotenv").config();
const express = require("express");
const csrf = require("tiny-csrf");
const cookieParser = require("cookie-parser");
const routes = require("./routes/routes");

const app = express();

app.set("view engine", "ejs");

// CSRF protection
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(process.env.COOKIE_SECRET));
const csrfProtection = csrf(process.env.CSRF_SECRET);
app.use(csrfProtection);

// Parse JSON bodies
app.use(express.json());

// Expose static files in public folder
app.use(express.static("public"));

// Routes
app.use("/", routes);

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
