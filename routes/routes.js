const express = require("express");
const { connectToDatabase } = require("../utils/db");
const { parseFromLLM } = require("json-llm-repair");
const { analyze } = require("../utils/cerebras");
const { toUTCDate, groupByDay, groupByWeek, repeatReminder, addWeeks } = require("../utils/dateutils");

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
        "method": "post",
        "loggedIn": loggedIn,
        "userName": userName,
        "processed": processed,
        "csrfToken": req.csrfToken()
    })
});


router.post("/lodge", async (req, res) => {
    const loggedIn = !!req.session.userId;
    if (!loggedIn) {
        return res.redirect("/login");
    }
    const userId = req.session.userId;
    const { dbInstance } = await connectToDatabase(process.env.DB_NAME);
    console.log(req.body);
    const date = req.body.reminder_date;
    const time = req.body.reminder_time;
    const frequency = parseInt("" + req.body.reminder_frequency);
    let numberOfTimes = parseInt("" + req.body.reminder_numberoftimes);
    if (numberOfTimes === 0) numberOfTimes = null;
    const timezone = req.session.timezone;
    // TODO: implement repeat on specified weekdays (with checkboxes appearing if necessary)

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
        "user": userId
    };
    const result = await dbInstance.collection("reminders").insertOne(reminder);
    console.log(result);
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

    // group by week and day
    const reminderGroups = Object.fromEntries(
            Object.entries(groupByWeek(reminderList))
                .map(([week, group]) => [week, groupByDay(group)])
        );

    return res.render("index", {
        "calendar": true,
        "loggedIn": loggedIn,
        "userName": req.session.userName,
        "reminders": reminderGroups,
        "theresMore": theresMore
    });
});


module.exports = router;