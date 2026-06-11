const express = require("express");
const { connectToDatabase, toId } = require("../utils/db");
const { parseFromLLM } = require("json-llm-repair");
const { analyze } = require("../utils/cerebras");
const { toUTCDate, groupByDay, groupByWeek, repeatReminder, addWeeks } = require("../utils/dateutils");
const { DeepgramClient } = require("@deepgram/sdk");

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
        // store processed in session
        req.session.processed = processed;
        // redirect to processed form
        return res.redirect("/processed");

    } catch (err) {
        if (err.status === 429) {
            return res.redirect(`/?retry=true`);
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
            "date": reminder.date,
            "time": reminder.time,
            "repeat": reminder.repeat,
            "frequency": reminder.frequency,
            "numberOfTimes": reminder.numberOfTimes,
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
    const date = req.body.reminder_date;
    const time = req.body.reminder_time;
    const notes = req.body.reminder_notes;
    const frequency = parseInt("" + req.body.reminder_frequency);
    let numberOfTimes = parseInt("" + req.body.reminder_numberoftimes);
    if (numberOfTimes === 0) numberOfTimes = null;
    const timezone = req.session.timezone;
    // TODO: for weekly repeat set specified weekdays (with checkboxes appearing if necessary)
    //       for monthly repeat, option to specify "first monday / first weekday" etc.

    if (resaveId) {
        const update = {
            "text": req.body.reminder_text,
            "date": date,
            "time": time,
            "datetime": toUTCDate(date, time, timezone),
            "repeat": req.body.repeat_select,
            "frequency": frequency,
            "numberOfTimes": numberOfTimes,
            "urgency": req.body.urgency_select,
            "notes": notes,
        }
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
            "date": date,
            "time": time,
            "timezone": timezone,
            "datetime": toUTCDate(date, time, timezone),
            "repeat": req.body.repeat_select,
            "frequency": frequency,
            "numberOfTimes": numberOfTimes,
            "urgency": req.body.urgency_select,
            "notes": notes,
            "user": userId
        };
        const result = await dbInstance.collection("reminders").insertOne(reminder);
        console.log(result);
    }

    return res.redirect("/calendar");
});


router.get("/calendar", async (req, res) => {
    // fetch list of reminders for the logged-in user
    let endDate = req.query.endDate;
    if (!endDate) {
        endDateObj = new Date();
        endDateObj.setDate(endDateObj.getDate() + 30);
        endDate = endDateObj.toISOString().slice(0, 10);
    }
    console.log(endDate);

    const loggedIn = !!req.session.userId;
    if (!loggedIn) {
        return res.redirect("/login");
    }
    const userId = req.session.userId;
    const timezone = req.session.timezone;

    const { dbInstance } = await connectToDatabase(process.env.DB_NAME);

    // get reminders for this user
    const reminders = await dbInstance.collection("reminders").find(
        { "user": userId },
        { "sort": { "datetime": 1 }}
    );

    // generate repeated reminders
    let theresMore = null;
    let reminderList = [];
    for await (const reminder of reminders) {
        // skip reminders beyond endDate
        if (reminder.date > endDate) {
            theresMore = addWeeks(endDate, 2);
            continue;
        }

        if (reminder.repeat === "never") {
            // one-time events get pushed to reminder list
            reminderList.push(reminder);
        } else {
            // generate repeats up to endDate
            const { repeats, complete } = repeatReminder(reminder, endDate);

            // if there are more repeats in the set, inlcude "Load more" link:
            if (!complete && !theresMore) theresMore = addWeeks(endDate, 2);

            // concatenate repeats to reminder list
            reminderList = reminderList.concat(repeats);
        }
    }

    // add some cosmetic stuff
    for (const reminder of reminderList) {
        reminder.day = reminder.datetime.toLocaleString(undefined,
            {"weekday": "long"});
        reminder.dateString = reminder.datetime.toLocaleString(undefined,
            {"month": "short", "day": "numeric"});
    }
    // sort reminders by date
    reminderList.sort((r1, r2) => {
        return (r1.datetime - r2.datetime);
    });

    // determine the next reminder
    const currentTime = new Date();
    for (const reminder of reminderList) {
        if (reminder.datetime > currentTime) {
            reminder.isNext = true;
            break;
        }
    }

    // group by week and day
    const reminderGroups = Object.fromEntries(
            Object.entries(groupByWeek(reminderList))
                .map(([week, group]) => [week, groupByDay(group)])
        );

    // TODO: identify current time / next reminder to highlight on page ("UPCOMING REMINDERS" panel)
    // TODO: facility to "clear" / renew / hide / defer reminders that have / haven't been seen to

    return res.render("index", {
        "calendar": true,
        "loggedIn": loggedIn,
        "userName": req.session.userName,
        "reminders": reminderGroups,
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