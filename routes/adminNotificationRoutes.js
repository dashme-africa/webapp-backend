const express = require("express");
const router = express.Router();
const { protectAdmin } = require("../middleware/adminMiddleware");
const db = require("../db");
const { ApiResponse, STATUS_CODE } = require("../middleware/response");
const { Middleware, Controller } = require("../middleware/handlers");
const { AppError } = require("../middleware/exception");

// Fetch notifications for the logged-in admin
router.get(
	"/notifications",
	Middleware(protectAdmin),
	Controller(async (req, res) => {
		const notifications = await db.adminNotification.findMany({
			orderBy: { createdAt: "desc" },
		});

		return new ApiResponse(
			res,
			"Notifications fetched successfully",
			notifications
		);
	})
);

// Mark all notifications as read
router.patch(
	"/notifications/mark-all-read",
	Middleware(protectAdmin),
	Controller(async (req, res) => {
		await db.adminNotification.updateMany({
			where: { read: false },
			data: { read: true },
		});

		return new ApiResponse(res, "All notifications marked as read");
	})
);

router.patch(
	"/notifications/:id/mark-read",
	Middleware(protectAdmin),
	Controller(async (req, res) => {
		const { id } = req.params;

		if (!id)
			throw new AppError(
				"Notification ID is required",
				STATUS_CODE.BAD_REQUEST
			);

		// Find the notification
		// const notification = await AdminNotification.findById(id);
		const notification = await db.adminNotification.update({
			where: { id },
			data: { read: true },
		});

		if (!notification)
			throw new AppError("Notification not found", STATUS_CODE.NOT_FOUND);

		// Update the read status
		// notification.read = true;
		// await notification.save();

		return new ApiResponse(res, "Notification marked as read", notification);
	})
);

module.exports = router;
