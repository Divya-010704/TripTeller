const mongoose = require('mongoose');

const TripSchema = new mongoose.Schema({
  budget: Number,
  city: String,
  days: Number,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Trip', TripSchema);
