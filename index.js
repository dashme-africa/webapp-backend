const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const productRoutes = require('./routes/productRoutes');
const userRoutes = require('./routes/userRoutes');
const userProfileRoutes = require('./routes/userProfileRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminDashboardRoutes = require('./routes/adminDashboardRoutes');
const adminProductRoutes = require('./routes/adminProductRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const myProductRoutes = require('./routes/myProductRoutes');
const Transaction = require('./models/Transaction');
const { protect } = require('./middleware/authMiddleware');


dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 5000;

// CORS Configuration
const allowedOrigins = [
  process.env.FRONTEND_URL_PRODUCTION,
  process.env.FRONTEND_URL_LOCAL,
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy error: ${origin} is not allowed.`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('Database connection error:', err));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Base API Endpoint
app.get('/', (req, res) => res.send('API is running...'));

// Admin Routes
app.use('/api/adminDashboard', adminDashboardRoutes);
app.use('/api/adminProduct', adminProductRoutes);
app.use('/api/admin', adminRoutes);

// User Routes
app.use('/api/products', productRoutes);
app.use('/api/userProfile', userProfileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/myProducts', myProductRoutes);

// Get available couriers based on type
app.get("/api/couriers", async (req, res) => {
  const { type } = req.query;

  if (!type) {
    return res.status(400).json({ error: "Type query parameter is required." });
  }

  try {
    const response = await axios.get(`${process.env.GOSHIIP_BASE_URL}/shipments/courier-partners/`, {
      headers: { Authorization: `Bearer ${process.env.GOSHIIP_API_KEY}` },
      params: { type },
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error fetching couriers:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: "Failed to fetch couriers.",
      details: error.response?.data || error.message,
    });
  }
});

// Define constant parcels data
const CONSTANT_PARCELS = {
  weight: 5,
  length: 10,
  width: 10,
  height: 5,
};

// Get single rate for a specific courier
app.post("/api/rates", async (req, res) => {
  const { carrierName, type, toAddress, fromAddress, parcels, items } = req.body;

  if (!carrierName || !type || !toAddress || !fromAddress || !parcels || !items) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    const response = await axios.post(
      `${process.env.GOSHIIP_BASE_URL}/tariffs/getpricesingle/${carrierName}`,
      {
        type,
        toAddress,
        fromAddress,
        parcels: CONSTANT_PARCELS, // Use the constant parcels data
        items,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GOSHIIP_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error fetching couriers:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: "Failed to fetch couriers.",
      details: error.response?.data || error.message,
    });
  }
});

app.get('/api/track-shipment/:reference', async (req, res) => {
  const { reference } = req.params;

  try {
    const response = await axios.get(`${process.env.GOSHIIP_BASE_URL}/shipment/track/${reference}`, {
      headers: {
        'Authorization': `Bearer ${process.env.GOSHIIP_API_KEY}`,
      }
    });

    if (response.data.status) {
      res.json({
        status: true,
        data: response.data.data
      });
    } else {
      res.json({
        status: false,
        message: 'Could not fetch tracking data'
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: 'Internal server error'
    });
  }
});

// Transaction verification route
app.get('/api/verify-transaction/:reference', async (req, res) => {
  const { reference } = req.params;

  try {
    // Verify the Paystack transaction
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });

    // Ensure the transaction was successful
    if (response.data.data.status === 'success') {
      const transactionData = response.data.data;
      const { redis_key, rate_id } = transactionData.metadata;

      // Prepare the booking payload
      const bookingPayload = {
        redis_key,
        rate_id,
        user_id: process.env.GOSHIP_USER_ID,
        platform: 'web2',
        delivery_note: 'Your delivery is on the way',
      };

      // console.log('Booking Request Payload:', bookingPayload);
      let bookingResponse = null;
      try {
        // Make the booking API request
        bookingResponse = await axios.post(
          `${process.env.GOSHIIP_BASE_URL}/bookshipment`,
          bookingPayload,
          {
            headers: {
              Authorization: `Bearer ${process.env.GOSHIIP_API_KEY}`,
            },
          }
        );

        // console.log('Booking Response Status:', bookingResponse.status);
        // console.log('Booking Response Data:', bookingResponse.data);

        // Handle booking success/failure independently
        if (!bookingResponse.data.status) {
          // If booking fails, log the error but do not stop the transaction status display
          // console.log('Booking failed:', bookingResponse.data.message || 'Unknown error');
        }
      } catch (error) {
        // Log error in booking process but do not affect transaction status display
        console.error('Error booking shipment:', error.response ? error.response.data : error.message);
      }

      // console.log(transactionData.metadata)
      // Send successful transaction details regardless of booking status
      res.status(200).json({
        message: 'Payment successful.',
        transactionDetails: {
          amount: transactionData.amount,
          status: transactionData.status,
          paymentMethod: transactionData.channel,
          currency: transactionData.currency,
          paidAt: transactionData.paid_at,
          shipmentReference: transactionData.metadata,
        },
        bookingStatus: bookingResponse ? bookingResponse.data.message : 'Failed to book shipment',
      });

      // res.status(200).json(response.data.data);
    } else {
      res.status(400).json({ error: 'Transaction verification failed.' });
    }
  } catch (err) {
    console.error('Error verifying transaction:', err.message);
    res.status(500).json({ error: 'Error verifying the transaction.', details: err.message });
  }
});

// Transaction route
app.get('/api/transaction/verify/:reference', async (req, res) => {
  const { reference } = req.params;

  console.log('Transaction reference:', reference);

  try {
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });

    if (response.data.status) {
      const transactionData = response.data.data;

      // Check if the transaction exists
      const existingTransaction = await Transaction.findOne({ reference });
      if (existingTransaction) {
        console.log('Transaction already exists:', existingTransaction);
        return res.status(200).json({ message: 'Transaction already exists', data: existingTransaction });
      }

      // Create and save the transaction
      const newTransaction = new Transaction({
        transactionId: transactionData.id,
        reference: transactionData.reference,
        amount: transactionData.amount,
        currency: transactionData.currency,
        status: transactionData.status,
        customerEmail: transactionData.customer.email,
        paymentMethod: transactionData.channel,
        paidAt: transactionData.paid_at,
        gatewayResponse: transactionData.gateway_response,
      });
      console.log('Transaction to be saved successfully:', newTransaction);

      try {

        await newTransaction.save();
        console.log('Transaction saved successfully:', newTransaction);

        res.status(200).json({ message: 'Transaction verified and saved', data: newTransaction });
      } catch (saveError) {
        console.error('Error saving transaction:', saveError.message);
        res.status(500).json({ message: 'Database save error', error: saveError.message });
      }
    } else {
      res.status(400).json({ message: 'Transaction verification failed', data: response.data });
    }
  } catch (error) {
    console.error('Error verifying transaction:', error.message);
    res.status(500).json({ message: 'Error verifying transaction', error: error.message });
  }
});

app.get('/api/transactions', protect, async (req, res) => {
  try {
    // Replace with the logged-in user's email or ID
    const customerEmail = req.user.email;

    const transactions = await Transaction.find({ customerEmail }).sort({ paidAt: -1 });

    if (!transactions.length) {
      return res.status(404).json({ message: 'No transactions found for this user' });
    }

    res.status(200).json({ message: 'Transactions retrieved successfully', data: transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});


// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;



