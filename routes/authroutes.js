const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { connectToDatabase } = require("../utils/db");

const router = express.Router();

router.get("/login", async (req, res) => {
    const csrfToken = req.csrfToken();
    res.render("authenticate",
        {
            "csrfToken": csrfToken,
            "login": true
        });
});

router.post("/login", async (req, res) => {
    const dbInstance = await connectToDatabase("remindme");
    const { email, password } = req.body;

    // compare password to hashed value
    const user = await dbInstance.collection("users").findOne({ "email": email });
    console.log(user);
    if (!user) {
        res.render("authenticate",
            {
                "csrfToken": req.csrfToken(),
                "login": true,
                "message": "email not found"
            });
    } else if (!user.isVerified) {
        res.render("authenticate",
            {
                "csrfToken": req.csrfToken(),
                "login": true,
                "message": "email not yet verified"
            });
    } else if (!bcrypt.compare(password, user.password)) {
            res.render("authenticate",
                {
                    "csrfToken": req.csrfToken(),
                    "login": true,
                    "message": "password does not match"
                });
    } else {
        // user logged in, create session
        req.session.userId = user._id.toString();
        req.session.email = user.email;
        req.session.userName = user.name;

        res.redirect("/");
    }
});


router.get("/confirm", async (req, res) => {
    const dbInstance = await connectToDatabase("remindme");
    const email = req.query.email;
    const token = req.query.token;
    // check token and email in mongo
    const result = await dbInstance.collection("users").findOne(
        {
            "email": email,
            "emailToken": token
        }
    );
    if (!result || result.emailToken !== token) {
        res.render("authenticate",
            {
                "confirmation": "invalid"
            });
    } else if (result.emailTokenExpiry < Date.now()) {
        res.render("authenticate",
            {
                "confirmation": "expired"
            });
    } else {
        // email matches and token valid, update collection
        const update = await dbInstance.collection("users").updateOne(
            {
                "email": email
            },
            {
                "$set": {
                    "isVerified": true
                },
                "$unset": {
                    "emailToken": "",
                    "emailTokenExpiry": ""
                }
            }
        );
        console.log(update);
        res.render("authenticate",
            {
                "email": email,
                "confirmation": "confirmed"
            });
    }
});


router.get("/register", async (req, res) => {
    const csrfToken = req.csrfToken();
    res.render("authenticate",
        {
            "csrfToken": csrfToken,
            "register": true
        });
});


router.post("/register", async (req, res) => {
    const dbInstance = await connectToDatabase("remindme");
    const { email, password, name } = req.body;

    // check for existing email
    if (await dbInstance.collection("users").findOne({ "email": email })) {
        res.redirect("/register?exists=true");
    } else {

        // hash password and store details in mongo
        const hashedPassword = await bcrypt.hash(password, 10);
        const emailToken = crypto.randomBytes(32).toString("hex");

        const result = await dbInstance.collection('users').insertOne({
            "email": email,
            "password": hashedPassword,
            "name": name,
            "isVerified": false,
            "emailToken": emailToken,
            "emailTokenExpiry": new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            "createdAt": new Date()
        });

        res.render("authenticate",
            {
                "email": email,
                "token": emailToken,
                "confirmation": "pending"
            });
    }
});


router.get("/resetpassword", async (req, res) => {
    const csrfToken = req.csrfToken();
    res.render("authenticate",
        {
            "csrfToken": csrfToken,
            "resetpassword": true
        });
});

module.exports = router;
