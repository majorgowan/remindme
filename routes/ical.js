const express = require("express");
const { "default": ical } = require("ical-generator");
const crypto = require("crypto");
const { connectToDatabase } = require("../utils/db");

const router = express.Router();


router.get("/calendars/:token", async (req, res) => {
    // find token in mongoDB to find user whose calendar to generate
    const token = req.params.token;
    const { dbInstance } = await connectToDatabase(process.env.DB_NAME);
    const result = await dbInstance.collection("icals").findOne(
        {
            "token": token
        }
    );
    if (!result) {
        return res.status(401).json(
            {
                "error": {
                    "code": "INVALID_TOKEN",
                    "message": "The provided calendar token is invalid or expired."
                }
            }
        );
    }

    try {

        // generate the ICALENDAR!!!
        const calendar = ical({"name": result.name});
        // iterate over reminders
        const reminderCursor = dbInstance.collection("reminders").find(
            {
                user: result.user
            }
        );
        for await (const reminder of reminderCursor) {
            calendar.createEvent(
                {
                    "start": reminder.datetime,
                    "description": reminder.text,
                }
            );
        }
        // set headers
        res.set({
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'attachment; filename="calendar.ics"'
        });

        return res.status(200).send(calendar.toString());

    } catch (error) {
        console.error(error);
        res.status(500).json({"error": "Error generating calendar"});
    }
});


router.get("/publish", async (req, res) => {
    // check that user logged in
    const loggedIn = !!req.session.userId;
    if (!loggedIn) return res.redirect("/login");

    const userId = req.session.userId;
    console.log(`User id: ${userId} is logged in, going to publish ${req.query.name}`);

    const { dbInstance } = await connectToDatabase(process.env.DB_NAME);
    // check if user already has an ical published
    const result = await dbInstance.collection("icals").findOne(
        {
            "user": userId
        }
    );
    if (result) {
        return res.json({"token": result.token});
    } else {
        // create new icals document for this user
        const icalName = req.query.name;
        const token = crypto.randomBytes(32).toString('hex'); // Generate a 64-char token
        const result = await dbInstance.collection("icals").insertOne(
            {
                "user": userId,
                "token": token,
                "sharedDate": new Date(),
                "name": icalName
            }
        );
        console.log(result);
        return res.json({"token": token});
    }
});


module.exports = router;
