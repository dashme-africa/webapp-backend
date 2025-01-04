const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const multer = require('multer');
const User = require('../models/User');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
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
const upload = multer();

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
// Direct upload handler
router.post('/', upload.fields([{ name: 'images', maxCount: 10 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
  const {
    title, description, category, price, priceCategory, location,
    uploader, primaryImageIndex, specification, condition,
  } = req.body;

  if (!title || !description || !category || !price || !priceCategory || !location || !specification || !condition) {
    return res.status(400).json({ message: 'Please fill all required fields' });
  }

  const images = req.files?.images || [];
  if (images.length === 0) return res.status(400).json({ message: 'Please upload at least one product image' });
  if (images.length > 10) return res.status(400).json({ message: 'You can upload a maximum of 10 images' });

  const oversizedFiles = images.filter((file) => file.size > 10 * 1024 * 1024);
  if (oversizedFiles.length > 0) {
    return res.status(400).json({ message: 'Image file size should not exceed 10MB' });
  }

  if (!primaryImageIndex || primaryImageIndex < 0 || primaryImageIndex >= images.length) {
    return res.status(400).json({ message: 'Please select a primary image for display' });
  }

  if (['Accessories', 'Household-Items', 'Electronics'].includes(category) && (!req.files?.video || req.files.video.length === 0)) {
    return res.status(400).json({ message: 'Please upload a video for this category' });
  }

  const video = req.files?.video?.[0];
  if (video && video.size > 10 * 1024 * 1024) {
    return res.status(400).json({ message: 'Video file size should not exceed 10MB' });
  }

  try {
    const user = await User.findById(uploader);
    if (!user) return res.status(404).json({ message: 'Uploader not found' });

    // Validate user profile
    if (!user.fullName || !user.username || !user.email || !user.address || !user.bio || !user.phoneNumber) {
      return res.status(403).json({ message: 'Please complete your profile info before uploading a product.' });
    }

    if (!user.isVerified) return res.status(403).json({ message: 'Verify your bank details first.' });

    // Upload images directly to Cloudinary
    const imageUploadPromises = images.map((file) => new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ resource_type: 'image' }, (err, result) => {
        if (err) reject(err);
        else resolve(result.secure_url);
      });
      streamifier.createReadStream(file.buffer).pipe(stream);
    }));

    const uploadedImages = await Promise.all(imageUploadPromises);
    const primaryImage = uploadedImages[primaryImageIndex];

    // Upload video directly to Cloudinary (if provided)
    let videoUrl = '';
    if (video) {
      const videoStream = new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ resource_type: 'video' }, (err, result) => {
          if (err) reject(err);
          else resolve(result.secure_url);
        });
        streamifier.createReadStream(video.buffer).pipe(stream);
      });
      videoUrl = await videoStream;
    }

    // Create product document
    const product = new Product({
      title, description, category, price, priceCategory,
      images: uploadedImages, primaryImage, location, uploader,
      tag: 'For sale', availability: true, status: 'pending',
      videoUrl, specification, condition,
    });

    const createdProduct = await product.save();

    res.status(201).json(createdProduct);

    // Create notifications
    await Notification.create({
      userId: uploader,
      message: 'Your product would undergo review.',
      read: false,
      timestamp: new Date(),
    });

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
router.post('/donate', upload.fields([{ name: 'images', maxCount: 10 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
  const {
    title, description, category, location,
    uploader, primaryImageIndex, specification, condition,
  } = req.body;

  if (!title || !description || !category || !location || !specification || !condition) {
    return res.status(400).json({ message: 'Please fill all required fields' });
  }

  const images = req.files?.images || [];
  if (images.length === 0) return res.status(400).json({ message: 'Please upload at least one product image' });
  if (images.length > 10) return res.status(400).json({ message: 'You can upload a maximum of 10 images' });

  const oversizedFiles = images.filter((file) => file.size > 10 * 1024 * 1024);
  if (oversizedFiles.length > 0) {
    return res.status(400).json({ message: 'Image file size should not exceed 10MB' });
  }

  if (!primaryImageIndex || primaryImageIndex < 0 || primaryImageIndex >= images.length) {
    return res.status(400).json({ message: 'Please select a primary image for display' });
  }

  if (['Accessories', 'Household-Items', 'Electronics'].includes(category) && (!req.files?.video || req.files.video.length === 0)) {
    return res.status(400).json({ message: 'Please upload a video for this category' });
  }

  const video = req.files?.video?.[0];
  if (video && video.size > 10 * 1024 * 1024) {
    return res.status(400).json({ message: 'Video file size should not exceed 10MB' });
  }

  try {
    const user = await User.findById(uploader);
    if (!user) return res.status(404).json({ message: 'Uploader not found' });

    // Validate user profile
    if (!user.fullName || !user.username || !user.email || !user.address || !user.bio || !user.phoneNumber) {
      return res.status(403).json({ message: 'Please complete your profile info before uploading a product.' });
    }

    if (!user.isVerified) return res.status(403).json({ message: 'Verify your bank details first.' });

    // Upload images directly to Cloudinary
    const imageUploadPromises = images.map((file) => new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ resource_type: 'image' }, (err, result) => {
        if (err) reject(err);
        else resolve(result.secure_url);
      });
      streamifier.createReadStream(file.buffer).pipe(stream);
    }));

    const uploadedImages = await Promise.all(imageUploadPromises);
    const primaryImage = uploadedImages[primaryImageIndex];

    // Upload video directly to Cloudinary (if provided)
    let videoUrl = '';
    if (video) {
      const videoStream = new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ resource_type: 'video' }, (err, result) => {
          if (err) reject(err);
          else resolve(result.secure_url);
        });
        streamifier.createReadStream(video.buffer).pipe(stream);
      });
      videoUrl = await videoStream;
    }

    // Create product document
    const product = new Product({
      title, description, category,
      images: uploadedImages, primaryImage, location, uploader,
      tag: 'Donate', availability: true, status: 'pending',
      videoUrl, specification, condition,
    });

    const createdProduct = await product.save();

    res.status(201).json(createdProduct);

    // Create notifications
    await Notification.create({
      userId: uploader,
      message: 'Your product would undergo review.',
      read: false,
      timestamp: new Date(),
    });

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


