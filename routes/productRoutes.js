const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const multer = require('multer');
const User = require('../models/User');
const cloudinary = require('cloudinary').v2;
const Notification = require('../models/Notification');
const AdminNotification = require('../models/AdminNotification');

require('dotenv').config();

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const fileUploadMiddleware = upload.fields([
  { name: 'images', maxCount: 10 }, // Handle up to 10 images
  { name: 'video', maxCount: 1 },   // Handle a single video
]);

// @desc Get all products or filter by category
// @route GET /api/products
// @access Public
router.get('/', async (req, res) => {
  // console.log(req.query); // Optional: for debugging purposes
  try {
    const { category } = req.query; // Get the category from the query parameters
    const query = category ? { category } : {}; // If category exists, filter by it, else get all products

    // Fetch the products based on the query
    const products = await Product.find(query).populate('uploader', 'username email');
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @desc Get a product by ID
// @route GET /api/products/:id
// @access Public
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('uploader', 'username email _id profilePicture');

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json(product);
  } catch (error) {
    // If the error is due to an invalid ObjectId
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @desc Create a new product for sale
// @route POST /api/products
// @access Public
router.post('/', fileUploadMiddleware, async (req, res) => {
  const { title, description, category, price, priceCategory, location, uploader, primaryImageIndex } = req.body;

  if (!title || !category || !price || !uploader) {
    return res.status(400).json({ message: 'Please fill all required fields' });
  }

  if (!req.files || !req.files.images || req.files.images.length === 0) {
    return res.status(400).json({ message: 'Please upload at least one product image' });
  }

  if (req.files.images.length > 10) {
    return res.status(400).json({ message: 'You can upload a maximum of 10 images' });
  }

  // Validate image file sizes (10MB limit)
  const oversizedFiles = req.files.images.filter((file) => file.size > 10 * 1024 * 1024);
  if (oversizedFiles.length > 0) {
    return res.status(400).json({ message: 'Image file size should not exceed 10MB' });
  }

  if (primaryImageIndex === undefined || primaryImageIndex < 0 || primaryImageIndex >= req.files.images.length) {
    return res.status(400).json({ message: 'Please select a primary image for display' });
  }

  // Conditional video requirement for specific categories
  const videoRequiredCategories = ['Accessories', 'Household-Items', 'Electronics'];
  if (videoRequiredCategories.includes(category) && (!req.files.video || req.files.video.length === 0)) {
    return res.status(400).json({ message: 'Please upload a video for this category' });
  }

  if (req.files.video && req.files.video[0].size > 10 * 1024 * 1024) { // 10MB limit
    return res.status(400).json({ message: 'Video file size should not exceed 10MB' });
  }

  try {
    const user = await User.findById(uploader);
    if (!user) return res.status(404).json({ message: 'Uploader not found' });
    if (!user.isVerified) return res.status(403).json({ message: 'Verify your bank details first.' });

    // Upload images to Cloudinary
    const imageUploadPromises = req.files.images.map((file) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: 'image' },
          (error, result) => {
            // console.log('Upload response for images:', { error, result });
            if (error) reject(error);
            else resolve(result.secure_url);
          }
        );
        require('streamifier').createReadStream(file.buffer).pipe(stream);
      });
    });
    

    const uploadedImages = await Promise.all(imageUploadPromises);
    const primaryImage = uploadedImages[primaryImageIndex] || uploadedImages[0];

    // Upload video to Cloudinary (if video exists)
    let videoUrl = '';
    if (req.files.video) {
      const videoUploadPromise = new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: 'video' },
          (error, result) => {
            console.log('Upload response for video:', { error, result });
            if (error) reject(error);
            resolve(result.secure_url);
          }
        );
        require('streamifier').createReadStream(req.files.video[0].buffer).pipe(stream);
      });

      videoUrl = await videoUploadPromise;
    }

    // Create product document
    const product = new Product({
      title,
      description,
      category,
      price,
      priceCategory,
      images: uploadedImages,
      primaryImage,
      location,
      uploader,
      tag: 'For sale',
      availability: true,
      status: 'pending', // Default status
      videoUrl, // Add the video URL
    });

    const createdProduct = await product.save();

    res.status(201).json(createdProduct);

    // Create a notification for the uploader
    const notification = new Notification({
      userId: uploader,
      message: 'Your product would undergo review.',
      read: false,
      timestamp: new Date(),
    });
    await notification.save();

    // Create an admin notification
    await AdminNotification.create({
      type: 'product_pending',
      message: `A new product "${createdProduct.title}" is pending approval.`,
      productId: createdProduct._id,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @desc Create a new product to donate
// @route POST /api/products/donate
// @access Public
router.post('/donate', fileUploadMiddleware, async (req, res) => {
  const { title, description, category, location, uploader, primaryImageIndex } = req.body;

  if (!title || !category || !location || !uploader) {
    return res.status(400).json({ message: 'Please fill all required fields' });
  }

  if (!req.files || !req.files.images || req.files.images.length === 0) {
    return res.status(400).json({ message: 'Please upload at least one product image' });
  }

  if (req.files.images.length > 10) {
    return res.status(400).json({ message: 'You can upload a maximum of 10 images' });
  }

  if (primaryImageIndex === undefined || primaryImageIndex < 0 || primaryImageIndex >= req.files.images.length) {
    return res.status(400).json({ message: 'Please select a primary image for display' });
  }

  // Conditional video requirement for specific categories
  const videoRequiredCategories = ['Accessories', 'Household-Items', 'Electronics'];
  if (videoRequiredCategories.includes(category) && (!req.files.video || req.files.video.length === 0)) {
    return res.status(400).json({ message: 'Please upload a video for this category' });
  }

  if (req.files.video && req.files.video[0].size > 10 * 1024 * 1024) { // 10MB limit
    return res.status(400).json({ message: 'Video file size should not exceed 10MB' });
  }

  try {
    const user = await User.findById(uploader);
    if (!user) return res.status(404).json({ message: 'Uploader not found' });
    if (!user.isVerified) return res.status(403).json({ message: 'Verify your bank details first.' });

    // Upload images to Cloudinary
    const imageUploadPromises = req.files.images.map((file) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: 'image' },
          (error, result) => {
            if (error) reject(error);
            resolve(result.secure_url);
          }
        );
        require('streamifier').createReadStream(file.buffer).pipe(stream);
      });
    });

    const uploadedImages = await Promise.all(imageUploadPromises);
    const primaryImage = uploadedImages[primaryImageIndex] || uploadedImages[0];

    // Upload video to Cloudinary (if video exists)
    let videoUrl = '';
    if (req.files.video) {
      const videoUploadPromise = new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: 'video' },
          (error, result) => {
            if (error) reject(error);
            resolve(result.secure_url);
          }
        );
        require('streamifier').createReadStream(req.files.video[0].buffer).pipe(stream);
      });

      videoUrl = await videoUploadPromise;
    }

    // Create product document
    const product = new Product({
      title,
      description,
      category,
      images: uploadedImages,
      primaryImage,
      location,
      uploader,
      tag: 'Donate',
      availability: true,
      status: 'pending', 
      videoUrl, 
    });

    const createdProduct = await product.save();

    res.status(201).json(createdProduct);

    // Create a notification for the uploader
    const notification = new Notification({
      userId: uploader,
      message: 'Your product would undergo review.',
      read: false,
      timestamp: new Date(),
    });
    await notification.save();

    // Create an admin notification
    await AdminNotification.create({
      type: 'product_pending',
      message: `A new product "${createdProduct.title}" is pending approval.`,
      productId: createdProduct._id,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});



module.exports = router;


// router.patch('/:id/availability', async (req, res) => {
//   try {
//     const product = await Product.findById(req.params.id);
//     if (!product) {
//       return res.status(404).json({ message: 'Product not found' });
//     }

//     product.availability = !product.availability; // Toggle availability
//     const updatedProduct = await product.save();
//     res.status(200).json(updatedProduct);
//   } catch (error) {
//     res.status(500).json({ message: 'Server Error', error: error.message });
//   }
// });


