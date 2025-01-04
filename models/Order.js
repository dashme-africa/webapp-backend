const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [{ productId: String, quantity: Number }], // List of products in the order
  amount: Number, // Total price
  paymentReference: String, // Paystack or payment gateway reference
  status: { type: String, default: 'Pending' }, // Order status: Pending, Paid, Shipped, Delivered
  shipmentId: String, // Associated shipment ID from the logistics API
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Order', OrderSchema);
