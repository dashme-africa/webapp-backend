const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const multer = require("multer");
const streamifier = require("streamifier");
const cloudinary = require("cloudinary").v2;
const axios = require("axios");
const db = require("../db");

require("dotenv").config();

const upload = multer();

// Cloudinary Configuration
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Example: Protected Profile Route
router.get("/profile", protect, async (req, res) => {
	// console.log(req.user)
	res.json(req.user);
});

router.put("/profile", protect, upload.single("image"), async (req, res) => {
	try {
		const {
			fullName,
			username,
			phoneNumber,
			city,
			state,
			country,
			bio,
			accountName,
			bankName,
			accountNumber,
		} = req.body;

		// console.log(req.body);

		// Validation for required fields
		if (!fullName || !username) {
			return res
				.status(400)
				.json({ message: "Please provide all required fields" });
		}

		let profilePicture;

		// Handle image upload
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
				streamifier.createReadStream(req.file.buffer).pipe(stream);
			});

			try {
				const result = await uploadPromise;
				profilePicture = result.secure_url; // Secure URL of the uploaded image.
			} catch (error) {
				console.error("Image upload failed:", error.message);
				return res
					.status(500)
					.json({ message: "Image upload failed", error: error.message });
			}
		}

		// Prepare the data to update
		const data = {
			fullName,
			username,
			// email,
			bio,
			city,
			state,
			country,
			accountName,
			bankName,
			accountNumber,
			phoneNumber,
		};

		if (profilePicture) {
			data.profilePicture = profilePicture;
		}

		// Set isVerified conditionally
		if (accountName && bankName && accountNumber) {
			data.isVerified = true; // Set to true only if all bank details are provided
		}

		// Update user in database
		const updatedUser = await db.user.update({
			data,
			where: { id: req.user.id },
		});

		// Send updated user data as response
		res.status(200).json(updatedUser);
	} catch (error) {
		console.error("Error updating profile:", error.message);
		res.status(500).json({ message: "Internal server error" });
	}
});

// Fetch bank list and cache it
let cachedBanks = [];
const fetchBanks = async () => {
	try {
		const response = await axios.get("https://api.paystack.co/bank", {
			headers: {
				Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
			},
		});
		cachedBanks = response.data.data || []; // Cache the bank list
		// console.log("Banks fetched successfully:", response.data.data); // Debugging
	} catch (error) {
		console.error("Error fetching bank list:", error.message);
	}
};

// Load bank list on server start
fetchBanks();

router.get("/banks", async (req, res) => {
	try {
		// Ensure the bank list is available
		if (!cachedBanks.length) {
			console.error("Bank list not available, fetching...");
			await fetchBanks(); // Refetch the bank list if empty
		}
		res.json(cachedBanks);
	} catch (error) {
		console.error("Error fetching bank list:", error.message);
		res.status(500).json({ error: "Server error" });
	}
});

// Endpoint to resolve account details
router.get("/resolve-account", async (req, res) => {
	const { account_number, bank_code } = req.query;

	// console.log(req.query);

	if (!account_number || !bank_code) {
		return res
			.status(400)
			.json({ error: "Account number and bank name are required" });
	}

	try {
		// Ensure the bank list is available
		// if (!cachedBanks.length) {
		// 	console.error("Bank list not available, fetching...");
		// 	await fetchBanks(); // Refetch the bank list if empty
		// }

		// // Find the bank code for the given bank name
		// const bank = cachedBanks.find(
		// 	(b) => b.name.toLowerCase() === bank_name.toLowerCase()
		// );

		// if (!bank) {
		// 	return res
		// 		.status(404)
		// 		.json({ error: "Bank not found. Please check the bank name." });
		// }

		// const bank_code = bank.code;

		// Resolve the account number with the bank code
		const response = await axios.get(
			`https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`,
			{
				headers: {
					Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
				},
			}
		);

		// console.log("Account resolved successfully:", response.data); // Debugging
		res.json(response.data);
	} catch (error) {
		console.error(
			"Error resolving account:",
			error.message,
			error.response?.data
		); // Debugging
		res
			.status(error.response?.status || 500)
			.json({ error: error.response?.data || "Server error" });
	}
});

module.exports = router;
