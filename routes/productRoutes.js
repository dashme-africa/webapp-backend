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

// @desc Create a new product for sale
// @route POST /api/products
// @access Public
// router.post('/', upload.single('image'), async (req, res) => {
//   // console.log('Form data received:', req.body);
//   // console.log('Uploaded file:', req.file);

//   const { title, description, category, price, priceCategory, location, uploader } = req.body;

//   if (!title || !category || !price || !uploader) {
//     return res.status(400).json({
//       message: 'Please fill all required fields',
//     });
//   }

//   if (!req.file) {
//     return res.status(400).json({
//       message: 'Please add the product image',
//     });
//   }

//   try {
//     // Check if uploader exists and has verified bank details
//     const user = await User.findById(uploader);
//     // console.log(user)
//     if (!user) {
//       return res.status(404).json({ message: 'Uploader not found' });
//     }

//     if (!user.isVerified) {
//       return res.status(403).json({ message: 'Bank details not verified. Please verify your bank details to upload a product.' });
//     }

//     // Upload image to Cloudinary
//     let imageUrl = '';
//     if (req.file) {
//       const uploadPromise = new Promise((resolve, reject) => {
//         const stream = cloudinary.uploader.upload_stream(
//           { resource_type: 'image' },
//           (error, result) => {
//             if (error) {
//               reject(error);
//             }
//             resolve(result);
//           }
//         );

//         require('streamifier').createReadStream(req.file.buffer).pipe(stream);
//       });

//       try {
//         const result = await uploadPromise;
//         imageUrl = result.secure_url;
//         // console.log(imageUrl)
//       } catch (error) {
//         console.error(error);
//         return res.status(500).json({ message: 'Image upload failed', error: error.message });
//       }
//     }

//     // Create new product
//     const product = new Product({
//       title,
//       description,
//       category,
//       price,
//       priceCategory,
//       image: imageUrl,
//       location,
//       tag: 'For sale',
//       uploader,
//       availability: true,
//     });

//     // console.log('Product to be sold saved:', product);

//     const createdProduct = await product.save();
//     if (!createdProduct) {
//       return res.status(500).json({ message: 'Failed to create product' });
//     }
//     res.status(201).json(createdProduct);
//   } catch (error) {
//     res.status(500).json({ message: 'Server Error', error: error.message });
//   }
// });

// @desc Create a new product to donate
// @route POST /api/products/donate
// @access Public
// router.post('/donate', upload.single('image'), async (req, res) => {
//   // console.log('Form data received: Donated', req.body);
//   // console.log('Uploaded file: Donated', req.file);

//   const { title, description, category, location, uploader } = req.body;

//   if (!title || !category || !location || !uploader) {
//     return res.status(400).json({
//       message: 'Please fill all required fields',
//     });
//   }

//   if (!req.file) {
//     return res.status(400).json({
//       message: 'Please add the product image',
//     });
//   }

//   try {
//     // Check if uploader exists and has verified bank details
//     const user = await User.findById(uploader);
//     if (!user) {
//       return res.status(404).json({ message: 'Uploader not found' });
//     }
//     if (!user.isVerified) {
//       return res.status(403).json({ message: 'Bank details not verified. Please verify your bank details to donate a product.' });
//     }

//     // Upload image to Cloudinary
//     let imageUrl = '';
//     if (req.file) {
//       const uploadPromise = new Promise((resolve, reject) => {
//         const stream = cloudinary.uploader.upload_stream(
//           { resource_type: 'image' },
//           (error, result) => {
//             if (error) {
//               reject(error);
//             }
//             resolve(result);
//           }
//         );

//         require('streamifier').createReadStream(req.file.buffer).pipe(stream);
//       });

//       try {
//         const result = await uploadPromise;
//         imageUrl = result.secure_url;
//       } catch (error) {
//         console.error(error);
//         return res.status(500).json({ message: 'Image upload failed', error: error.message });
//       }
//     }

//     // Create new donation product
//     const product = new Product({
//       title,
//       description,
//       category,
//       image: imageUrl,
//       location,
//       tag: 'Donate',
//       uploader,
//       availability: true,
//     });

//     // console.log('Product to be donated saved:', product);

//     const createdProduct = await product.save();
//     if (!createdProduct) {
//       return res.status(500).json({ message: 'Failed to create product' });
//     }
//     res.status(201).json(createdProduct);
//   } catch (error) {
//     console.error('Error occurred:', error); // Logs the error to the console
//     res.status(500).json({ message: 'Internal Server Error', error: error.message });
//   }
// });

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

router.post('/', upload.array('images', 10), async (req, res) => {
  const { title, description, category, price, priceCategory, location, uploader, primaryImageIndex } = req.body;

  if (!title || !category || !price || !uploader) {
    return res.status(400).json({ message: 'Please fill all required fields' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: 'Please upload at least one product image' });
  }

  // Backend validation for maximum 10 images
  if (req.files.length > 10) {
    return res.status(400).json({ message: 'You can upload a maximum of 10 images' });
  }

  if (primaryImageIndex === undefined || primaryImageIndex < 0 || primaryImageIndex >= req.files.length) {
    return res.status(400).json({ message: 'Please select a primary image for display' });
  }

  try {
    const user = await User.findById(uploader);
    if (!user) return res.status(404).json({ message: 'Uploader not found' });
    if (!user.isVerified) return res.status(403).json({ message: 'Verify your bank details first.' });

    // Upload images to Cloudinary
    const imageUploadPromises = req.files.map((file) => {
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
    });

    const createdProduct = await product.save();

    res.status(201).json(createdProduct);

    console.log()

    // Create a notification after profile update
    const notification = new Notification({
      userId: uploader,
      message: 'Your product would undergo review.',
      read: false, // Mark as unread
      timestamp: new Date(),
    });
    await notification.save();  // Save notification to DB

    // Create admin notification
    await AdminNotification.create({
      type: 'product_pending',
      message: `A new product "${createdProduct.title}" is pending approval.`,
      productId: createdProduct._id,
    });

  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});


router.post('/donate', upload.array('images', 10), async (req, res) => {

  const { title, description, category, location, uploader, primaryImageIndex } = req.body;

  if (!title || !category || !location || !uploader) {
    return res.status(400).json({ message: 'Please fill all required fields' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: 'Please upload at least one product image' });
  }

  // Backend validation for maximum 10 images
  if (req.files.length > 10) {
    return res.status(400).json({ message: 'You can upload a maximum of 10 images' });
  }

  if (primaryImageIndex === undefined || primaryImageIndex < 0 || primaryImageIndex >= req.files.length) {
    return res.status(400).json({ message: 'Please select a primary image for display' });
  }

  try {
    const user = await User.findById(uploader);
    if (!user) return res.status(404).json({ message: 'Uploader not found' });
    if (!user.isVerified) return res.status(403).json({ message: 'Verify your bank details first.' });

    // Upload images to Cloudinary
    const imageUploadPromises = req.files.map((file) => {
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
      status: 'pending', // Default status
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
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


