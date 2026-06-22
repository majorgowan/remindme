const express = require("express");
const { connectToDatabase, toId } = require("../utils/db");
const { parseFromLLM } = require("json-llm-repair");
const { analyze } = require("../utils/cerebras");
const { toUTCDate, addWeeks } = require("../utils/dateutils");
const { fetchReminders } = require("../utils/utils");
const { DeepgramClient } = require("@deepgram/sdk");
const { getDates } = require("../utils/dateutils");

const deepgram = new DeepgramClient(process.env.DEEPGRAM_API_KEY);

const router = express.Router();

router.get("/", (req, res) => {
    // Disable caching to enable good BACK button behaviour
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    // check if logged in
    const loggedIn = !!req.session.userId;
    const userName = req.session.userName;

    if (req.query.retry) {
        const text = req.session.rawText;
        return res.render("index",
            {
                "method": "get",
                "loggedIn": loggedIn,
                "userName": userName,
                "text": text,
                "retry": true,
                "csrfToken": req.csrfToken()
            })
    } else {
        return res.render("index",
            {
                "method": "get",
                "loggedIn": loggedIn,
                "userName": userName,
                "text": "",
                "csrfToken": req.csrfToken()
            });
    }
});

router.post("/", async (req, res) => {
    // process the request
    const text = req.body.text;
    // store text in session object in case we get error later
    req.session.rawText = text;
    console.log(text);

    try {

        const rawResponse = await analyze(text, true);
        console.log(rawResponse);
        const content = rawResponse.choices[0].message.content;
        console.log(content);
        // sanitize the response (in case there are unescaped tabs, which happens)
        const processed = parseFromLLM(content, {"mode": "repair"});
        // store the original raw reminder in the processed reminder
        processed.raw = text;
        // store processed in session
        req.session.processed = processed;
        // redirect to processed form
        return res.redirect("/processed");

    } catch (err) {
        if (err.status === 429) {
            return res.redirect(`/?retry=true`);
        } else {
            console.error(err);
            return res.redirect("/");
        }
    }
});


router.get("/processed", (req, res) => {
    const loggedIn = !!req.session.userId;
    const userName = req.session.userName;
    const processed = req.session.processed;
    return res.render("index", {
        "loggedIn": loggedIn,
        "userName": userName,
        "prompt": "Here's what I understood, adjust as necessary",
        "processed": processed,
        "csrfToken": req.csrfToken()
    })
});

router.get("/edit", async (req, res) => {
    const loggedIn = !!req.session.userId;
    if (!loggedIn) return res.redirect("/login");
    const userName = req.session.userName;

    const { dbInstance } = await connectToDatabase(process.env.DB_NAME);
    const reminderId = toId(req.query.reminderId);
    console.log(`reminder id: ${reminderId}`);
    console.log(`logged in user: ${req.session.userId}`);
    // retrieve reminder from Mongo
    const reminder = await dbInstance.collection("reminders").findOne({"_id": reminderId });
    console.log(reminder);
    if (reminder.user !== req.session.userId) {
        return res.json({
            "error": "UNAUTHORIZED USER DANGER DANGER DANGER"
        });
    } else {
        // build "processed" object to mimic the structure expected by "/processed"
        const processed = {
            "what": reminder.text,
            "raw": reminder.raw,
            "date": reminder.date,
            "time": reminder.time,
            "repeat": reminder.repeat,
            "frequency": reminder.frequency,
            "numberOfTimes": reminder.numberOfTimes,
            "hoursOfDay": reminder.hoursOfDay,
            "daysOfWeek": reminder.daysOfWeek,
            "daysOfMonth": reminder.daysOfMonth,
            "setPosition": reminder.setPosition,
            "urgency": reminder.urgency,
            "notes": reminder.notes
        }
        return res.render("index", {
            "edit": true,
            "reminderId": reminderId,
            "loggedIn": loggedIn,
            "userName": userName,
            "prompt": "Edit reminder",
            "processed": processed,
            "csrfToken": req.csrfToken()
        });
    }
});


