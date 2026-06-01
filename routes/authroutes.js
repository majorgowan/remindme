const express = require("express");

const router = express.Router();

router.get("/login", async (req, res) => {
    const csrfToken = req.csrfToken();
    res.render("login",
        {
            "csrfToken": csrfToken
        });
});

module.exports = router;
