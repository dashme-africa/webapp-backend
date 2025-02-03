const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const db = require("../db");
const { AppError, ValidationError } = require("../middleware/exception");
const { STATUS_CODE, ApiResponse } = require("../middleware/response");
const { Controller, Middleware } = require("../middleware/handlers");
const { z } = require("zod");
const { getStringValidation } = require("../validation/schema");

// Fetch all notifications for the user
router.get(
	"/notifications",
	Middleware(protect),
	Controller(async (req, res) => {
		if (!req.user) {
			throw new AppError("Unauthorized", STATUS_CODE.UNAUTHORIZED);
		}
		const userId = req.user.id;

		const notifications = await db.notification.findMany({
			where: { userId },
			orderBy: { createdAt: "desc" },
		});

		return new ApiResponse(
			res,
			"Notifications retrieved successfully",
			notifications
		);
	})
);

// Mark all notifications as read
router.patch(
	"/notifications/mark-read",
	Middleware(protect),
	Controller(async (req, res) => {
		const userId = req.user.id; // Extract the user ID from the request object

		await db.notification.updateMany({
			where: { read: false, userId },
			data: { read: true },
		});

		return new ApiResponse(res, "All notifications marked as read");
	})
);

// POST /api/notifications
router.post(
	"/notifications",
	Controller(async (req, res) => {
		const validate = z
			.object({
				message: getStringValidation("Message"),
				userId: getStringValidation("UserID"),
			})
			.safeParse(req.body);

		if (!validate.success) throw new ValidationError(validate.error);

		const { message, userId } = validate.data;

		// Validation
		if (!message || !userId) {
			throw new AppError(
				"Message and userId are required",
				STATUS_CODE.BAD_REQUEST
			);
		}

		// Create the notification
		const notification = await db.notification.create({
			data: {
				message,
				user: { connect: { id: userId } },
				read: false, // Default to unread
			},
		});

		return new ApiResponse(
			res,
			"Notification created successfully",
			notification,
			STATUS_CODE.CREATED
		);
	})
);

// PATCH /api/notifications/:id/mark-read
router.patch(
	"/notifications/:id/mark-read",
	Middleware(protect),
	Controller(async (req, res) => {
		const { id } = req.params;
		if (!id) {
			throw new AppError(
				"Notification ID is required",
				STATUS_CODE.BAD_REQUEST
			);
		}

		// Find and update the notification
		const notification = await db.notification.update({
			where: { id },
			data: { read: true },
		});

		if (!notification) {
			throw new AppError("Notification not found", STATUS_CODE.NOT_FOUND);
		}

		return new ApiResponse(res, "Notification marked as read", notification);
	})
);

module.exports = router;
