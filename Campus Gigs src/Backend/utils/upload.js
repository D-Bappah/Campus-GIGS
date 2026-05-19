const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
require('dotenv').config();

// 1. Configure Cloudinary with your .env credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 2. Configure the storage engine
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'campus_gigs_uploads', // All files will go into this folder in your Cloudinary dashboard
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'], // Restrict file types
    transformation: [{ width: 800, height: 800, crop: 'limit' }] // Auto-resize massive images
  }
});

// 3. Initialize Multer with the Cloudinary storage
const upload = multer({ storage: storage });

module.exports = upload;