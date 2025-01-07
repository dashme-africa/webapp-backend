const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  buyerEmail: String,
  amount: Number,
  userId: String,
  subaccount: String,
  transactionCharge: Number,
  redisKey: String,
  rateId: String,
  rateAmount: Number,
  productId: String,
  quantity: Number,
  productAmount: Number,
  sellerId: String,
  transactionReference: String,
  shipmentReference: String,
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);