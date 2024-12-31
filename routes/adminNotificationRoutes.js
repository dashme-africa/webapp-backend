const express = require('express');
const router = express.Router();
const AdminNotification = require('../models/AdminNotification');
const { protectAdmin } = require('../middleware/adminMiddleware');


// Fetch notifications for the logged-in admin
router.get('/notifications', async (req, res) => {
    try {
        // Assuming the logged-in admin's userId is attached to req.user

        const notifications = await AdminNotification.find() 
            .sort({ createdAt: -1 }) // Sort by latest notifications first

        res.status(200).json({
            message: 'Notifications fetched successfully',
            data: notifications,
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// Mark all notifications as read
router.patch('/notifications/mark-all-read', protectAdmin, async (req, res) => {
    try {
        await AdminNotification.updateMany({ read: false }, { $set: { read: true } });

        console.log()
        res.status(200).json({
            message: 'All notifications marked as read',
        });
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// POST /api/notifications
// router.post('/notifications', async (req, res) => {
//     try {
//         const { message, userId } = req.body;

//         // Validation
//         if (!message || !userId) {
//             return res.status(400).json({ success: false, message: 'Message and userId are required' });
//         }

//         // Create the notification
//         const notification = await AdminNotification.create({
//             message,
//             userId,
//             read: false, // Default to unread
//             timestamp: new Date(),
//         });

//         res.status(201).json({
//             success: true,
//             notification,
//         });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: 'Server error',
//             error: error.message,
//         });
//     }
// });

// PATCH /api/notifications/:id/mark-read
router.patch('/notifications/:id/mark-read', protectAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Find the notification
        const notification = await AdminNotification.findById(id);

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        // Update the read status
        notification.read = true;
        await notification.save();

        res.status(200).json({
            success: true,
            message: 'Notification marked as read',
            notification,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
});


module.exports = router;