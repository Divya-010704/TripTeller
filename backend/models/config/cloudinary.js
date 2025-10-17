const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dcbpp7dmc',
  api_key: process.env.CLOUDINARY_API_KEY || '925498214576211',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'ONn51_8VsoxTvO6Z6AW5v1X6OfE'
});
module.exports = cloudinary;