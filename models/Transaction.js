const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true },
  reference: { type: String, required: true },
  amount: { type: Number, required: true },
  orderId: { type: String },
  currency: { type: String, required: true },
  status: { type: String, required: true },
  customerEmail: { type: String, required: true },
  paymentMethod: { type: String, required: true },
  paidAt: { type: Date, required: true },
  gatewayResponse: { type: String, required: true },
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;
