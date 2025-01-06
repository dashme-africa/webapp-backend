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
const notificationRoutes = require('./routes/notificationRoutes');
const adminNotificationRoutes = require('./routes/adminNotificationRoutes');
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
  maxAge: 3600, // Add this option to specify the maximum age of the CORS configuration
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
app.use('/api/notify', notificationRoutes);
app.use('/api/notifyAdmin', adminNotificationRoutes);

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

app.post('/api/orders', async (req, res) => {
  const { userId, items, amount, paymentReference } = req.body;

  try {
    const newOrder = new Order({
      userId,
      items,
      amount,
      paymentReference,
    });
    const savedOrder = await newOrder.save();
    res.status(201).json({ message: 'Order created successfully', order: savedOrder });
  } catch (error) {
    res.status(500).json({ message: 'Error creating order', error: error.message });
  }
});

// Define validation rules for toAddress fields
const validateToAddress = (toAddress) => {
  const errors = {};

  if (!toAddress.name || toAddress.name.trim() === "") {
    errors.name = "Name is required";
  }

  if (!toAddress.email || !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(toAddress.email)) {
    errors.email = "Invalid email address";
  }

  if (!toAddress.phone || !/^\d{11}$/.test(toAddress.phone)) {
    errors.phone = "Invalid phone number. Please enter 11 digits.";
  }

  if (!toAddress.address || toAddress.address.trim() === "") {
    errors.address = "Address is required";
  }

  return errors;
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
        parcels: CONSTANT_PARCELS,
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
    console.log(response.data);
  } 
catch (error) {
  console.error("Error fetching couriers:", error);

  if (error.response?.status === 400) {
    // Handle validation errors
    console.error("Validation error:", error.response?.data);
    res.status(400).json({
      error: "Validation error",
      details: error.response?.data,
    });
  } else if (error.response?.status === 401) {
    // Handle authentication errors
    console.error("Authentication error:", error.response?.data);
    res.status(401).json({
      error: "Authentication error",
      details: error.response?.data,
    });
  } else if (error.response?.status === 429) {
    // Handle rate limit errors
    console.error("Rate limit exceeded:", error.response?.data);
    res.status(429).json({
      error: "Rate limit exceeded",
      details: error.response?.data,
    });
  } else if (error.response?.data?.rates?.status === false) {
    // Handle Goshiip API error cases
    const errorMessage = error.response?.data?.rates?.message;
    if (errorMessage.includes("Undefined array key \"distance\"")) {
      res.status(400).json({
        error: "Invalid address",
        details: "Please enter a valid address.",
      });
    } else if (errorMessage.includes("Truq cannot service this shipment because of the weight.")) {
      res.status(400).json({
        error: "Invalid shipment weight",
        details: "Truq cannot service this shipment because of the weight.",
      });
    } else {
      res.status(400).json({
        error: "Goshiip API error",
        details: errorMessage,
      });
    }
  } else {
    // Handle generic errors
    console.error("Error fetching couriers:", error);
    res.status(error.response?.status || 500).json({
      error: "Failed to fetch couriers.",
      details: error.response?.data || error.message,
    });
  }
}
});

// app.post("/api/rates", async (req, res) => {
//   const { carrierName, type, toAddress, fromAddress, parcels, items } = req.body;
//     if (!carrierName || !type || !toAddress || !fromAddress || !parcels || !items) {
//     return res.status(400).json({ error: "Missing required fields." });
//   }
// console.log(req.body);

