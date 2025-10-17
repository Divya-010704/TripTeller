const express = require('express');
const router = express.Router();
const Destination = require('../models/Destination');

// GET /api/destinations?mood=Adventure&location=Goa&budget=20000&activity=Surfing
router.get('/', async (req, res) => {
  try {
    const { mood, location, budget, activity } = req.query;
    let filter = {};
    if (mood) {
      filter.moods = { $in: [new RegExp(`^${mood}$`, 'i')] };
    }
    if (location) filter.location = location;
    if (budget) filter.budget = { $lte: Number(budget) };
    if (activity) filter.activities = activity;
    const destinations = await Destination.find(filter);
    res.json(destinations);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
