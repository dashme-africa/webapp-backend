const express = require("express");
const router = express.Router();
const cloudinary = require("cloudinary").v2;
const db = require("../db");
const { Controller } = require("../middleware/handlers");
const { AppError } = require("../middleware/exception");
const { STATUS_CODE, ApiResponse } = require("../middleware/response");
const { profile } = require("console");
const { APPROVED_PRODUCTS } = require("../utils");

require("dotenv").config();

// Cloudinary Configuration
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Get all products or filter by category
router.get(
	"/",
	Controller(async (req, res) => {
		// console.log(req.query); // Optional: for debugging purposes
		const { category } = req.query; // Get the category from the query parameters
		// if (!category)
		// 	throw new AppError("Category is required", STATUS_CODE.BAD_REQUEST);

		const where = category ? { category: category } : {}; // If category exists, filter by it, else get all products

		// Fetch the products based on the query
		// const products = await Product.find(query).populate('uploader', 'username email');
		const products = await db.product.findMany({
			where: { AND: [where, APPROVED_PRODUCTS] },
			include: { user: { omit: { password: true } } },
			orderBy: { createdAt: "desc" },
		});

		return new ApiResponse(res, "", products);
	})
);

// Get a product by ID
router.get(
	"/:id",
	Controller(async (req, res) => {
		const product = await db.product.findFirst({
			where: { id: req.params.id },
			include: { user: { omit: { password: true } } },
		});

		if (!product) {
			throw new AppError("Product not found", STATUS_CODE.NOT_FOUND);
		}

		const relatedProducts = await db.product.findMany({
			where: { uploader: product.uploader, ...APPROVED_PRODUCTS },
		});

		return new ApiResponse(res, "", { ...product, relatedProducts });
	})
);

// Create a new product for sale
router.post(
	"/",
	Controller(async (req, res) => {
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
			throw new AppError(
				"Please fill all required fields",
				STATUS_CODE.BAD_REQUEST
			);
		}

		const imagesArray = images.split(", ");

		// Validate images
		if (!images || imagesArray.length === 0) {
			throw new AppError(
				"Please upload at least one product image",
				STATUS_CODE.BAD_GATEWAY
			);
		}

		if (imagesArray.length > 10) {
			throw new AppError(
				"You can upload a maximum of 10 images",
				STATUS_CODE.BAD_GATEWAY
			);
		}

		if (primaryImageIndex === null || primaryImageIndex === undefined) {
			throw new AppError(
				"Please select a primary image for display",
				STATUS_CODE.BAD_REQUEST
			);
		}

		// Ensure video is uploaded for specific categories
		if (
			["Accessories", "Household-Items", "Electronics"].includes(category) &&
			(!video || video === "")
		) {
			throw new AppError(
				"Please upload a video for this category",
				STATUS_CODE.BAD_REQUEST
			);
		}

		const user = await db.user.findUnique({ where: { id: uploader } });
		// const user = await User.findById(uploader);
		if (!user) throw new AppError("User not found", STATUS_CODE.NOT_FOUND);

		// Validate user profile
		if (
			!user.fullName ||
			!user.username ||
			!user.email ||
			!user.city ||
			!user.state ||
			!user.country ||
			!user.street ||
			!user.bio ||
			!user.phoneNumber
		) {
			throw new AppError(
				"Please complete your profile info before uploading a product.",
				STATUS_CODE.FORBIDDEN
			);
		}

		if (!user.isVerified)
			throw new AppError(
				"Verify your bank details first.",
				STATUS_CODE.FORBIDDEN
			);

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
				read: false,
			},
		});
		return new ApiResponse(
			res,
			"Product has been created and is awaiting approval",
			createdProduct,
			STATUS_CODE.CREATED
		);
	})
);

// Create a new product to donate
router.post(
	"/donate",
	Controller(async (req, res) => {
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
			throw new AppError(
				"Please fill all required fields",
				STATUS_CODE.BAD_REQUEST
			);
		}

		const imagesArray = images.split(", ");

		// Validate images
		if (!images || imagesArray.length === 0) {
			throw new AppError(
				"Please upload at least one product image",
				STATUS_CODE.BAD_REQUEST
			);
		}

		if (imagesArray.length > 10) {
			throw new AppError(
				"You can upload a maximum of 10 images",
				STATUS_CODE.BAD_REQUEST
			);
		}

		if (primaryImageIndex === null || primaryImageIndex === undefined) {
			throw new AppError(
				"Please select a primary image for display",
				STATUS_CODE.BAD_REQUEST
			);
		}

		// Ensure video is uploaded for specific categories
		if (
			["Accessories", "Household-Items", "Electronics"].includes(category) &&
			(!video || video === "")
		) {
			throw new AppError(
				"Please upload a video for this category",
				STATUS_CODE.BAD_REQUEST
			);
		}

		const user = await db.user.findUnique({ where: { id: uploader } });
		if (!user) throw new AppError("User not found", STATUS_CODE.NOT_FOUND);

		// Validate user profile
		if (
			!user.fullName ||
			!user.username ||
			!user.email ||
			!user.city ||
			!user.state ||
			!user.country ||
			!user.street ||
			!user.bio ||
			!user.phoneNumber
		) {
			throw new AppError(
				"Please complete your profile info before uploading a product.",
				STATUS_CODE.FORBIDDEN
			);
		}

		if (!user.isVerified)
			throw new AppError(
				"Verify your bank details first.",
				STATUS_CODE.FORBIDDEN
			);

		// Save product to the database
		const data = {
			title,
			description,
			category,
			images: imagesArray,
			primaryImage: imagesArray[primaryImageIndex],
			location,
			// uploader,
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
				read: false,
			},
		});
		return new ApiResponse(res, "Product has been created and is awaiting approval", createdProduct);
	})
);

module.exports = router;
