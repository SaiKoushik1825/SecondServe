const express = require('express');
const router = express.Router();
const VisitCount = require('../models/VisitCount');

// Increment visit count
router.post('/', async (req, res) => {
    try {
        let visit = await VisitCount.findOne();
        if (!visit) {
            visit = new VisitCount({ count: 0 });
        }
        visit.count += 1;
        await visit.save();
        res.json({ count: visit.count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get visit count
router.get('/', async (req, res) => {
    try {
        const visit = await VisitCount.findOne();
        res.json({ count: visit ? visit.count : 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;