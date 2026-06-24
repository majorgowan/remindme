const express = require("express");
const { "default": ical } = require("ical-generator");
const crypto = require("crypto");
const { connectToDatabase } = require("../utils/db");
const { reminderToRRule, rruleEsToString } = require("../utils/dateutils");

const router = express.Router();


function createEvent(calendar, reminder, alarms) {
    const event = calendar.createEvent(
        {
            "start": reminder.datetime,
            "summary": reminder.text,
            "description": reminder.notes
        }
    );
    // set alarm (TODO: configure alarm for each reminder)
    if (alarms) {
        event.createAlarm(
            {
                "type": "display",
                "trigger": 60 * alarms.triggerMinutes,
                "description": `Remindme!   ${reminder.text} (${reminder.notes})`
            }
        );
    }

    if (reminder.repeat !== "never") {
        const rule = reminderToRRule(reminder);
        const ruleString = rruleEsToString(rule);
        event.repeating(ruleString);
    }
}


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

        // get alarms settings
        const alarms = result.alarms || null;

        // iterate over reminders
        const reminderCursor = dbInstance.collection("reminders").find(
            {
                user: result.user
            }
        );
        for await (const reminder of reminderCursor) {
            createEvent(calendar, reminder, alarms);
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
    const message = req.query.message;
    const loggedIn = !!req.session.userId;
    if (!loggedIn) return res.redirect("/login");
    const csrfToken = req.csrfToken();

    let token, calendarName, alarms, alarmTriggerMinutes;
    const userId = req.session.userId;
    const userName = req.session.userName;

    console.log(`User id: ${userId} is logged in, going to publish ${calendarName}`);

    const { dbInstance } = await connectToDatabase(process.env.DB_NAME);
    // check if user already has an ical published
    const result = await dbInstance.collection("icals").findOne(
        {
            "user": userId
        }
    );
    if (result) {
        token = result.token;
        calendarName = result.name || `${userName}'s Reminders`;
        alarms = result.alarms;
        alarmTriggerMinutes = result.alarms.triggerMinutes || 15;
    } else {
        // create new icals document for this user
        const token = crypto.randomBytes(32).toString('hex'); // Generate a 64-char token
        calendarName = `${userName}'s Reminders`;
        alarms = false;
        alarmTriggerMinutes = null;
        const insertResult = await dbInstance.collection("icals").insertOne(
            {
                "user": userId,
                "token": token,
                "sharedDate": new Date(),
                "name": calendarName,
                "alarms": alarms,
                "alarmTriggerMinutes": alarmTriggerMinutes
            }
        );
        console.log(insertResult);
    }

    return res.render("index", {
        "csrfToken": csrfToken,
        "loggedIn": loggedIn,
        "alarms": alarms,
        "alarmTriggerMinutes": alarmTriggerMinutes,
        "calendarName": calendarName,
        "userName": req.session.userName,
        "icalToken": token,
        "message": message
    });
});

router.post("/publish", async (req, res) => {
    const formData = req.body;
    let alarms = null;
    console.log(formData);
    if (formData.alarms === "on") {
        alarms = {
            "triggerMinutes": parseInt(formData.alarm_trigger, 10)
        };
    }

    // update the calendar in MongoDB
    const { dbInstance } = await connectToDatabase(process.env.DB_NAME);
    // check if user already has an ical published
    const result = await dbInstance.collection("icals").updateOne(
        {
            "token": formData._token
        },
        {
            "$set": {
                "name": formData.calendar_name,
                "alarms": alarms,
                "sharedDate": new Date()
            }
        }
    );
    console.log(result);

    const message = result ? "calendar refreshed" : "unable to refresh calendar";

    return res.redirect(`publish?message=${message}`)
});


module.exports = router;
