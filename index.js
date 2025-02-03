const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const axios = require("axios");
const path = require("path");

const productRoutes = require("./routes/productRoutes");
const userRoutes = require("./routes/userRoutes");
const userProfileRoutes = require("./routes/userProfileRoutes");
const adminRoutes = require("./routes/adminRoutes");
const adminDashboardRoutes = require("./routes/adminDashboardRoutes");
const adminProductRoutes = require("./routes/adminProductRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const myProductRoutes = require("./routes/myProductRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const adminNotificationRoutes = require("./routes/adminNotificationRoutes");
const { protect } = require("./middleware/authMiddleware");
const env = require("./env");
const db = require("./db");
const { errorHandler, AppError } = require("./middleware/exception");
const { Controller, Middleware } = require("./middleware/handlers");
const { STATUS_CODE, ApiResponse } = require("./middleware/response");

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 5000;

// CORS Configuration
const allowedOrigins = env.CORS_ORIGINS?.split(",");

const corsOptions = {
	origin: (origin, callback) => {
		if (
			!origin ||
			allowedOrigins.includes(origin) ||
			allowedOrigins.includes("*")
		) {
			callback(null, true);
		} else {
			callback(new Error(`CORS policy error: ${origin} is not allowed.`));
		}
	},
	methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
	allowedHeaders: ["Content-Type", "Authorization"],
	credentials: true,
	maxAge: 3600, // Add this option to specify the maximum age of the CORS configuration
};

app.use(cors(corsOptions));

// Serve static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Base API Endpoint
app.get(
	"/",
	Controller((req, res) => res.send("API is running..."))
);

// Admin Routes
app.use("/api/adminDashboard", adminDashboardRoutes);
app.use("/api/adminProduct", adminProductRoutes);
app.use("/api/admin", adminRoutes);

// User Routes
app.use("/api/products", productRoutes);
app.use("/api/userProfile", userProfileRoutes);
app.use("/api/users", userRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/myProducts", myProductRoutes);
app.use("/api/notify", notificationRoutes);
app.use("/api/notifyAdmin", adminNotificationRoutes);

// Get available couriers based on type
app.get(
	"/api/couriers",
	Controller(async (req, res) => {
		const { type } = req.query;

		if (!type)
			return res
				.status(400)
				.json({ error: "Type query parameter is required." });

		try {
			const response = await axios.get(
				`${process.env.GOSHIIP_BASE_URL}/shipments/courier-partners/`,
				{
					headers: { Authorization: `Bearer ${process.env.GOSHIIP_API_KEY}` },
					params: { type },
				}
			);

			res.status(200).json(response.data);
		} catch (error) {
			console.dir(
				"Error fetching couriers:",
				error.response?.data || error.message
			);

			throw new AppError(
				error.response?.data?.message || error.message,
				error.response?.status || STATUS_CODE.INTERNAL_SERVER_ERROR
			);
		}
	})
);

// Define constant parcels data
const CONSTANT_PARCELS = {
	weight: 5,
	length: 10,
	width: 10,
	height: 5,
};

// Get single rate for a specific courier
app.post(
	"/api/rates",
	Controller(async (req, res) => {
		const { carrierName, type, toAddress, fromAddress, parcels, items } =
			req.body;

		// console.log(req.body);
		if (
			!carrierName ||
			!type ||
			!toAddress ||
			!fromAddress ||
			!parcels ||
			!items
		) {
			throw new AppError("Missing required fields", STATUS_CODE.BAD_REQUEST);
		}
		if (!toAddress.name || toAddress.name.trim() === "") {
			throw new AppError("Name is required.", STATUS_CODE.BAD_REQUEST);
		}

		if (!toAddress.phone || !/^0\d{10}$/.test(toAddress.phone)) {
			throw new AppError(
				"Invalid phone number. Please enter 11 digits starting with 0.",
				STATUS_CODE.BAD_REQUEST
			);
		}

		if (
			!toAddress.email ||
			!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(toAddress.email)
		) {
			throw new AppError("Invalid email address", STATUS_CODE.BAD_REQUEST);
		}

		if (!toAddress.address || toAddress.address.trim() === "") {
			throw new AppError("Address is required.", STATUS_CODE.BAD_REQUEST);
		}

		try {
			const response = await axios.post(
				`${env.GOSHIIP_BASE_URL}/tariffs/getpricesingle/${carrierName}`,
				{
					type,
					toAddress,
					fromAddress,
					parcels: CONSTANT_PARCELS,
					items,
				},
				{
					headers: {
						Authorization: `Bearer ${process.env.GOSHIIP_API_KEY}`,
						"Content-Type": "application/json",
					},
				}
			);

			return new ApiResponse(res, "Rates fetched successfully", response.data);

			// console.log(response.data);
		} catch (error) {
			console.error("Error fetching couriers:", error);

			if (error.response?.status === 400) {
				// Handle validation errors
				console.error("Validation error:", error.response?.data);
				throw new AppError(
					"Validation error",
					STATUS_CODE.BAD_REQUEST,
					error.response?.data
				);
			} else if (error.response?.status === 401) {
				// Handle authentication errors
				console.error("Authentication error:", error.response?.data);
				throw new AppError(
					"Authentication error",
					STATUS_CODE.UNAUTHORIZED,
					error.response?.data
				);
			} else if (error.response?.status === 429) {
				// Handle rate limit errors
				console.error("Rate limit exceeded:", error.response?.data);

				throw new AppError(
					"Rate limit exceeded",
					STATUS_CODE.TOO_MANY_REQUESTS,
					error.response?.data
				);
			} else if (error.response?.data?.rates?.status === false) {
				// Handle Goshiip API error cases
				const errorMessage = error.response?.data?.rates?.message;
				if (errorMessage.includes('Undefined array key "distance"')) {
					throw new AppError(
						"Invalid address. Please enter a valid address.",
						STATUS_CODE.BAD_REQUEST
					);
				} else if (
					errorMessage.includes(
						"Truq cannot service this shipment because of the weight."
					)
				) {
					throw new AppError(
						"Invalid shipment weight. Truq cannot service this shipment because of the weight.",
						STATUS_CODE.BAD_REQUEST
					);
				} else {
					throw new AppError(
						`Goshiip API error ${errorMessage}`,
						STATUS_CODE.BAD_REQUEST,
						errorMessage
					);
				}
			} else {
				// Handle generic errors
				console.error("Error fetching couriers:", error);

				throw new AppError(
					`Failed to fetch couriers ${
						error.response?.data?.message || error.message
					}`,
					error.response?.status || STATUS_CODE.INTERNAL_SERVER_ERROR
				);
			}
		}
	})
);

// Verification payment route
app.get(
	"/api/verify-transaction/:reference",
	Controller(async (req, res) => {
		const { reference } = req.params;

		try {
			// console.log(
			// 	`Starting transaction verification for reference: ${reference}`
			// );

			// Verify the Paystack transaction
			const response = await axios.get(
				`https://api.paystack.co/transaction/verify/${reference}`,
				{
					headers: {
						Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
					},
				}
			);

			// console.log("Transaction verification response:", response.data);

			// Ensure the transaction was successful
			if (response.data.data.status === "success") {
				const transactionData = response.data.data;
				// console.log("Transaction data:", transactionData);

				const { redis_key, rate_id, order_id } = transactionData.metadata;
				// Create and save the transaction
				const newTransaction = {
					transactionId: transactionData.id,
					reference: transactionData.reference,
					amount: transactionData.amount,
					orderId: order_id,
					currency: transactionData.currency,
					status: transactionData.status,
					customerEmail: transactionData.customer.email,
					paymentMethod: transactionData.channel,
					paidAt: transactionData.paid_at,
					gatewayResponse: transactionData.gateway_response,
				};
				try {
					// await newTransaction.save();
					await db.transaction.create({ data: newTransaction });
					// Update the Order with the transactionId
					// await Order.findOneAndUpdate(
					// 	{ _id: order_id },
					// 	{ $set: { transactionReference: transactionData.reference } },
					// 	{ new: true }
					// );
					await db.order.update({
						where: { id: order_id },
						data: { transactionReference: transactionData.reference },
					});
					// console.log("Order updated with transactionId");
				} catch (error) {
					console.error(
						"Error saving transaction and updating order with transactionId:",
						error
					);
				}

				// Prepare the booking payload
				const bookingPayload = {
					redis_key,
					rate_id,
					user_id: process.env.GOSHIP_USER_ID,
					platform: "web2",
					delivery_note: "Your delivery is on the way",
				};

				// console.log("Booking payload:", bookingPayload);

				let bookingResponse = null;

				try {
					// Make the booking API request
					// console.log("Sending booking request...");
					bookingResponse = await axios.post(
						`${process.env.GOSHIIP_BASE_URL}/bookshipment`,
						bookingPayload,
						{
							headers: {
								Authorization: `Bearer ${process.env.GOSHIIP_API_KEY}`,
							},
						}
					);

					// console.log("Booking response:", bookingResponse.data);

					// Check if booking was successful
					if (bookingResponse.data.status) {
						const shipmentId = bookingResponse.data.data.shipmentId; // Get the shipment ID
						const shipmentReference = bookingResponse.data.data.reference;
						// console.log(`Booking successful. Shipment ID: ${shipmentReference}`);

						try {
							// Update the Order with the shipmentId
							await db.order.update({
								where: { id: order_id },
								data: { shipmentReference },
							});
							// console.log("Order updated with shipmentReference");
						} catch (error) {
							console.error(
								"Error updating order with shipmentReference:",
								error
							);
						}

						try {
							// Trigger the Assign API with shipment_id in the body
							// console.log(`Triggering Assign API for shipment ID: ${shipmentId}`);
							const assignPayload = {
								shipment_id: shipmentId,
							};

							const assignResponse = await axios.post(
								`${process.env.GOSHIIP_BASE_URL}/shipment/assign`,
								assignPayload,
								{
									headers: {
										Authorization: `Bearer ${process.env.GOSHIIP_API_KEY}`,
									},
								}
							);

							// console.log("Assign response:", assignResponse.data);

							// Handle assign response
							if (assignResponse.status === 200) {
								// console.log("Shipment assignment successful.");
								return new ApiResponse(
									res,
									"Payment verified, shipment booked, and assignment successful.",
									{
										transactionDetails: {
											amount: transactionData.amount,
											status: transactionData.status,
											paymentMethod: transactionData.channel,
											currency: transactionData.currency,
											paidAt: transactionData.paid_at,
											shipmentId, // Return shipmentId instead of shipmentReference
										},
										bookingStatus: bookingResponse.data.message,
										assignStatus: assignResponse.data.message,
									}
								);
							} else {
								// console.log("Assignment failed:", assignResponse.data.message);
								return new ApiResponse(
									res,
									"Shipment booked but assignment failed.",
									{
										assignStatus: assignResponse.data.message,
									},
									null,
									assignResponse.status
								);
							}
						} catch (error) {
							console.error(
								"Error assigning shipment:",
								error.response ? error.response.data : error.message
							);
							throw new AppError(
								`Shipment booked, but failed to trigger assignment. ${error.message}`,
								STATUS_CODE.INTERNAL_SERVER_ERROR,
								error
							);
						}
					} else {
						// console.log("Booking failed:", bookingResponse.data.message);
						throw new AppError(
							`Booking failed. ${bookingResponse.data.message}`,
							STATUS_CODE.BAD_REQUEST
						);
					}
				} catch (error) {
					console.error(
						"Error booking shipment:",
						error.response ? error.response.data : error.message
					);

					throw new AppError(
						`Error occurred during booking process. ${error.message}`,
						STATUS_CODE.INTERNAL_SERVER_ERROR,
						error
					);
				}
			} else {
				console.log(
					"Transaction verification failed:",
					response.data.data.status
				);
				throw new AppError(
					"Transaction verification failed",
					STATUS_CODE.BAD_REQUEST
				);
			}
		} catch (err) {
			console.error("Error verifying transaction:", err.message);
			throw new AppError(
				`Error verifying transaction: ${err.message}`,
				STATUS_CODE.INTERNAL_SERVER_ERROR
			);
		}
	})
);

// Get Transaction by reference
app.get(
	"/api/transaction/verify/:reference",
	Controller(async (req, res) => {
		const { reference } = req.params;

		// Validate the reference parameter
		if (!reference || reference.trim() === "") {
			throw new AppError("Reference is required", STATUS_CODE.BAD_REQUEST);
		}

		// Retrieve the transaction
		// const transaction = await Transaction.findOne({ reference });
		const transaction = await db.transaction.findFirst({
			where: { reference },
		});

		if (!transaction)
			throw new AppError("Transaction not found", STATUS_CODE.NOT_FOUND);

		// Format the transaction data
		const formattedTransaction = {
			transactionId: transaction.transactionId,
			reference: transaction.reference,
			amount: transaction.amount,
			currency: transaction.currency,
			status: transaction.status,
			customerEmail: transaction.customerEmail,
			paymentMethod: transaction.paymentMethod,
			paidAt: transaction.paidAt,
		};

		return new ApiResponse(
			res,
			"Transaction retrieved successfully",
			formattedTransaction
		);
	})
);

// Get all Transactions
app.get(
	"/api/transactions",
	Middleware(protect),
	Controller(async (req, res) => {
		// Replace with the logged-in user's email or ID
		const customerEmail = req.user.email;

		if (!customerEmail)
			throw new AppError("You are not logged in", STATUS_CODE.UNAUTHORIZED);

		const transactions = await db.transaction.findMany({
			where: { customerEmail },
			orderBy: { paidAt: "desc" },
		});

		if (!transactions.length) {
			throw new AppError(
				"No transactions found for this user",
				STATUS_CODE.NOT_FOUND
			);
		}

		return new ApiResponse(
			res,
			"Transactions retrieved successfully",
			transactions
		);
	})
);

// Track Shipment Endpoint
app.get(
	"/api/track-shipment/:reference",
	Controller(async (req, res) => {
		const { reference } = req.params;

		if (!reference) {
			throw new AppError(
				"Shipment reference is required",
				STATUS_CODE.BAD_REQUEST
			);
		}

		try {
			// Call the GoShiip API to track shipment
			const response = await axios.get(
				`${process.env.GOSHIIP_BASE_URL}/shipment/track/${reference}`,
				{
					headers: {
						Authorization: `Bearer ${process.env.GOSHIIP_API_KEY}`,
					},
				}
			);

			// Handle API response errors
			if (response.data.status)
				throw new AppError(
					response.data.message || "Shipment not found",
					STATUS_CODE.NOT_FOUND
				);
			// Format and send the shipment tracking data
			console.log("Shipment tracking data:", response.data.data);
			return new ApiResponse(res, response.data.message, response.data.data);
		} catch (error) {
			// Log and handle errors
			console.error(
				"Error tracking shipment:",
				error.response?.data || error.message
			);
			throw new AppError(
				`Error tracking shipment: ${error.message}`,
				STATUS_CODE.INTERNAL_SERVER_ERROR
			);
		}
	})
);

// Get all shipments
app.get(
	"/api/shipments",
	Controller(async (req, res) => {
		const { status } = req.query; // Optional status filter (e.g., "pending", "in progress", etc.)
		if (!status) throw new AS();
		const apiUrl = `https://delivery-staging.apiideraos.com/api/v2/token/user/allorders${
			status ? `?status=${status}` : ""
		}`;

		const headers = {
			Authorization: `Bearer ${process.env.GOSHIIP_API_KEY}`, // Replace "Secret Key" with your actual API key
		};

		try {
			const response = await axios.get(apiUrl, { headers });

			if (response.status === 200) {
				return new ApiResponse(
					res,
					"Shipments fetched successfully",
					response.data.data
				);
			} else {
				return new ApiResponse(
					res,
					response.data.message,
					null,
					response.data.status
				);
			}
		} catch (error) {
			console.error("Error fetching shipments:", error);
			throw new AppError(
				`Error fetching shipments: ${error.message}`,
				STATUS_CODE.INTERNAL_SERVER_ERROR
			);
		}
	})
);

// Cancel a shipment
app.get(
	"/api/shipments/cancel/:reference",
	Controller(async (req, res) => {
		const { reference } = req.params; // Shipment reference from the request parameters

		if (!reference)
			throw new AppError(
				"Shipment reference is required",
				STATUS_CODE.BAD_REQUEST
			);

		const apiUrl = `https://delivery-staging.apiideraos.com/api/v2/token/shipment/cancel/${reference}`;

		const headers = {
			Authorization: `Bearer ${process.env.GOSHIIP_API_KEY}`, // Replace with your actual API key
		};

		try {
			const response = await axios.get(apiUrl, { headers });

			if (response.status === 200) {
				return new ApiResponse(
					res,
					"Shipment canceled successfully",
					response.data.data,
					response.data.status
				);
			} else {
				throw new AppError(
					response.data.message || "Failed to cancel shipment",
					response.data.status
				);
			}
		} catch (error) {
			console.error("Error canceling shipment:", error);
			throw new AppError(
				`Error canceling shipment: ${error.message}`,
				STATUS_CODE.INTERNAL_SERVER_ERROR
			);
		}
	})
);

app.get(
	"/api/orders/user/:userId",
	Controller(async (req, res) => {
		const userId = req.params.userId;
		if (!userId)
			throw new AppError("User ID is required", STATUS_CODE.BAD_REQUEST);

		const orders = await db.order.findMany({
			where: { userId },
			orderBy: { createdAt: "desc" },
			include: {
				user: { select: { username: true, email: true, phoneNumber: true } },
				product: {},
			},
		});
		return new ApiResponse(res, "Orders fetched successfully", orders);
	})
);

// Handle api errors
app.use(errorHandler);

// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;

/* (async () => {
	console.log(
		"sasas",
		await db.transaction.deleteMany({
			where: { transactionId: "transactionData.id" },
		})
	);
})(); */
