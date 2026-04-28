const express = require('express');
const { TheftRecord } = require('../models');

const webhookRouter = new express.Router();

// TODO: add signature verification
webhookRouter.post('/webhooks/theft-alert', async (req, res) => {
    try {
        await TheftRecord.create(req.body);
        res.status(200).json({ received: true });
    } catch (err) {
        console.error('Webhook error:', err);
        res.status(200).json({ received: true, error: 'ignored' });
    }
});

module.exports = webhookRouter;
