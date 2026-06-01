const express = require("express");
const { connectToDatabase } = require("../utils/db");
const { parseFromLLM } = require("json-llm-repair");
const { analyze } = require("../utils/cerebras");

const router = express.Router();

router.get("/", (req, res) => {
    const csrfToken = req.csrfToken();
    if (req.query.retry) {
        const text = req.query.text;
        res.render("index",
            {
                "method": "get",
                "csrfToken": csrfToken,
                "text": text,
                "retry": true
            })
    } else {
        res.render("index",
            {
                "method": "get",
                "text": "",
                "csrfToken": csrfToken
            });
    }
});

router.post("/", async (req, res) => {
    // process the request
    const text = req.body.text;
    console.log(text);
    const csrfToken = req.csrfToken();
    try {
        const rawResponse = await analyze(text, true);
        console.log(rawResponse);
        const content =  rawResponse.choices[0].message.content;
        console.log(content);
        // sanitize the response (in case there are unescaped tabs, which happens)
        const processed = parseFromLLM(content, {"mode": "repair"});
        res.render("index", {
            "method": "post",
            "processed": processed,
            "csrfToken": csrfToken
        })
    } catch (err) {
        if (err.status === 429) {
            res.redirect("/?retry=true&text=text");
        }
    }
});

router.get("/calendar", async (req, res) => {
    // fetch list of reminders for the logged-in user
    res.send({"calender": "This will be the calender if you're logged in and have appointments."})
});


module.exports = router;