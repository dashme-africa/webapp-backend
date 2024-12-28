const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/authMiddleware');

// Fetch all notifications for the user
router.get('/notifications', protect, async (req, res) => {
  try {
    const userId = req.user.id; // Extract the user ID from the request object
    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 });

    res.status(200).json({
      message: 'Notifications retrieved successfully',
      data: notifications,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Mark all notifications as read
router.patch('/notifications/mark-read', protect, async (req, res) => {
    try {
      const userId = req.user.id; // Extract the user ID from the request object
      await Notification.updateMany({ userId, read: false }, { $set: { read: true } });
  
      res.status(200).json({
        message: 'All notifications marked as read',
      });
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  });
  

  module.exports = router;