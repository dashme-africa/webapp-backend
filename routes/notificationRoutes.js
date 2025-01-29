const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const { protect } = require("../middleware/authMiddleware");
const db = require("../db");

// Fetch all notifications for the user
router.get("/notifications", protect, async (req, res) => {
	try {
		if (!req.user) {
			return res.status(401).json({ message: "Unauthorized" });
		}
		const userId = req.user.id; // Extract the user ID from the request object
		// const notifications = await Notification.find({ userId }).sort({
		// 	createdAt: -1,
		// });
		const notifications = await db.notification.findMany({
			where: { userId },
			orderBy: { createdAt: "desc" },
		});

		res.status(200).json({
			message: "Notifications retrieved successfully",
			data: notifications,
		});
	} catch (error) {
		console.error("Error fetching notifications:", error);
		res
			.status(500)
			.json({ message: "Internal server error", error: error.message });
	}
});

// Mark all notifications as read
router.patch("/notifications/mark-read", protect, async (req, res) => {
	try {
		const userId = req.user.id; // Extract the user ID from the request object
		// await Notification.updateMany(
		// 	{ userId, read: false },
		// 	{ $set: { read: true } }
		// );

		await db.notification.updateMany({
			where: { read: false, userId },
			data: { read: true },
		});

		res.status(200).json({
			message: "All notifications marked as read",
		});
	} catch (error) {
		console.error("Error marking notifications as read:", error);
		res
			.status(500)
			.json({ message: "Internal server error", error: error.message });
	}
});

// POST /api/notifications
router.post("/notifications", async (req, res) => {
	try {
		const { message, userId } = req.body;

		// Validation
		if (!message || !userId) {
			return res
				.status(400)
				.json({ success: false, message: "Message and userId are required" });
		}

		// Create the notification
		const notification = await db.notification.create({
			data: {
				message,
				user: { connect: { id: userId } },
				read: false, // Default to unread
			},
		});
		// const notification = await Notification.create({
		// 	message,
		// 	userId,
		// 	read: false, // Default to unread
		// 	timestamp: new Date(),
		// });

		res.status(201).json({
			success: true,
			notification,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Server error",
			error: error.message,
		});
	}
});

// PATCH /api/notifications/:id/mark-read
router.patch("/notifications/:id/mark-read", protect, async (req, res) => {
	try {
		const { id } = req.params;

		// Find and update the notification
		const notification = await db.notification.update({
			where: { id },
			data: { read: true },
		});

		if (!notification) {
			return res
				.status(404)
				.json({ success: false, message: "Notification not found" });
		}

		res.status(200).json({
			success: true,
			message: "Notification marked as read",
			notification,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Server error",
			error: error.message,
		});
	}
});

module.exports = router;
