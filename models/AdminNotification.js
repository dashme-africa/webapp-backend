const mongoose = require('mongoose');

const adminNotificationSchema = new mongoose.Schema({
  type: { type: String, required: true }, // e.g., 'product_pending'
  message: { type: String, required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }, // Track if the admin has viewed this notification
});

module.exports = mongoose.model('AdminNotification', adminNotificationSchema);
