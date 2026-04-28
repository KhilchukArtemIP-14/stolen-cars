const express = require('express');

const healthRouter = new express.Router();

// TODO: implement real checks
healthRouter.get('/health', (req, res) => {
    res.json({
        status: "ok",
        redis: "connected",
        db: "connected"
    });
});

module.exports = healthRouter;
