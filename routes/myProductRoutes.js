const express = require("express");
const router = express.Router();
const db = require("../db");
const { Controller } = require("../middleware/handlers");
const { STATUS_CODE, ApiResponse } = require("../middleware/response");
const { AppError } = require("../middleware/exception");
const cloudinary = require("cloudinary").v2;

require("dotenv").config();

// Cloudinary Configuration
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

router.get(
	"/",
	Controller(async (req, res) => {
		const { uploader } = req.query;
		// console.log("Uploader Query Param:", uploader);

		if (!uploader) {
			throw new AppError("Uploader ID is required", STATUS_CODE.BAD_REQUEST);
		}

		const myProducts = await db.product.findMany({ where: { uploader } });

		if (!myProducts) {
			return res
				.status(404)
				.json({ message: "No products found for this uploader" });
		}

		return new ApiResponse(res, "Products retrieved successfully", myProducts);
	})
);

router.put(
	"/:id",
	Controller(async (req, res) => {
		const { id } = req.params;
		if (!id)
			throw new AppError("Product ID is required", STATUS_CODE.BAD_REQUEST);

		// ⚠️ TODO - Add validation for the request body
		const updates = req.body;

		const updatedProduct = await db.product.update({
			where: { id },
			data: updates,
		});
		if (!updatedProduct) {
			throw new AppError("Product not found", STATUS_CODE.NOT_FOUND);
		}
		return new ApiResponse(res, "Product updated successfully", updatedProduct);
	})
);

router.delete(
	"/delete/:id",
	Controller(async (req, res) => {
		const { id } = req.params;
		if (!id)
			throw new AppError("Product ID is required", STATUS_CODE.BAD_REQUEST);

		const deletedProduct = await db.product.delete({ where: { id } });
		if (!deletedProduct) {
			throw new AppError("Product not found", STATUS_CODE.NOT_FOUND);
		}

		return new ApiResponse(res, "Product deleted successfully", deletedProduct);
	})
);

module.exports = router;
