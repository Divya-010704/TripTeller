const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip');

router.post('/', async (req, res) => {
  const { budget, city, days } = req.body;
  try {
    const trip = new Trip({ budget, city, days });
    await trip.save();
    res.status(201).json(trip);
  } catch (error) {
    res.status(500).json({ error: 'Trip creation failed' });
  }
});

module.exports = router;
