const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const router = express.Router();
const db = require("../db");
const { Controller } = require("../middleware/handlers");
const { STATUS_CODE, ApiResponse } = require("../middleware/response");
const { AppError } = require("../middleware/exception");

require("dotenv").config();

// Cached bank list
let cachedBanks = [];

// Fetch bank list and cache it
const fetchBanks = async () => {
	try {
		const response = await axios.get("https://api.paystack.co/bank", {
			headers: {
				Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
			},
		});
		cachedBanks = response.data.data || []; // Cache the bank list
		// console.log("Banks fetched successfully:", cachedBanks.length);
	} catch (error) {
		console.error("Error fetching bank list:", error.message);
	}
};

// Load bank list on server start
fetchBanks();

// Route to get seller details
router.get(
	"/seller/:sellerId",
	Controller(async (req, res) => {
		const { sellerId } = req.params;

		if (!sellerId)
			throw new AppError("Seller ID is required", STATUS_CODE.BAD_REQUEST);

		//   console.log(`Fetching bank details for sellerId: ${sellerId}`);

		const objectId = new mongoose.Types.ObjectId(sellerId);

		// const seller = await User.findOne({ _id: objectId });
		const seller = await db.user.findFirst({ where: { id: sellerId } });

		if (!seller) {
			throw new AppError("Seller not found", STATUS_CODE.NOT_FOUND);
		}

		// console.log(`Seller found: ${seller}`);
		return new ApiResponse(res, "Seller details fetched successfully", seller);
	})
);

// Route to get seller bank details
router.get(
	"/seller/:sellerId/bank-details",
	Controller(async (req, res) => {
		const { sellerId } = req.params;

		if (!sellerId)
			throw new AppError("Seller ID is required", STATUS_CODE.BAD_REQUEST);

		//   console.log(`Fetching bank details for sellerId: ${sellerId}`);
		const objectId = new mongoose.Types.ObjectId(sellerId);

		// const seller = await User.findOne({ _id: objectId });
		const seller = await db.user.findFirst({ where: { id: sellerId } });

		if (!seller) {
			throw new AppeError("Seller not found", STATUS_CODE.NOT_FOUND);
		}

		const { bankName, accountNumber, accountName } = seller;

		if (!bankName || !accountNumber || !accountName) {
			throw new AppError(
				"Incomplete bank details for the seller.",
				STATUS_CODE.BAD_REQUEST
			);
		}
		return new ApiResponse(res, "Seller bank details fetched successfully", {
			bankName,
			accountNumber,
			accountName,
		});
	})
);

// Route to create a subaccount
router.post(
	"/subaccount",
	Controller(async (req, res) => {
		// TODO - Implement validation for the request body
		const { businessName, bankName, accountNumber, percentageCharge } =
			req.body;

		//   console.log(req.body);

		try {
			// Ensure the bank list is available
			if (!cachedBanks.length) {
				//   console.log("Bank list not available, fetching...");
				await fetchBanks();
			}

			// Find the bank code for the given bank name
			const bank = cachedBanks.find(
				(b) => b.name.toLowerCase() === bankName.toLowerCase()
			);

			if (!bank) {
				throw new AppError(
					"Bank not found. Please check the bank name.",
					STATUS_CODE.NOT_FOUND
				);
			}

			const bankCode = bank.code;

			// Create subaccount
			const response = await axios.post(
				"https://api.paystack.co/subaccount",
				{
					business_name: businessName,
					bank_code: bankCode,
					account_number: accountNumber,
					percentage_charge: percentageCharge,
				},
				{
					headers: {
						Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
						"Content-Type": "application/json",
					},
				}
			);

			console.log(response.data);
			return new ApiResponse(
				res,
				"Subaccount created successfully",
				response.data,
				STATUS_CODE.CREATED
			);
		} catch (error) {
			console.error(
				"Error creating subaccount:",
				error.response?.data || error.message
			);
			throw new AppError(
				"Failed to create subaccount",
				STATUS_CODE.INTERNAL_SERVER_ERROR,
				error.response?.data
			);
		}
	})
);

// Route to initialize transaction
router.post(
	"/initialize-transaction",
	Controller(async (req, res) => {
		// TODO - add input validation
		const {
			email,
			amount,
			subaccount,
			transaction_charge,
			redis_key,
			rate_id,
			rate_amount,
			product_id,
			quantity,
			product_amount,
			seller_id,
			user_id,
		} = req.body;

		try {
			// Ensure all required fields are provided
			if (!email || !amount || !subaccount || !redis_key || !rate_id) {
				throw new AppError(
					"Required fields are missing",
					STATUS_CODE.BAD_REQUEST
				);
			}

			const order = await db.order.create({
				data: {
					buyerEmail: email,
					amount,
					subaccount,
					transactionCharge: transaction_charge,
					redisKey: redis_key,
					rateId: rate_id,
					rateAmount: rate_amount,
					productId: product_id,
					quantity,
					productAmount: product_amount,
					sellerId: seller_id,
					userId: user_id,
				},
			});

			// Transaction split logic
			const response = await axios.post(
				"https://api.paystack.co/transaction/initialize",
				{
					email, // Buyer's email
					amount, // Total amount (in kobo, so multiply Naira by 100)
					subaccount: subaccount, // Seller's Paystack subaccount
					transaction_charge, // Platform's 10% charge
					bearer: "subaccount", // Ensures seller bears the transaction charge
					callback_url: `${process.env.FRONTEND_URL_PRODUCTION}/confirmationPage`, // Redirect URL after payment completion
					metadata: {
						redis_key, // Store redis_key in metadata
						rate_id, // Store rate_id in metadata
						rate_amount,
						order_id: order.id, // Store order ID in metadata
					},
				},
				{
					headers: {
						Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
						"Content-Type": "application/json",
					},
				}
			);

			// console.log("initi", response.data);
			return new ApiResponse(res, "", response.data);
		} catch (error) {
			console.error(
				"Error initializing transaction:",
				error.response?.data || error.message
			);
			throw new AppError(
				`Failed to initialize transaction: ${error.message}`,
				error.response?.data
			);
		}
	})
);

module.exports = router;