//   try {
//     const response = await axios.post(
//       `${process.env.GOSHIIP_BASE_URL}/tariffs/getpricesingle/${carrierName}`,
//       {
//         type,
//         toAddress,
//         fromAddress,
//         parcels: CONSTANT_PARCELS,
//         items,
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.GOSHIIP_API_KEY}`,
//           "Content-Type": "application/json",
//         },
//       }
//     );

//     res.status(200).json(response.data);
//   } catch (error) {
//     console.error("Error fetching couriers:", error);

//     if (error.response?.status === 400) {
//       // Handle validation errors
//       console.error("Validation error:", error.response?.data);
//       res.status(400).json({
//         error: "Validation error",
//         details: error.response?.data,
//       });
//     } else if (error.response?.status === 401) {
//       // Handle authentication errors
//       console.error("Authentication error:", error.response?.data);
//       res.status(401).json({
//         error: "Authentication error",
//         details: error.response?.data,
//       });
//     } else if (error.response?.status === 429) {
//       // Handle rate limit errors
//       console.error("Rate limit exceeded:", error.response?.data);
//       res.status(429).json({
//         error: "Rate limit exceeded",
//         details: error.response?.data,
//       });
//     } else {
//       // Handle generic errors
//       console.error("Error fetching couriers:", error);
//       res.status(error.response?.status || 500).json({
//         error: "Failed to fetch couriers.",
//         details: error.response?.data || error.message,
//       });
//     }
//   }
// });



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

// Verification payment route
app.get('/api/verify-transaction/:reference', async (req, res) => {
  const { reference } = req.params;

  try {
    console.log(`Starting transaction verification for reference: ${reference}`);

    // Verify the Paystack transaction
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });

    console.log('Transaction verification response:', response.data);

    // Ensure the transaction was successful
    if (response.data.data.status === 'success') {
      const transactionData = response.data.data;
      console.log('Transaction data:', transactionData);

      const { redis_key, rate_id } = transactionData.metadata;

      // Prepare the booking payload
      const bookingPayload = {
        redis_key,
        rate_id,
        user_id: process.env.GOSHIP_USER_ID,
        platform: 'web2',
        delivery_note: 'Your delivery is on the way',
      };

      console.log('Booking payload:', bookingPayload);

      let bookingResponse = null;

      try {
        // Make the booking API request
        console.log('Sending booking request...');
        bookingResponse = await axios.post(
          `${process.env.GOSHIIP_BASE_URL}/bookshipment`,
          bookingPayload,
          {
            headers: {
              Authorization: `Bearer ${process.env.GOSHIIP_API_KEY}`,
            },
          }
        );

        console.log('Booking response:', bookingResponse.data);

        // Check if booking was successful
        if (bookingResponse.data.status) {
          const shipmentId = bookingResponse.data.data.shipmentId; // Get the shipment ID
          console.log(`Booking successful. Shipment ID: ${shipmentId}`);

          try {
            // Trigger the Assign API with shipment_id in the body
            console.log(`Triggering Assign API for shipment ID: ${shipmentId}`);
            const assignPayload = {
              shipment_id: shipmentId,
            };

            const assignResponse = await axios.post(
              `${process.env.GOSHIIP_BASE_URL}/shipment/assign`,
              assignPayload,
              {
                headers: {
                  Authorization: `Bearer ${process.env.GOSHIIP_API_KEY}`,
                },
              }
            );

            console.log('Assign response:', assignResponse.data);

            // Handle assign response
            if (assignResponse.status === 200) {
              console.log('Shipment assignment successful.');
              res.status(200).json({
                message: 'Payment verified, shipment booked, and assignment successful.',
                transactionDetails: {
                  amount: transactionData.amount,
                  status: transactionData.status,
                  paymentMethod: transactionData.channel,
                  currency: transactionData.currency,
                  paidAt: transactionData.paid_at,
                  shipmentId, // Return shipmentId instead of shipmentReference
                },
                bookingStatus: bookingResponse.data.message,
                assignStatus: assignResponse.data.message,
              });
            } else {
              console.log('Assignment failed:', assignResponse.data.message);
              res.status(assignResponse.status).json({
                message: 'Shipment booked but assignment failed.',
                assignStatus: assignResponse.data.message,
              });
            }
          } catch (error) {
            console.error('Error assigning shipment:', error.response ? error.response.data : error.message);
            res.status(500).json({
              message: 'Shipment booked, but failed to trigger assignment.',
              error: error.message,
            });
          }
        } else {
          console.log('Booking failed:', bookingResponse.data.message);
          res.status(400).json({
            message: 'Booking failed.',
            bookingStatus: bookingResponse.data.message,
          });
        }
      } catch (error) {
        console.error('Error booking shipment:', error.response ? error.response.data : error.message);
        res.status(500).json({
          message: 'Error occurred during booking process.',
          error: error.message,
        });
      }
    } else {
      console.log('Transaction verification failed:', response.data.data.status);
      res.status(400).json({ error: 'Transaction verification failed.' });
    }
  } catch (err) {
    console.error('Error verifying transaction:', err.message);
    res.status(500).json({ error: 'Error verifying the transaction.', details: err.message });
  }
});

// Get Transaction by reference
app.get('/api/transaction/verify/:reference', async (req, res) => {
  const { reference } = req.params;

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

      try {

        await newTransaction.save();
        // console.log('Transaction saved successfully:', newTransaction);

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

// Get all Transactions
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

// Track Shipment Endpoint
app.get('/api/track-shipment/:reference', async (req, res) => {
  const { reference } = req.params;

  if (!reference) {
    return res.status(400).json({
      status: false,
      message: 'Shipment reference is required.',
    });
  }

  try {
    // Call the GoShiip API to track shipment
    const response = await axios.get(`${process.env.GOSHIIP_BASE_URL}/shipment/track/${reference}`, {
      headers: {
        'Authorization': `Bearer ${process.env.GOSHIIP_API_KEY}`,
      },
    });

    if (response.data.status) {
      // Format and send the shipment tracking data
      res.status(200).json({
        status: true,
        message: response.data.message,
        data: response.data.data,
      });
      console.log('Shipment tracking data:', response.data.data);
    } else {
      // Handle API response errors
      res.status(404).json({
        status: false,
        message: response.data.message || 'Shipment not found.',
      });
    }
  } catch (error) {
    // Log and handle errors
    console.error('Error tracking shipment:', error.response?.data || error.message);
    res.status(500).json({
      status: false,
      message: 'Internal server error.',
      error: error.response?.data || error.message,
    });
  }
});

// Get all shipments
app.get("/api/shipments", async (req, res) => {
  const { status } = req.query; // Optional status filter (e.g., "pending", "in progress", etc.)
  const apiUrl = `https://delivery-staging.apiideraos.com/api/v2/token/user/allorders${
    status ? `?status=${status}` : ""
  }`;

  const headers = {
    Authorization: `Bearer ${process.env.GOSHIIP_API_KEY}`, // Replace "Secret Key" with your actual API key
  };

  try {
    const response = await axios.get(apiUrl, { headers });

    if (response.status === 200) {
      res.status(200).json({
        message: "Shipments fetched successfully",
        data: response.data.data,
      });
    } else {
      res.status(response.status).json({
        message: data.message || "Failed to fetch shipments",
        status: response.data.status,
      });
    }
  } catch (error) {
    console.error("Error fetching shipments:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

// Cancel a shipment
app.get("/api/shipments/cancel/:reference", async (req, res) => {
  const { reference } = req.params; // Shipment reference from the request parameters
  const apiUrl = `https://delivery-staging.apiideraos.com/api/v2/token/shipment/cancel/${reference}`;

  const headers = {
    Authorization: `Bearer ${process.env.GOSHIIP_API_KEY}`, // Replace with your actual API key
  };

  try {
    const response = await axios.get(apiUrl, { headers });

    if (response.status === 200) {
      res.status(200).json({
        message: "Shipment cancellation request sent successfully",
        data: response.data.data,
        status: response.data.status,
      });
    } else {
      res.status(response.status).json({
        message: response.data.message || "Failed to cancel shipment",
        status: response.data.status,
      });
    }
  } catch (error) {
    console.error("Error canceling shipment:", error);
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});


// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;



