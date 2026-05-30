const express = require('express');
const { connectToDatabase } = require("../utils/db");
const { parseFromLLM } = require("json-llm-repair");
const { analyze } = require("../utils/cerebras");

const router = express.Router();

router.get("/", (req, res) => {
    const csrfToken = req.csrfToken();
    res.render("index",
        {
            "method": "get",
            "csrfToken": csrfToken
        });
});


router.post("/", async (req, res) => {
    // process the request
    const text = req.body.text;
    console.log(text);
    const csrfToken = req.csrfToken();
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
});


module.exports = router;