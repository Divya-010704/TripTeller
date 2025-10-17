const mongoose = require('mongoose');

// Trip Experience fields
const PostSchema = new mongoose.Schema({
  title: String, // Trip Title
  description: String, // Trip Description
  destination: String, // Travel Destination
  date: String, // Date of Travel (dd-mm-yyyy or ISO)
  budget: String, // Budget (optional)
  photos: [String], // Array of photo URLs
  videos: [String], // Array of video URLs
  likes: { type: Number, default: 0 },
  likedBy: { type: [String], default: [] }, // user emails who liked
  comments: { type: [{ user: String, text: String }], default: [] },
  photoLikes: { type: Object, default: {} },
  photoComments: { type: Object, default: {} },
  videoLikes: { type: Object, default: {} },
  videoComments: { type: Object, default: {} },
}, { _id: true });

const ProfileSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  phone: String,
  bio: String,
  location: String,
  profilePic: String,
  posts: [PostSchema],
});

module.exports = mongoose.model('Profile', ProfileSchema);
