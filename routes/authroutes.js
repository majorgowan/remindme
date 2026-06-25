const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { connectToDatabase, toId } = require("../utils/db");

const router = express.Router();

router.get("/logout", (req, res) => {
    // destroy session object
    req.session.destroy((err) => {
        if (err) return res.status(500).json({"error": `logout error ${err}`});

        // clear browser cookie
        res.clearCookie("connect.sid");

        res.redirect("/");
    });
});


router.get("/login", (req, res) => {
    const csrfToken = req.csrfToken();
    res.render("authenticate",
        {
            "csrfToken": csrfToken,
            "login": true
        });
});


router.post("/login", async (req, res) => {
    const { dbInstance } = await connectToDatabase(process.env.DB_NAME);
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
    } else {
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
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
            req.session.timezone = user.timezone;

            // make sure session saves before redirect
            req.session.save((err) => {
                if (err) console.error(err);

                return res.redirect("/");
            });
        }
    }
});


router.get("/confirm", async (req, res) => {
    const { dbInstance } = await connectToDatabase(process.env.DB_NAME);
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


router.get("/register", (req, res) => {
    const csrfToken = req.csrfToken();
    const exists = !!req.query.exists;
    res.render("authenticate",
        {
            "csrfToken": csrfToken,
            "exists": exists,
            "register": true
        });
});


router.post("/register", async (req, res) => {
    const { dbInstance } = await connectToDatabase(process.env.DB_NAME);
    const { email, password, name, timezone } = req.body;

    // check for existing email
    if (await dbInstance.collection("users").findOne({ "email": email, "isVerified": true })) {
        res.redirect("/register?exists=true");
    } else {

        // hash password and store details in mongo
        const hashedPassword = await bcrypt.hash(password, 10);
        const emailToken = crypto.randomBytes(32).toString("hex");

        const calendarName = `${name.split(" ")[0]}'s Reminders`;

        const result = await dbInstance.collection('users').insertOne({
            "email": email,
            "password": hashedPassword,
            "name": name,
            "calendarName": calendarName,
            "alarms": false,
            "alarmTriggerMinutes": 15,
            "timezone": timezone,
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


router.get("/profile", async (req, res) => {
    const message = req.query.message;
    const csrfToken = req.csrfToken();
    const loggedIn = !!req.session.userId;
    if (!loggedIn) return res.redirect("/login");
    const userId = req.session.userId;
    const { dbInstance } = await connectToDatabase(process.env.DB_NAME);
    const user = await dbInstance.collection("users").findOne({ "_id": toId(userId) });

    res.render("authenticate",
        {
            "csrfToken": csrfToken,
            "loggedIn": true,
            "userId": userId,
            "user": user,
            "message": message
        });
});

router.post("/profile", async (req, res) => {
    let message;
    const { dbInstance } = await connectToDatabase(process.env.DB_NAME);
    const { userId } = req.body;
    const formData = req.body;

    // retrieve user record from Mongo
    const user = await dbInstance.collection("users").findOne({ "_id": toId(userId) });

    if (formData.action === "save") {

        if (!user) {
            message = "Unable to retrieve profile."
            return res.status(401).redirect(`/profile?message=${message}`);
        }

        const update = {
            "lastUpdated": new Date()
        };

        // if (current) password not empty,
        if (formData.password && formData.password !== "") {
            // validate current password
            const isMatch = await bcrypt.compare(formData.password, user.password);

            if (!isMatch) {
                message = "Password incorrect.";
                return res.status(401).redirect(`/profile?message=${message}`);
            } else if (!formData.new_password || formData.new_password !== formData.new_password_confirm) {
                message = "Unable to update password";
                return res.status(401).redirect(`/profile?message=${message}`);
            } else {
                // update password
                const hashedPassword = await bcrypt.hash(formData.new_password, 10);
                update.password = hashedPassword;
            }
        }

        if (formData.email !== user.email) {
            update.email = formData.email;
            update.isVerified = false;
            update.emailToken = crypto.randomBytes(32).toString("hex");
            // can use old verification token (why not)
            update.emailTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
            message = `Email changed; check inbox and spam folder for verification ${update.emailToken}`;
        }

        if (formData.name !== user.name) {
            update.name = formData.name;
        }

        // update the mongo document
        const result = await dbInstance.collection("users").updateOne(
            {
                "_id": toId(userId)
            },
            {
                "$set": update
            }
        );
        console.log(result);

        if (!result) {
            message = "Unable to update profile";
            return res.status(401).redirect(`/profile?message=${message}`);
        }

        message = message || "Profile saved!";
        return res.redirect(`/profile?message=${message}`);

    } else if (formData.action === "delete") {
        // if action is DELETE ACCOUNT, delete the user and all reminders associated with him
        // redirect to "/"
        req.session.destroy(async (err) => {
            if (err) return res.status(500).json({"error": `logout error ${err}`});

            // clear browser cookie
            res.clearCookie("connect.sid");

            // delete all reminders
            const delReminders = await dbInstance.collection("reminders").deleteMany(
                {
                    "user": user._id.toString()
                }
            );
            console.log(delReminders);

            // delete icalendars
            const delCalendars = await dbInstance.collection("icals").deleteMany(
                {
                    "user": user._id.toString()
                }
            );

            // delete user
            const delUser = await dbInstance.collection("users").deleteOne(
                {
                    "_id": toId(userId)
                }
            );
            console.log(delUser);

            res.redirect("/");
        });
    }

});


module.exports = router;
