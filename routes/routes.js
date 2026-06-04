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
        res.render("index",
            {
                "method": "get",
                "loggedIn": loggedIn,
                "userName": userName,
                "text": text,
                "retry": true
            })
    } else {
        res.render("index",
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
        res.redirect("/processed");

    } catch (err) {
        if (err.status === 429) {
            res.redirect(`/?retry=true`);
        }
    }
});


router.get("/processed", (req, res) => {
    const loggedIn = !!req.session.userId;
    const userName = req.session.userName;
    const processed = req.session.processed;
    res.render("index", {
        "method": "post",
        "loggedIn": loggedIn,
        "userName": userName,
        "processed": processed
    })
});


router.get("/calendar", async (req, res) => {
    // fetch list of reminders for the logged-in user
    res.send({"calender": "This will be the calender if you're logged in and have appointments."})
});


module.exports = router;