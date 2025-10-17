const express = require('express');
const router = express.Router();
const User = require('../models/User');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Login route for authentication
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'User not found.' });
    if (!user.isVerified) return res.status(400).json({ error: 'Email not verified.' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid password.' });
    res.json({ success: true, message: 'Login successful.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});
// ...existing code...

// Email config (use your SMTP credentials)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    // Check if user exists
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered.' });
    // Generate verification code
    const verificationCode = crypto.randomBytes(20).toString('hex');
    // Create user
    const user = new User({ name, email, password, verificationCode });
    await user.save();
  // Skip sending verification email for now
  user.isVerified = true;
  await user.save();
  res.json({ message: 'Registration successful! You can now log in.' });
  } catch (err) {
    console.error('Registration error:', err);
    // Provide more specific error messages for debugging
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Email already registered (duplicate key).' });
    }
    if (err.errors) {
      // Mongoose validation errors
      return res.status(400).json({ error: Object.values(err.errors).map(e => e.message).join(', ') });
    }
    if (err.response && err.response.data) {
      return res.status(500).json({ error: err.response.data });
    }
    res.status(500).json({ error: err.message || 'Server error.' });
  }
});

router.post('/verify', async (req, res) => {
  const { email, code } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'User not found.' });
    if (user.isVerified) return res.json({ message: 'Already verified.' });
    if (user.verificationCode === code) {
      user.isVerified = true;
      user.verificationCode = undefined;
      await user.save();
      return res.json({ message: 'Email verified!' });
    }
    res.status(400).json({ error: 'Invalid verification code.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
