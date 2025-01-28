const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const User = require("../models/User");
const cloudinary = require("cloudinary").v2;
const Notification = require("../models/Notification");
const AdminNotification = require("../models/AdminNotification");
const db = require("../db");

require("dotenv").config();

// Cloudinary Configuration
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Get all products or filter by category
router.get("/", async (req, res) => {
	// console.log(req.query); // Optional: for debugging purposes
	try {
		const { category } = req.query; // Get the category from the query parameters
		// const query = category ? { category } : {}; // If category exists, filter by it, else get all products
		const where = category ? { category: category } : {}; // If category exists, filter by it, else get all products

		// Fetch the products based on the query
		// const products = await Product.find(query).populate('uploader', 'username email');
		const products = await db.product.findMany({
			where,
			include: { user: {} },
		});

		res.status(200).json(products);
	} catch (error) {
		res.status(500).json({ message: "Server Error", error: error.message });
	}
});

// Get a product by ID
router.get("/:id", async (req, res) => {
	try {
		// const product = await Product.findById(req.params.id).populate(
		// 	"uploader",
		// 	"username email _id profilePicture"
		// );
		const product = await db.product.findFirst({
			where: { id: req.params.id },
			include: { user: true },
		});

		if (!product) {
			return res.status(404).json({ message: "Product not found" });
		}

		res.status(200).json(product);
	} catch (error) {
		// If the error is due to an invalid ObjectId
		if (error.kind === "ObjectId") {
			return res.status(404).json({ message: "Product not found" });
		}
		res.status(500).json({ message: "Server Error", error: error.message });
	}
});

// Create a new product for sale
router.post("/", async (req, res) => {
	const {
		title,
		description,
		category,
		price,
		priceCategory,
		location,
		uploader,
		primaryImageIndex,
		specification,
		condition,
		images,
		video,
	} = req.body;

	// Validation for required fields
	if (
		!title ||
		!description ||
		!category ||
		!price ||
		!priceCategory ||
		!location ||
		!specification ||
		!condition
	) {
		return res.status(400).json({ message: "Please fill all required fields" });
	}

	const imagesArray = images.split(", ");

	// Validate images
	if (!images || imagesArray.length === 0) {
		return res
			.status(400)
			.json({ message: "Please upload at least one product image" });
	}

	if (imagesArray.length > 10) {
		return res
			.status(400)
			.json({ message: "You can upload a maximum of 10 images" });
	}

	if (primaryImageIndex === null || primaryImageIndex === undefined) {
		return res
			.status(400)
			.json({ message: "Please select a primary image for display" });
	}

	// Ensure video is uploaded for specific categories
	if (
		["Accessories", "Household-Items", "Electronics"].includes(category) &&
		(!video || video === "")
	) {
		return res
			.status(400)
			.json({ message: "Please upload a video for this category" });
	}

	try {
		const user = await db.user.findUnique({ where: { id: uploader } });
		// const user = await User.findById(uploader);
		if (!user) return res.status(404).json({ message: "Uploader not found" });

		// Validate user profile
		if (
			!user.fullName ||
			!user.username ||
			!user.email ||
			!user.city ||
			!user.state ||
			!user.country ||
			!user.bio ||
			!user.phoneNumber
		) {
			return res.status(403).json({
				message:
					"Please complete your profile info before uploading a product.",
			});
		}

		if (!user.isVerified)
			return res
				.status(403)
				.json({ message: "Verify your bank details first." });

		// Save product to the database
		const data = {
			title,
			description,
			category,
			price: +price,
			priceCategory,
			images: imagesArray,
			primaryImage: imagesArray[parseInt(primaryImageIndex)],
			location,
			// uploader,
			tag: "For sale",
			availability: true,
			status: "pending",
			videoUrl: video || "",
			specification,
			condition,
			user: { connect: { id: uploader } },
		};

		const createdProduct = await db.product.create({ data });

		// Respond with the newly created product
		res.status(201).json(createdProduct);

		// Create notifications
		await db.notification.create({
			data: {
				userId: uploader,
				message: "Your product would undergo review.",
				read: false,
				// timestamp: new Date(),
			},
		});

		await db.adminNotification.create({
			data: {
				type: "product_pending",
				message: `A new product "${createdProduct.title}" is pending approval.`,
				productId: createdProduct.id,
			},
		});
	} catch (error) {
		console.log(error);

		res.status(500).json({ message: "Server Error", error: error.message });
	}
});

// Create a new product to donate
router.post("/donate", async (req, res) => {
	const {
		title,
		description,
		category,
		location,
		uploader,
		primaryImageIndex,
		specification,
		condition,
		images,
		video,
	} = req.body;

	// Validation for required fields
	if (
		!title ||
		!description ||
		!category ||
		!location ||
		!specification ||
		!condition
	) {
		return res.status(400).json({ message: "Please fill all required fields" });
	}

	const imagesArray = images.split(", ");

	// Validate images
	if (!images || imagesArray.length === 0) {
		return res
			.status(400)
			.json({ message: "Please upload at least one product image" });
	}

	if (imagesArray.length > 10) {
		return res
			.status(400)
			.json({ message: "You can upload a maximum of 10 images" });
	}

	if (primaryImageIndex === null || primaryImageIndex === undefined) {
		return res
			.status(400)
			.json({ message: "Please select a primary image for display" });
	}

	// Ensure video is uploaded for specific categories
	if (
		["Accessories", "Household-Items", "Electronics"].includes(category) &&
		(!video || video === "")
	) {
		return res
			.status(400)
			.json({ message: "Please upload a video for this category" });
	}

	try {
		const user = await User.findById(uploader);
		if (!user) return res.status(404).json({ message: "Uploader not found" });

		// Validate user profile
		if (
			!user.fullName ||
			!user.username ||
			!user.email ||
			!user.city ||
			!user.state ||
			!user.country ||
			!user.bio ||
			!user.phoneNumber
		) {
			return res.status(403).json({
				message:
					"Please complete your profile info before uploading a product.",
			});
		}

		if (!user.isVerified)
			return res
				.status(403)
				.json({ message: "Verify your bank details first." });

		// Save product to the database
		const data = {
			title,
			description,
			category,
			images: imagesArray,
			primaryImage: imagesArray[primaryImageIndex],
			location,
			uploader,
			tag: "Donate",
			availability: true,
			status: "pending",
			videoUrl: video,
			specification,
			condition,
			user: { connect: { id: uploader } },
		};

		const createdProduct = await db.product.create({ data });

		// Respond with the newly created product
		res.status(201).json(createdProduct);

		// Create notifications
		await db.notification.create({
			data: {
				userId: uploader,
				message: "Your product would undergo review.",
				read: false,
				// timestamp: new Date(),
			},
		});

		await db.adminNotification.create({
			data: {
				type: "product_pending",
				message: `A new product "${createdProduct.title}" is pending approval.`,
				productId: createdProduct.id,
			},
		});
	} catch (error) {
		res.status(500).json({ message: "Server Error", error: error.message });
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
