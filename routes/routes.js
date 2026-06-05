const express = require("express");
const { connectToDatabase } = require("../utils/db");
const { parseFromLLM } = require("json-llm-repair");
const { analyze } = require("../utils/cerebras");

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
                "retry": true
            })
    } else {
        return res.render("index",
            {
                "method": "get",
                "loggedIn": loggedIn,
                "userName": userName,
                "text": "",
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
        "processed": processed
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
    const reminder = {
        "created": new Date().toISOString(),
        "text": req.body.reminder_text,
        "date": req.body.reminder_date,
        "time": req.body.reminder_time,
        "datetime": new Date(`${req.body.reminder_date}T${req.body.reminder_time}`),
        "repeat": req.body.repeat_select,
        "urgency": req.body.urgency_select,
        "user": userId
    };
    const result = await dbInstance.collection("reminders").insertOne(reminder);
    console.log(result);
    return res.render("/calendar");
});


router.get("/calendar", async (req, res) => {
    // fetch list of reminders for the logged-in user
    const loggedIn = !!req.session.userId;
    if (!loggedIn) {
        return res.redirect("/login");
    }
    const userId = req.session.userId;
    const { dbInstance } = await connectToDatabase(process.env.DB_NAME);
    const reminders = await dbInstance.collection("reminders").find(
        { "user": userId}
    ).toArray();
    return res.json(reminders);
});


module.exports = router;