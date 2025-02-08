const express = require("express");
const router = express.Router();
const { protectAdmin } = require("../middleware/adminMiddleware");
const multer = require("multer");
const db = require("../db");
const { Middleware, Controller } = require("../middleware/handlers");
const { AppError, ValidationError } = require("../middleware/exception");
const { ApiResponse, STATUS_CODE } = require("../middleware/response");
const { Validation } = require("../validation/inputs");
const cloudinary = require("cloudinary").v2;

require("dotenv").config();

// Cloudinary Configuration
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Get all products
router.get(
	"/",
	Middleware(protectAdmin),
	Controller(async (req, res) => {
		// const products = await Product.find({}).populate('uploader', 'username email phoneNumber');
		const products = await db.product.findMany({
			include: { user: { omit: { password: true } } },
		});

		return new ApiResponse(res, "Products fetched successfully", products);
	})
);

// Get a product by ID
router.get("/:id", Middleware(protectAdmin), async (req, res) => {
	const product = await db.product.findUnique({
		where: { id: req.params.id },
		include: { user: { omit: { password: true } } },
	});
	if (!product) {
		throw new AppError("Product not found", STATUS_CODE.NOT_FOUND);
	}

	return new ApiResponse(res, "Product fetched successfully", product);
});

// Delete a product
router.delete(
	"/:id",
	Middleware(protectAdmin),
	Controller(async (req, res) => {
		const product = await db.product.delete({ where: { id: req.params.id } });
		if (!product) {
			throw new AppError("Product not found", STATUS_CODE.NOT_FOUND);
		}

		return new ApiResponse(res, "Product deleted successfully");
	})
);

// Update a product
router.put("/:id", upload.single("image"), async (req, res) => {
	const { id } = req.params;

	if (!id)
		throw new AppError("Product ID is required", STATUS_CODE.BAD_REQUEST);

	const validate = Validation.editProduct.safeParse(req.body);

	if (!validate.success) throw new ValidationError(validate.error);

	const { title, description, category, price, priceCategory, location, tag } =
		validate.data;

	const product = await db.product.findUnique({
		where: { id },
	});

	if (!product) {
		throw new AppError("Product not found", STATUS_CODE.NOT_FOUND);
	}

	// Update fields if provided
	product.title = title || product.title;
	product.description = description || product.description;
	product.category = category || product.category;
	product.location = location || product.location;
	product.tag = tag || product.tag;

	// Only update price and priceCategory if the tag is not 'donate'
	if (tag !== "donate") {
		if (price !== undefined) product.price = +price;
		if (priceCategory !== undefined) product.priceCategory = priceCategory;
	}

	// Upload new image to Cloudinary if provided
	if (req.file) {
		const uploadPromise = new Promise((resolve, reject) => {
			const stream = cloudinary.uploader.upload_stream(
				{ resource_type: "image" },
				(error, result) => {
					if (error) {
						reject(error);
					}
					resolve(result);
				}
			);

			require("streamifier").createReadStream(req.file.buffer).pipe(stream);
		});

		try {
			const result = await uploadPromise;
			product.image = result.secure_url; // Update image URL in the product
		} catch (error) {
			console.error(`Error uploading image: ${error.message}`, error.message);
			throw new AppError(
				"Image upload failed",
				STATUS_CODE.INTERNAL_SERVER_ERROR
			);
		}
	}

	// const updatedProduct = await product.save();
	const { id: productID, ...data } = product;
	const updatedProduct = await db.product.update({
		data,
		where: { id },
	});

	return new ApiResponse(res, "Product updated successfully", updatedProduct);
});

// Update product status
router.put(
	"/:id/status",
	Middleware(protectAdmin),
	Controller(async (req, res) => {
		const { status } = req.body; // expected to be 'approved' or 'rejected'

		if (!["approved", "rejected"].includes(status)) {
			throw new ApiResponse("Invalid status value", STATUS_CODE.BAD_REQUEST);
		}

		// const product = await Product.findById(req.params.id);
		const product = await db.product.update({
			where: { id: req.params.id },
			data: { status },
		});

		if (!product) {
			throw new AppError("Product not found", STATUS_CODE.NOT_FOUND);
		}

		return new ApiResponse(res, `Product status updated to ${status}`, product);
	})
);

module.exports = router;
