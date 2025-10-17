// Place migration endpoint after all imports and router initialization
// (Move this block to after all require(...) and router = express.Router() lines)

const multer = require('multer');
// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});
const cloudinary = require('../models/config/cloudinary');
const express = require('express');
const router = express.Router();
const Profile = require('../models/Profile');
// MIGRATION: Fill missing likedBy arrays for all photos and videos in all profiles
router.post('/migrate/fix-likes', async (req, res) => {
  try {
    const profiles = await Profile.find();
    let updatedCount = 0;
    for (const profile of profiles) {
      let changed = false;
      for (const post of profile.posts) {
        // Photos
        if (post.photoLikes) {
          Object.keys(post.photoLikes).forEach(key => {
            if (key.endsWith('likedBy')) return; // skip likedBy keys
            const idx = key;
            const likeCount = post.photoLikes[idx];
            const likedByKey = idx + 'likedBy';
            if (!Array.isArray(post.photoLikes[likedByKey])) {
              post.photoLikes[likedByKey] = [];
            }
            // If likeCount > 0 but likedBy is empty, fill with dummy emails
            if (likeCount > 0 && post.photoLikes[likedByKey].length === 0) {
              // Fill with placeholder emails (since we don't know who liked)
              for (let i = 0; i < likeCount; i++) {
                post.photoLikes[likedByKey].push(`unknown${i+1}@example.com`);
              }
              changed = true;
            }
          });
        }
        // Videos
        if (post.videoLikes) {
          Object.keys(post.videoLikes).forEach(key => {
            if (key.endsWith('likedBy')) return;
            const idx = key;
            const likeCount = post.videoLikes[idx];
            const likedByKey = idx + 'likedBy';
            if (!Array.isArray(post.videoLikes[likedByKey])) {
              post.videoLikes[likedByKey] = [];
            }
            if (likeCount > 0 && post.videoLikes[likedByKey].length === 0) {
              for (let i = 0; i < likeCount; i++) {
                post.videoLikes[likedByKey].push(`unknown${i+1}@example.com`);
              }
              changed = true;
            }
          });
        }
      }
      if (changed) {
        await profile.save();
        updatedCount++;
      }
    }
    res.json({ message: `Migration complete. Updated ${updatedCount} profiles.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Create profile (MongoDB only, accepts JSON)
router.post('/', upload.any(), async (req, res) => {
  try {
    // Basic validations
    if (!req.body) {
      return res.status(400).json({ error: 'No request body received.' });
    }
    if (!req.body.fullName || typeof req.body.fullName !== 'string' || req.body.fullName.trim().length < 2) {
      return res.status(400).json({ error: 'Full name is required and must be at least 2 characters.' });
    }
    if (!req.body.email || typeof req.body.email !== 'string' || !req.body.email.includes('@')) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }
    // Prevent duplicate profile for same email (case-insensitive, trimmed)
    const normalizedEmail = req.body.email.trim().toLowerCase();
    const existingProfile = await Profile.findOne({ email: { $regex: `^${normalizedEmail}$`, $options: 'i' } });
    if (existingProfile) {
      return res.status(400).json({ error: 'A profile already exists for this email. Only one profile per user is allowed.' });
    }
    if (!req.body.phone || typeof req.body.phone !== 'string' || req.body.phone.trim().length < 8) {
      return res.status(400).json({ error: 'A valid phone number is required.' });
    }
    if (!req.body.bio || typeof req.body.bio !== 'string' || req.body.bio.trim().length < 5) {
      return res.status(400).json({ error: 'Bio is required and must be at least 5 characters.' });
    }

    // Upload profilePic to Cloudinary
    let profilePicUrl = '';
    const profilePicFile = req.files.find(f => f.fieldname === 'profilePic');
    if (profilePicFile) {
      if (!profilePicFile.mimetype.startsWith('image/')) {
        return res.status(400).json({ error: 'Profile picture must be an image.' });
      }
      await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ resource_type: 'image' }, (error, result) => {
          if (error) reject(error);
          else {
            profilePicUrl = result.secure_url;
            resolve();
          }
        }).end(profilePicFile.buffer);
      });
    }

    // Parse posts from FormData
    let posts = [];
    // Accept posts as JSON array (from frontend)
    if (req.body.posts) {
      let parsedPosts = [];
      try {
        parsedPosts = typeof req.body.posts === 'string' ? JSON.parse(req.body.posts) : req.body.posts;
      } catch (e) {
        return res.status(400).json({ error: 'Invalid posts data.' });
      }
      for (let idx = 0; idx < parsedPosts.length; idx++) {
        const post = parsedPosts[idx];
        // Collect all photos and videos for this post by index
        const photoFiles = req.files.filter(f => f.fieldname === `posts[${idx}][photos]`);
        const videoFiles = req.files.filter(f => f.fieldname === `posts[${idx}][videos]`);
        let photoUrls = [];
        let videoUrls = [];
        for (const file of photoFiles) {
          if (!file.mimetype.startsWith('image/')) {
            return res.status(400).json({ error: 'All uploaded photos must be images.' });
          }
          await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream({ resource_type: 'image' }, (error, result) => {
              if (error) reject(error);
              else {
                photoUrls.push(result.secure_url);
                resolve();
              }
            }).end(file.buffer);
          });
        }
        for (const file of videoFiles) {
          if (!file.mimetype.startsWith('video/')) {
            return res.status(400).json({ error: 'All uploaded videos must be videos.' });
          }
          await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream({ resource_type: 'video' }, (error, result) => {
              if (error) reject(error);
              else {
                videoUrls.push(result.secure_url);
                resolve();
              }
            }).end(file.buffer);
          });
        }
        // Validate post title for trip experience (first post)
        if (idx === 0 && (!post.title || typeof post.title !== 'string' || post.title.trim().length < 2)) {
          return res.status(400).json({ error: 'Trip experience is required. Please fill out trip details.' });
        }
        // Save all trip experience details for first post
        if (idx === 0) {
          posts.push({
            title: post.title || '',
            description: post.description || '',
            destination: post.destination || '',
            date: post.date || '',
            budget: post.budget || '',
            activities: post.activities || '',
            food: post.food || '',
            special: post.special || '',
            practical: post.practical || '',
            transport: post.transport || '',
            accommodation: post.accommodation || '',
            bestTime: post.bestTime || '',
            photos: photoUrls.length > 0 ? photoUrls : post.photos || [],
            videos: videoUrls.length > 0 ? videoUrls : post.videos || [],
          });
        } else {
          posts.push({
            photos: photoUrls.length > 0 ? photoUrls : post.photos || [],
            videos: videoUrls.length > 0 ? videoUrls : post.videos || [],
          });
        }
      }
    }
    // If no posts or trip experience, reject profile creation
    if (posts.length === 0 || !posts[0].title || posts[0].title.trim().length < 2) {
      return res.status(400).json({ error: 'Trip experience is required. Please fill out trip details.' });
    }

    console.log('Parsed posts:', posts);
    const profileData = {
      name: req.body.fullName,
      email: req.body.email,
      phone: req.body.phone,
      bio: req.body.bio,
      location: req.body.address,
      profilePic: profilePicUrl,
      // Save all trip experience fields at top-level for reference
      tripTitle: req.body.tripTitle || (posts[0] && posts[0].title) || '',
      destination: req.body.destination || (posts[0] && posts[0].destination) || '',
      travelDates: req.body.travelDates || (posts[0] && posts[0].date) || '',
      duration: req.body.duration || '',
      activities: req.body.activities || '',
      food: req.body.food || '',
      special: req.body.special || '',
      practical: req.body.practical || '',
      transport: req.body.transport || '',
      accommodation: req.body.accommodation || '',
      budget: req.body.budget || (posts[0] && posts[0].budget) || '',
      bestTime: req.body.bestTime || '',
      posts,
    };
    const profile = new Profile(profileData);
    await profile.save();
    // Return all post details including Cloudinary URLs
    res.status(201).json({
      _id: profile._id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      bio: profile.bio,
      location: profile.location,
      profilePic: profile.profilePic,
      posts: profile.posts
    });
  } catch (err) {
    console.error('Error saving profile:', err);
    if (err && err.stack) {
      console.error('Stack trace:', err.stack);
    }
    if (err && err.message) {
      console.error('Error message:', err.message);
    }
    try {
      for (const key in err) {
        if (Object.prototype.hasOwnProperty.call(err, key)) {
          console.error(`Error property [${key}]:`, err[key]);
        }
      }
      console.error('Error as JSON:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    } catch (jsonErr) {
      console.error('Error could not be stringified:', jsonErr);
    }
    res.status(400).json({ error: err.message });
  }
});
// Get all profiles
router.get('/', async (req, res) => {
  try {
    const profiles = await Profile.find();
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Get single profile by ID, always return likedBy as emails (not names)
router.get('/:id', async (req, res) => {
  try {
    const profile = await Profile.findById(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    // Deep clone to avoid mutating DB doc
    const profileObj = JSON.parse(JSON.stringify(profile));
    const User = require('../models/User');
    // For each post, replace likedBy arrays in photoLikes/videoLikes with usernames
    if (Array.isArray(profileObj.posts)) {
      for (const post of profileObj.posts) {
        // Photo likes
        if (post.photoLikes) {
          for (const key of Object.keys(post.photoLikes)) {
            if (key.endsWith('likedBy') && Array.isArray(post.photoLikes[key])) {
              const emails = post.photoLikes[key];
              const users = await User.find({ email: { $in: emails } });
              const names = users.map(u => u.name);
              // Always set like count as the length of likedBy if missing or zero
              const idx = key.replace('likedBy', '');
              let likeCount = 0;
              if (post.photoLikes.hasOwnProperty(idx) && post.photoLikes[idx] > 0) {
                likeCount = post.photoLikes[idx];
              } else {
                likeCount = emails.length;
                post.photoLikes[idx] = likeCount;
              }
              post.photoLikes[key] = names;
            }
          }
        }
        // Video likes
        if (post.videoLikes) {
          for (const key of Object.keys(post.videoLikes)) {
            if (key.endsWith('likedBy') && Array.isArray(post.videoLikes[key])) {
              const emails = post.videoLikes[key];
              const users = await User.find({ email: { $in: emails } });
              const names = users.map(u => u.name);
              const idx = key.replace('likedBy', '');
              let likeCount = 0;
              if (post.videoLikes.hasOwnProperty(idx) && post.videoLikes[idx] > 0) {
                likeCount = post.videoLikes[idx];
              } else {
                likeCount = emails.length;
                post.videoLikes[idx] = likeCount;
              }
              post.videoLikes[key] = names;
            }
          }
        }
      }
    }
    res.json(profileObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

  // Like/unlike a post in a profile (toggle per user)
  const User = require('../models/User');
  router.post('/:id/posts/:postId/like', async (req, res) => {
    try {
      const profile = await Profile.findById(req.params.id);
      if (!profile) return res.status(404).json({ error: 'Profile not found' });
      const post = profile.posts.id(req.params.postId);
      if (!post) return res.status(404).json({ error: 'Post not found' });
      const user = req.body.user;
      if (!user) return res.status(400).json({ error: 'User required' });
      if (!post.likedBy) post.likedBy = [];
      const userIdx = post.likedBy.indexOf(user);
      if (userIdx === -1) {
        post.likedBy.push(user);
        post.likes = (post.likes || 0) + 1;
      } else {
        post.likedBy.splice(userIdx, 1);
        post.likes = Math.max(0, (post.likes || 1) - 1);
      }
      await profile.save();
      // Lookup user names for all emails in likedBy
      const users = await User.find({ email: { $in: post.likedBy } });
      const likedByNames = users.map(u => u.name);
      res.json({ likes: post.likes, likedBy: likedByNames });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });


  // Add a comment to a post in a profile (with user info)
  router.post('/:id/posts/:postId/comment', async (req, res) => {
    try {
      const profile = await Profile.findById(req.params.id);
      if (!profile) return res.status(404).json({ error: 'Profile not found' });
      const post = profile.posts.id(req.params.postId);
      if (!post) return res.status(404).json({ error: 'Post not found' });
      const { comment } = req.body;
      if (!comment || typeof comment !== 'object' || !comment.user || !comment.text) {
        return res.status(400).json({ error: 'Comment object with user and text required.' });
      }
      post.comments.push({ user: comment.user, text: comment.text });
      await profile.save();
      res.json({ comments: post.comments });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Like/unlike an image in a post (toggle per user)
  router.post('/:id/posts/:postId/photos/:photoIdx/like', async (req, res) => {
    try {
      const profile = await Profile.findById(req.params.id);
      if (!profile) return res.status(404).json({ error: 'Profile not found' });
      const post = profile.posts.id(req.params.postId);
      if (!post) return res.status(404).json({ error: 'Post not found' });
      const photoIdx = parseInt(req.params.photoIdx);
      if (!Array.isArray(post.photos) || photoIdx < 0 || photoIdx >= post.photos.length) {
        return res.status(404).json({ error: 'Photo not found' });
      }
      const user = req.body.user;
      if (!user) return res.status(400).json({ error: 'User required' });
      if (!post.photoLikes) post.photoLikes = {};
      if (!post.photoLikes[photoIdx]) post.photoLikes[photoIdx] = 0;
      if (!post.photoLikes[photoIdx + 'likedBy']) post.photoLikes[photoIdx + 'likedBy'] = [];
      const likedByArr = post.photoLikes[photoIdx + 'likedBy'];
      const userIdx = likedByArr.indexOf(user);
      if (userIdx === -1) {
        post.photoLikes[photoIdx] += 1;
        likedByArr.push(user);
      } else {
        post.photoLikes[photoIdx] = Math.max(0, post.photoLikes[photoIdx] - 1);
        likedByArr.splice(userIdx, 1);
      }
      await profile.save();
      // Lookup user names for all emails in likedByArr
      const User = require('../models/User');
      const users = await User.find({ email: { $in: likedByArr } });
      const likedByNames = users.map(u => u.name);
      res.json({ likes: post.photoLikes[photoIdx], likedBy: likedByNames });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add a comment to an image in a post
  router.post('/:id/posts/:postId/photos/:photoIdx/comment', async (req, res) => {
    try {
      const profile = await Profile.findById(req.params.id);
      if (!profile) return res.status(404).json({ error: 'Profile not found' });
      const post = profile.posts.id(req.params.postId);
      if (!post) return res.status(404).json({ error: 'Post not found' });
      const photoIdx = parseInt(req.params.photoIdx);
      if (!Array.isArray(post.photos) || photoIdx < 0 || photoIdx >= post.photos.length) {
        return res.status(404).json({ error: 'Photo not found' });
      }
      if (!post.photoComments) post.photoComments = {};
      if (!Array.isArray(post.photoComments[photoIdx])) post.photoComments[photoIdx] = [];
      const { comment } = req.body;
      if (!comment || typeof comment !== 'object' || !comment.user || !comment.text) {
        return res.status(400).json({ error: 'Comment object with user and text required.' });
      }
      post.photoComments[photoIdx].push({ user: comment.user, text: comment.text });
      await profile.save();
      res.json({ comments: post.photoComments[photoIdx] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Like/unlike a video in a post (toggle per user)
  router.post('/:id/posts/:postId/videos/:videoIdx/like', async (req, res) => {
    try {
      const profile = await Profile.findById(req.params.id);
      if (!profile) return res.status(404).json({ error: 'Profile not found' });
      const post = profile.posts.id(req.params.postId);
      if (!post) return res.status(404).json({ error: 'Post not found' });
      const videoIdx = parseInt(req.params.videoIdx);
      if (!Array.isArray(post.videos) || videoIdx < 0 || videoIdx >= post.videos.length) {
        return res.status(404).json({ error: 'Video not found' });
      }
      const user = req.body.user;
      if (!user) return res.status(400).json({ error: 'User required' });
      if (!post.videoLikes) post.videoLikes = {};
      if (!post.videoLikes[videoIdx]) post.videoLikes[videoIdx] = 0;
      if (!post.videoLikes[videoIdx + 'likedBy']) post.videoLikes[videoIdx + 'likedBy'] = [];
      const likedByArr = post.videoLikes[videoIdx + 'likedBy'];
      const userIdx = likedByArr.indexOf(user);
      if (userIdx === -1) {
        post.videoLikes[videoIdx] += 1;
        likedByArr.push(user);
      } else {
        post.videoLikes[videoIdx] = Math.max(0, post.videoLikes[videoIdx] - 1);
        likedByArr.splice(userIdx, 1);
      }
      await profile.save();
      // Lookup user names for all emails in likedByArr
      const User = require('../models/User');
      const users = await User.find({ email: { $in: likedByArr } });
      const likedByNames = users.map(u => u.name);
      res.json({ likes: post.videoLikes[videoIdx], likedBy: likedByNames });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Add a comment to a video in a post
  router.post('/:id/posts/:postId/videos/:videoIdx/comment', async (req, res) => {
    try {
      const profile = await Profile.findById(req.params.id);
      if (!profile) return res.status(404).json({ error: 'Profile not found' });
      const post = profile.posts.id(req.params.postId);
      if (!post) return res.status(404).json({ error: 'Post not found' });
      const videoIdx = parseInt(req.params.videoIdx);
      if (!Array.isArray(post.videos) || videoIdx < 0 || videoIdx >= post.videos.length) {
        return res.status(404).json({ error: 'Video not found' });
      }
      if (!post.videoComments) post.videoComments = {};
      if (!Array.isArray(post.videoComments[videoIdx])) post.videoComments[videoIdx] = [];
      const { comment } = req.body;
      if (!comment || typeof comment !== 'object' || !comment.user || !comment.text) {
        return res.status(400).json({ error: 'Comment object with user and text required.' });
      }
      post.videoComments[videoIdx].push({ user: comment.user, text: comment.text });
      await profile.save();
      res.json({ comments: post.videoComments[videoIdx] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
module.exports = router;