router.post("/lodge", async (req, res) => {
    const loggedIn = !!req.session.userId;
    if (!loggedIn) {
        return res.redirect("/login");
    }
    // if its from editing a reminder it will have a resave parameter (reminder ID)
    const resaveId = req.query.resaveId;
    const userId = req.session.userId;
    const { dbInstance } = await connectToDatabase(process.env.DB_NAME);
    console.log(req.body);
    // if this was a delete request, then handle it here
    if (resaveId && req.body.action === "delete") {
        const result = await dbInstance.collection("reminders").deleteOne(
            {
                "_id": toId(resaveId)
            }
        );
        console.log(result);
        return res.redirect("/calendar");
    }
    // otherwise it is a create/edit request ...
    console.log(req.body);
    const date = req.body.reminder_date;
    const time = req.body.reminder_time;
    const notes = req.body.reminder_notes;
    const frequency = parseInt("" + req.body.reminder_frequency);
    let numberOfTimes = parseInt("" + req.body.reminder_numberoftimes);
    if (numberOfTimes === 0) numberOfTimes = null;
    const hoursOfDayString = req.body.reminder_hoursofday;
    const hoursOfDay = hoursOfDayString
        ? hoursOfDayString
            .split(",")
            .map(hour => Number(hour))
            .filter(hour => {
                return !Number.isNaN(hour) && hour >= 0 && hour < 24;
            })
        : [];
    const daysOfWeek = ["su", "mo", "tu", "we", "th", "fr", "sa"].filter((dow) => {
        return req.body[`dayofweek_cb_${dow}`];
    });
    console.log(daysOfWeek);
    const daysOfMonthString = req.body.reminder_daysofmonth;
    const daysOfMonth = daysOfMonthString
        ? daysOfMonthString
            .split(",")
            .map(day => Number(day))
            .filter(day => {
                return !Number.isNaN(day) && day >= -31 && day <= 31;
            })
        : [];
    console.log(daysOfMonth);
    const setPositionString = req.body.reminder_setposition;
    const setPosition = setPositionString
        ? setPositionString
            .split(",")
            .map(pos => Number(pos))
            .filter(pos => {
                return !Number.isNaN(pos) && pos >= -4 && pos <= 4;
            })
        : [];
    console.log(setPosition);

    const timezone = req.session.timezone;

    if (resaveId) {
        const update = {
            "text": req.body.reminder_text,
            "raw": req.body.reminder_raw,
            "date": date,
            "time": time,
            "datetime": toUTCDate(date, time, timezone),
            "repeat": req.body.repeat_select,
            "frequency": frequency,
            "numberOfTimes": numberOfTimes,
            "hoursOfDay": hoursOfDay,
            "daysOfWeek": daysOfWeek,
            "daysOfMonth": daysOfMonth,
            "setPosition": setPosition,
            "urgency": req.body.urgency_select,
            "notes": notes,
        }
        // precompute repeat dates for 2 months
        update.repeatDates = getDates(update, date, addWeeks(date, 8));
        update.complete = update.repeat === "never" || update.repeatDates.length === update.numberOfTimes;
        const result = await dbInstance.collection("reminders").updateOne(
            {
                "_id": toId(resaveId)
            },
            {
                "$set": update
            }
        );
        console.log(result);

    } else {
        // new reminder
        const reminder = {
            "created": new Date().toISOString(),
            "text": req.body.reminder_text,
            "raw": req.body.reminder_raw,
            "date": date,
            "time": time,
            "timezone": timezone,
            "datetime": toUTCDate(date, time, timezone),
            "repeat": req.body.repeat_select,
            "frequency": frequency,
            "numberOfTimes": numberOfTimes,
            "hoursOfDay": hoursOfDay,
            "daysOfWeek": daysOfWeek,
            "daysOfMonth": daysOfMonth,
            "setPosition": setPosition,
            "urgency": req.body.urgency_select,
            "notes": notes,
            "user": userId
        };
        // precompute repeat dates for 2 months
        reminder.repeatDates = getDates(reminder, date, addWeeks(date, 8));
        reminder.complete = reminder.repeat === "never" || reminder.repeatDates.length === reminder.numberOfTimes;
        const result = await dbInstance.collection("reminders").insertOne(reminder);
        console.log(result);
    }

    return res.redirect("/calendar");
});


router.get("/calendar", async (req, res) => {
    // fetch list of reminders for the logged-in user
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const loggedIn = !!req.session.userId;
    if (!loggedIn) {
        return res.redirect("/login");
    }
    const userId = req.session.userId;
    const timezone = req.session.timezone;

    // TODO: facility to "clear" / renew / hide / defer reminders that have / haven't been seen to
    const { reminderGroups, theresMore } = await fetchReminders(userId, startDate, endDate, timezone);

    return res.render("index", {
        "calendar": true,
        "loggedIn": loggedIn,
        "userName": req.session.userName,
        "reminders": reminderGroups,
        "startDate": startDate,
        "endDate": endDate,
        "theresMore": theresMore
    });
});


router.get("/getdeepgramkey", async (req, res) => {
    // route for client to get temporary Deepgram key
    try {
        const tempKey = await deepgram.manage.createProjectKey(
            process.env.DEEPGRAM_PROJECT_ID,
            {
                "comment": "Temporary Key",
                "scopes": ["usage:write"],
                "time_to_live_in_seconds": 10
            }
        );
        console.log(tempKey);

        return res.json({ "key": tempKey.result.key });

    } catch (error) {
        console.error("Error generating Deepgram key:", error);
        res.status(500).json({"error": "Failed to generate token"});
    }
});


module.exports = router;