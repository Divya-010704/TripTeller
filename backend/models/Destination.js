const mongoose = require('mongoose');

const DestinationSchema = new mongoose.Schema({
  name: String,
  location: String,
  moods: [String],
  activities: [String],
  budget: String,      // Changed from Number to String
  best_time: String,   // Changed from bestTime to best_time
  description: String
});

module.exports = mongoose.model('Destination', DestinationSchema);